#!/usr/bin/env bash
# ============================================================================
# EAUMALIK — Script de déploiement déclenché par webhook GitHub
# (équivalent à ce que font Vercel/Hostinger : git pull → build → restart)
#
# Usage :
#   /opt/eaumalik/deploy-on-push.sh abc1234    # SHA du commit
#
# Prérequis :
#   - Repo git cloné dans /opt/eaumalik/repo (branche main)
#   - Docker installé
#   - Réseau supabase-prod-net existant
#   - Container eaumalik-app tournant dans supabase-prod-net
#
# Effets de bord :
#   - Crée l'image Docker eaumalik-saas:<sha>-<ts> + :latest
#   - Stoppe + relance le container eaumalik-app
#   - Garde 3 derniers tags pour rollback
# ============================================================================
set -euo pipefail

# ---------- Config ----------
APP_NAME="eaumalik"
IMAGE_NAME="eaumalik-saas"
CONTAINER_NAME="${APP_NAME}-app"
NETWORK_NAME="supabase-prod-net"
SERVER_DIR="/opt/eaumalik"
REPO_DIR="${SERVER_DIR}/repo"
APP_DIR="${REPO_DIR}/eaumalik-saas"
ENV_FILE="${SERVER_DIR}/.env"
LOG_DIR="/var/log/eaumalik-deploy"

SHA="${1:-${DEPLOY_SHA:-unknown}}"
PUSHER="${DEPLOY_PUSHER:-unknown}"
BUILD_TAG="${SHA:0:7}-$(date +%Y%m%d-%H%M%S)"
ROLLBACK_TAG_FILE="${SERVER_DIR}/.last_image"

mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "═══════════════════════════════════════════════"
echo "▶ DEPLOY EAUMALIK"
echo "  SHA    : $SHA"
echo "  Pusher : $PUSHER"
echo "  Tag    : $BUILD_TAG"
echo "  Log    : $LOG_FILE"
echo "═══════════════════════════════════════════════"

# ---------- Vérifs ----------
command -v docker >/dev/null || { echo "❌ docker absent"; exit 1; }
[[ -d "$REPO_DIR" ]] || { echo "❌ Repo absent : $REPO_DIR (cloner le repo ici)"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "❌ .env absent : copier .env.prod vers $ENV_FILE (chmod 600)"; exit 1; }

cd "$REPO_DIR"

# ---------- 1. git fetch + reset sur le SHA poussé ----------
echo "→ git fetch + reset sur $SHA"
git fetch origin main --quiet
git reset --hard "$SHA" --quiet
git clean -fd --quiet

# ---------- 2. Build Docker ----------
cd "$APP_DIR"
echo "→ docker build (standalone)"
DOCKER_BUILDKIT=1 docker build \
  --build-arg "CACHE_BUST=$(date +%s)" \
  --tag "${IMAGE_NAME}:${BUILD_TAG}" \
  --tag "${IMAGE_NAME}:latest" \
  --label "org.opencontainers.image.revision=$SHA" \
  --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --label "org.opencontainers.image.source=https://github.com/YounesOumalik/eaumalik-saas" \
  .

echo "→ Image sizes :"
docker images "$IMAGE_NAME" --format "  {{.Tag}}\t{{.Size}}" | head -5

# ---------- 3. Sauvegarde du tag précédent (pour rollback) ----------
echo "→ Sauvegarde tag précédent"
PREV=$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null || echo '')
echo "$PREV" > "$ROLLBACK_TAG_FILE"
echo "  tag précédent : $PREV"

# ---------- 4. Stop + relance container ----------
echo "→ Redémarrage container $CONTAINER_NAME"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

PORT=$(grep '^PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]' || echo 3100)
export PORT

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --env-file "$ENV_FILE" \
  -e HOSTNAME=0.0.0.0 \
  -e PORT="$PORT" \
  -p "127.0.0.1:${PORT}:${PORT}" \
  --log-driver json-file \
  --log-opt max-size=20m \
  --log-opt max-file=5 \
  "${IMAGE_NAME}:${BUILD_TAG}"

# ---------- 5. Healthcheck ----------
echo "→ Attente healthcheck (max 60s)"
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo 'starting')
  echo "  [$i/30] $STATUS"
  if [ "$STATUS" = "healthy" ]; then
    echo "✅ Container healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Healthcheck timeout — logs :"
    docker logs "$CONTAINER_NAME" --tail 30
    exit 1
  fi
  sleep 2
done

# ---------- 6. Migrations SQL idempotentes (auto) ----------
# Applique les .sql dans supabase/migrations/ qui n'ont pas encore été joués
# sur la base prod. Suit l'état dans eaumalik._applied_migrations.
# En cas d'échec → rollback du container sur l'image précédente.
echo "→ Application des migrations SQL en attente…"
if [ -f "$APP_DIR/scripts/apply-pending-migrations.sh" ]; then
  if bash "$APP_DIR/scripts/apply-pending-migrations.sh"; then
    echo "✅ Migrations SQL OK"
  else
    echo "❌ Migrations SQL échouées — rollback container vers $PREV"
    if [ -n "$PREV" ]; then
      docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
      docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        --network "$NETWORK_NAME" \
        --env-file "$ENV_FILE" \
        -e HOSTNAME=0.0.0.0 \
        -e PORT="$PORT" \
        -p "127.0.0.1:${PORT}:${PORT}" \
        --log-driver json-file \
        --log-opt max-size=20m \
        --log-opt max-file=5 \
        "$PREV" || true
    fi
    exit 1
  fi
else
  echo "  (script apply-pending-migrations.sh absent, skip)"
fi

# ---------- 7. Smoke test ----------
echo "→ Smoke test HTTP $PORT"
HTTP_CODE=$(curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Smoke test OK (HTTP 200)"
else
  echo "❌ Smoke test failed (HTTP $HTTP_CODE)"
  docker logs "$CONTAINER_NAME" --tail 30
  exit 1
fi

# ---------- 8. Cleanup vieux tags (garder les 3 derniers) ----------
echo "→ Cleanup : garder les 3 derniers tags"
docker images "$IMAGE_NAME" --format '{{.Tag}} {{.CreatedAt}}' \
  | grep -v 'latest' \
  | sort -k2 -r \
  | tail -n +4 \
  | awk '{print $1}' \
  | xargs -r -n1 docker rmi "${IMAGE_NAME}:" 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ DEPLOY RÉUSSI : ${IMAGE_NAME}:${BUILD_TAG}"
echo "═══════════════════════════════════════════════"