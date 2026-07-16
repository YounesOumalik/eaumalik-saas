#!/usr/bin/env bash
# ============================================================================
# EAUMALIK — Script de déploiement sur SmartServeur (Contabo)
# Usage :
#   ./scripts/deploy.sh              # build + push + restart
#   ./scripts/deploy.sh --no-build   # réutilise l'image locale existante
#   ./scripts/deploy.sh --rollback   # revient au tag précédent
#
# Prérequis :
#   - Docker installé localement
#   - Accès SSH au serveur via l'alias 'smartserveur' (~/.ssh/config)
#   - Fichier .env.prod à la racine (voir .env.prod.example)
# ============================================================================
set -euo pipefail

# ---------- Config ----------
APP_NAME="eaumalik"
IMAGE_NAME="eaumalik-saas"
SERVER_HOST="${DEPLOY_HOST:-smartserveur}"
SERVER_DIR="/opt/${APP_NAME}"
CONTAINER_NAME="${APP_NAME}-app"
NETWORK_NAME="supabase-prod-net"   # réseau Docker partagé côté serveur (stack Supabase self-hosted)
BUILD_TAG="$(date +%Y%m%d-%H%M%S)"
ROLLBACK_TAG_FILE="${SERVER_DIR}/.last_image"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()   { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
fail()  { echo -e "${RED}[fail]${NC} $*" >&2; exit 1; }

# ---------- Args ----------
NO_BUILD=false
ROLLBACK=false
for arg in "$@"; do
  case "$arg" in
    --no-build)  NO_BUILD=true ;;
    --rollback)  ROLLBACK=true ;;
    -h|--help)
      sed -n '3,20p' "$0"; exit 0 ;;
    *) fail "Option inconnue : $arg" ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ---------- Rollback ----------
if $ROLLBACK; then
  log "Rollback demandé"
  PREV_TAG="$(ssh "$SERVER_HOST" "cat ${ROLLBACK_TAG_FILE} 2>/dev/null || true")"
  [[ -z "$PREV_TAG" ]] && fail "Aucun tag précédent enregistré dans ${ROLLBACK_TAG_FILE}"
  log "Retour à l'image : $PREV_TAG"
  ssh "$SERVER_HOST" "cd ${SERVER_DIR} && docker pull '${IMAGE_NAME}:${PREV_TAG}' || docker load -i /tmp/${IMAGE_NAME}-${PREV_TAG}.tar.gz"
  ssh "$SERVER_HOST" "cd ${SERVER_DIR} && docker rm -f ${CONTAINER_NAME} 2>/dev/null; docker run -d --name ${CONTAINER_NAME} --restart unless-stopped --network ${NETWORK_NAME} --env-file .env ${IMAGE_NAME}:${PREV_TAG}"
  log "Rollback OK"
  exit 0
fi

# ---------- Vérifs ----------
command -v docker >/dev/null  || fail "docker local absent"
[[ -f .env.prod ]]            || fail ".env.prod manquant (voir .env.prod.example)"
ssh -o ConnectTimeout=5 "$SERVER_HOST" 'echo OK' >/dev/null 2>&1 \
  || fail "Connexion SSH impossible vers $SERVER_HOST"

# ---------- Build local ----------
if $NO_BUILD; then
  log "Mode --no-build : on réutilise l'image locale :latest"
  IMAGE_REF="${IMAGE_NAME}:latest"
else
  log "Build de l'image ${IMAGE_NAME}:${BUILD_TAG}"
  docker build -t "${IMAGE_NAME}:${BUILD_TAG}" -t "${IMAGE_NAME}:latest" .
  log "Build OK"
  IMAGE_REF="${IMAGE_NAME}:${BUILD_TAG}"
fi

# ---------- Export + transfert ----------
TMP_TAR="/tmp/${IMAGE_NAME}-${BUILD_TAG}.tar.gz"
log "Export de l'image → ${TMP_TAR}"
docker save "${IMAGE_REF}" | gzip > "$TMP_TAR"

log "Transfert SCP vers ${SERVER_HOST}:${TMP_TAR}"
scp -q "$TMP_TAR" "${SERVER_HOST}:${TMP_TAR}"

# ---------- Déploiement serveur ----------
log "Déploiement distant"
ssh "$SERVER_HOST" "
  set -e
  mkdir -p ${SERVER_DIR}
  cd ${SERVER_DIR}
  docker load -i ${TMP_TAR}
  rm -f ${TMP_TAR}

  # Sauvegarde du tag précédent
  PREV=\$(docker inspect --format '{{.Config.Image}}' ${CONTAINER_NAME} 2>/dev/null || echo '')
  echo \$PREV > ${ROLLBACK_TAG_FILE}.tmp || true

  # Transfert du .env.prod (idempotent — rsync-like via scp)
  # NOTE : le .env.prod local doit être copié avant par l'opérateur (cf. README)
  [[ -f .env ]] || { echo 'ERREUR: /opt/${APP_NAME}/.env absent — copier .env.prod → .env'; exit 1; }

  docker rm -f ${CONTAINER_NAME} 2>/dev/null || true
  PORT=\$(grep '^PORT=' .env | cut -d= -f2 | tr -d '[:space:]' || echo 3000)
  docker run -d \
    --name ${CONTAINER_NAME} \
    --restart unless-stopped \
    --network ${NETWORK_NAME} \
    --env-file .env \
    -e HOSTNAME=0.0.0.0 \
    -p 127.0.0.1:\${PORT}:\${PORT} \
    --log-driver json-file \
    --log-opt max-size=20m \
    --log-opt max-file=5 \
    ${IMAGE_REF}

  echo \${PREV} > ${ROLLBACK_TAG_FILE}
  docker image prune -f
"

log "Attente du healthcheck..."
for i in {1..30}; do
  STATUS=$(ssh "$SERVER_HOST" "docker inspect --format '{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo 'starting'")
  if [[ "$STATUS" == "healthy" ]]; then
    log "Container ${CONTAINER_NAME} : healthy"
    break
  fi
  if [[ $i -eq 30 ]]; then
    warn "Healthcheck non 'healthy' après 60s — vérifie : ssh ${SERVER_HOST} docker logs ${CONTAINER_NAME}"
    break
  fi
  sleep 2
done

CONTAINER_IP=$(ssh "$SERVER_HOST" "docker inspect --format '{{index .NetworkSettings.Networks \"${NETWORK_NAME}\" \"IPAddress\"}}' ${CONTAINER_NAME}")
log "Container IP : ${CONTAINER_IP}"
log "Test local : curl -sI http://127.0.0.1:3100/"

rm -f "$TMP_TAR"
log "✅ Déploiement ${IMAGE_REF} terminé"
log "   → Ajouter le bloc Caddy (voir docs/DEPLOY.md)"
log "   → Créer le superadmin : ssh ${SERVER_HOST} docker exec -i db-prod psql -U postgres -f create-admin.sql"
