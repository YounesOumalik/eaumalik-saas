#!/usr/bin/env bash
# ============================================================================
# EAUMALIK — Setup complet d'un nouveau projet VPS (one-shot)
#
# Automatise TOUT depuis ton poste local :
#   1. Génère les fichiers templates (server.js, deploy-on-push.sh, *.service)
#      adaptés au nouveau projet
#   2. Crée le sous-domaine dans le Caddyfile sur le VPS
#   3. Génère le secret HMAC et l'affiche (à coller dans GitHub)
#   4. Installe le service systemd
#   5. Crée le dossier /opt/<APP>/ et clone le repo
#   6. Affiche les instructions finales
#
# Usage :
#   ./setup-new-project.sh \
#     --app portfolio \
#     --domain younesoumalik.smartefp.com \
#     --repo https://github.com/YounesOumalik/portfolio.git \
#     --port 3000 \
#     [--network supabase-prod-net] \
#     [--staging] \
#     [--dry-run]
#
# Exemples :
#   ./setup-new-project.sh --app portfolio --domain younesoumalik.smartefp.com \
#     --repo https://github.com/YounesOumalik/portfolio.git --port 3000
#
#   ./setup-new-project.sh --app api --domain api.smartefp.com \
#     --repo https://github.com/YounesOumalik/api.git --port 8080 --staging
# ============================================================================
set -euo pipefail

# ---------- Defaults ----------
APP=""
DOMAIN=""
REPO=""
PORT=3000
NETWORK=""
STAGING=false
DRY_RUN=false
WEBHOOK_PORT=9000
VPS_HOST="${VPS_HOST:-smartserveur}"
VPS_USER="${VPS_USER:-younes}"

# ---------- Help ----------
usage() {
  sed -n '3,30p' "$0"
  exit 0
}

# ---------- Args ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)        APP="$2"; shift 2 ;;
    --domain)     DOMAIN="$2"; shift 2 ;;
    --repo)       REPO="$2"; shift 2 ;;
    --port)       PORT="$2"; shift 2 ;;
    --network)    NETWORK="$2"; shift 2 ;;
    --webhook-port) WEBHOOK_PORT="$2"; shift 2 ;;
    --staging)    STAGING=true; shift ;;
    --dry-run)    DRY_RUN=true; shift ;;
    --vps-host)   VPS_HOST="$2"; shift 2 ;;
    --vps-user)   VPS_USER="$2"; shift 2 ;;
    -h|--help)    usage ;;
    *) echo "❌ Option inconnue : $1"; exit 1 ;;
  esac
done

# ---------- Vérifs ----------
[[ -z "$APP" ]] && { echo "❌ --app requis (ex: portfolio, api, blog)"; exit 1; }
[[ -z "$DOMAIN" ]] && { echo "❌ --domain requis (ex: portfolio.smartefp.com)"; exit 1; }
[[ -z "$REPO" ]] && { echo "❌ --repo requis (URL GitHub)"; exit 1; }

# Valide format
[[ "$APP" =~ ^[a-z0-9-]+$ ]] || { echo "❌ --app doit être alphanumérique + tirets"; exit 1; }
[[ "$DOMAIN" =~ ^[a-z0-9.-]+$ ]] || { echo "❌ --domain invalide"; exit 1; }
[[ "$REPO" =~ ^https://github\.com/ ]] || { echo "❌ --repo doit être une URL GitHub (https://github.com/...)"; exit 1; }

# Test connectivité VPS (sauf en dry-run)
if ! $DRY_RUN; then
  ssh -o ConnectTimeout=5 "$VPS_HOST" 'echo OK' >/dev/null 2>&1 \
    || { echo "❌ Connexion SSH impossible vers $VPS_HOST"; exit 1; }
fi

# ---------- Affichage config ----------
echo "════════════════════════════════════════════"
echo "🚀 SETUP NOUVEAU PROJET VPS"
echo "════════════════════════════════════════════"
echo ""
echo "  App         : $APP"
echo "  Domaine     : $DOMAIN"
echo "  Repo        : $REPO"
echo "  Port app    : $PORT"
echo "  Webhook port: $WEBHOOK_PORT"
echo "  Réseau      : ${NETWORK:-(bridge par défaut)}"
echo "  Staging     : $STAGING"
echo "  VPS         : $VPS_USER@$VPS_HOST"
echo "  Dry-run     : $DRY_RUN"
echo ""
if ! $DRY_RUN; then
  read -rsrp "Continuer ? [o/N] " CONFIRM
  echo
  [[ "$CONFIRM" =~ ^[oOyY]$ ]] || { echo "Annulé."; exit 0; }
fi

# ---------- Helpers ----------
ssh_exec() {
  if $DRY_RUN; then
    echo "[DRY-RUN ssh $VPS_HOST] $*"
  else
    ssh "$VPS_HOST" "$@"
  fi
}

scp_to() {
  if $DRY_RUN; then
    echo "[DRY-RUN scp] $1 → $VPS_HOST:$2"
  else
    scp -q "$1" "$VPS_HOST:$2"
  fi
}

# ---------- Génération du secret HMAC ----------
echo ""
echo "→ Étape 1/6 : Génération du secret HMAC"
if $DRY_RUN; then
  SECRET="dry_run_secret_$(date +%s)"
else
  SECRET=$(ssh_exec "openssl rand -hex 32")
fi
echo "  Secret : $SECRET (32 bytes hex)"

# ---------- Préparation des dossiers ----------
echo ""
echo "→ Étape 2/6 : Création des dossiers sur le VPS"
ssh_exec "sudo mkdir -p /opt/$APP/{webhook,repo} /var/log/$APP-webhook.log /var/log/$APP-deploy /etc/eaumalik"
ssh_exec "sudo chown -R $VPS_USER:$VPS_USER /opt/$APP /var/log/$APP-webhook.log /var/log/$APP-deploy"

# ---------- Création du secret file ----------
echo ""
echo "→ Étape 3/6 : Écriture du secret HMAC"
SECRET_FILE="/etc/eaumalik/$APP-webhook-secret"
ssh_exec "echo '$SECRET' | sudo tee $SECRET_FILE > /dev/null && sudo chmod 600 $SECRET_FILE"

# ---------- Génération des fichiers templates localement ----------
echo ""
echo "→ Étape 4/6 : Génération des fichiers templates"
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# server.js
cat > "$TMP_DIR/server.js" <<EOF
#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PORT = ${WEBHOOK_PORT};
const WEBHOOK_SECRET_FILE = '/etc/eaumalik/${APP}-webhook-secret';
const DEPLOY_SCRIPT = '/opt/${APP}/deploy-on-push.sh';
const LOG_FILE = '/var/log/${APP}-webhook.log';
const BRANCH = '${STAGING:+develop}main';  // staging = develop, prod = main

function log(level, msg) {
  const line = \`[\${new Date().toISOString()}] [\${level}] \${msg}\\n\`;
  process.stdout.write(line);
  try { appendFileSync(LOG_FILE, line); } catch {}
}

function loadSecret() {
  if (!existsSync(WEBHOOK_SECRET_FILE)) { log('ERROR', 'Secret missing'); process.exit(1); }
  return readFileSync(WEBHOOK_SECRET_FILE, 'utf8').trim();
}

function verifySignature(secret, signatureHeader, rawBody) {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice(7);
  if (provided.length !== computed.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(computed));
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: '${APP}-webhook' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    if (!verifySignature(loadSecret(), req.headers['x-hub-signature-256'], rawBody)) {
      log('WARN', \`Invalid signature from \${req.socket.remoteAddress}\`);
      res.writeHead(401).end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }

    const event = req.headers['x-github-event'];
    if (event !== 'push') { res.writeHead(200).end(JSON.stringify({ status: 'ignored', event })); return; }

    let payload;
    try { payload = JSON.parse(rawBody); } catch { res.writeHead(400).end('{}'); return; }

    if (payload.ref !== \`refs/heads/\${BRANCH}\`) {
      res.writeHead(200).end(JSON.stringify({ status: 'ignored', ref: payload.ref, expected: BRANCH }));
      return;
    }

    const sha = (payload.after || '').slice(0, 7);
    const pusher = payload.pusher?.name || 'unknown';
    log('INFO', \`Deploy \${BRANCH} requested by \${pusher} (commit \${sha})\`);

    res.writeHead(202).end(JSON.stringify({ status: 'deploying', sha, branch: BRANCH }));

    const child = spawn('bash', [DEPLOY_SCRIPT, sha], {
      env: { ...process.env, DEPLOY_SHA: sha, DEPLOY_PUSHER: pusher, DEPLOY_BRANCH: BRANCH },
      detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.unref();
    child.stdout.on('data', (d) => log('DEPLOY', \`[stdout] \${d.toString().trim()}\`));
    child.stderr.on('data', (d) => log('DEPLOY', \`[stderr] \${d.toString().trim()}\`));
    child.on('exit', (code) => log(code === 0 ? 'INFO' : 'ERROR', \`Deploy \${sha} exit=\${code}\`));
    return;
  }

  res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => log('INFO', \`Webhook listening on :\${PORT} (branch=\${BRANCH})\`));
EOF

# deploy-on-push.sh
NETWORK_ARG='${NETWORK:+--network "$NETWORK"}'
cat > "$TMP_DIR/deploy-on-push.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP}"
IMAGE_NAME="${APP}-image"
CONTAINER_NAME="\${APP_NAME}-app"
SERVER_DIR="/opt/\${APP_NAME}"
REPO_DIR="\${SERVER_DIR}/repo"
APP_DIR="\${REPO_DIR}"
ENV_FILE="\${SERVER_DIR}/.env"
PORT="\${PORT:-${PORT}}"
NETWORK_NAME="${NETWORK}"

SHA="\${1:-\${DEPLOY_SHA:-unknown}}"
BUILD_TAG="\${SHA:0:7}-\$(date +%Y%m%d-%H%M%S)"
LOG_DIR="/var/log/\${APP_NAME}-deploy"
mkdir -p "\$LOG_DIR"
LOG_FILE="\${LOG_DIR}/deploy-\$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "\$LOG_FILE") 2>&1

echo "=== DEPLOY \${APP_NAME} (\${DEPLOY_BRANCH:-main}) ==="
echo "SHA: \$SHA  Tag: \$BUILD_TAG"

[[ -d "\$REPO_DIR" ]] || { echo "❌ Repo absent: \$REPO_DIR"; exit 1; }
[[ -f "\$ENV_FILE" ]] || { echo "❌ .env absent: \$ENV_FILE"; exit 1; }

cd "\$REPO_DIR"
git fetch origin \${DEPLOY_BRANCH:-main} --quiet
git reset --hard "\$SHA" --quiet

cd "\$APP_DIR"
DOCKER_BUILDKIT=1 docker build \\
  --build-arg "CACHE_BUST=\$(date +%s)" \\
  --tag "\${IMAGE_NAME}:\${BUILD_TAG}" \\
  --tag "\${IMAGE_NAME}:latest" .

docker rm -f "\$CONTAINER_NAME" 2>/dev/null || true
docker run -d \\
  --name "\$CONTAINER_NAME" \\
  --restart unless-stopped \\
  \${NETWORK_NAME:+--network "\$NETWORK_NAME"} \\
  --env-file "\$ENV_FILE" \\
  -e HOSTNAME=0.0.0.0 \\
  -e PORT="\$PORT" \\
  -p "127.0.0.1:\${PORT}:\${PORT}" \\
  --log-driver json-file \\
  --log-opt max-size=20m \\
  --log-opt max-file=5 \\
  "\${IMAGE_NAME}:\${BUILD_TAG}"

for i in \$(seq 1 30); do
  STATUS=\$(docker inspect --format '{{.State.Health.Status}}' "\$CONTAINER_NAME" 2>/dev/null || echo 'starting')
  echo "[\$i/30] \$STATUS"
  [[ "\$STATUS" == "healthy" ]] && break
  [[ \$i -eq 30 ]] && { docker logs "\$CONTAINER_NAME" --tail 30; exit 1; }
  sleep 2
done

HTTP=\$(curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:\${PORT}/" 2>/dev/null || echo "000")
[[ "\$HTTP" == "200" ]] || { docker logs "\$CONTAINER_NAME" --tail 30; exit 1; }

echo "✅ Deploy OK"
EOF

# Service systemd
cat > "$TMP_DIR/${APP}-webhook.service" <<EOF
[Unit]
Description=${APP} GitHub Webhook Receiver
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=${VPS_USER}
Group=docker
WorkingDirectory=/opt/${APP}/webhook
ExecStart=/usr/bin/node /opt/${APP}/webhook/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP}-webhook
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=false
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Copie sur le VPS
echo "  - server.js"
scp_to "$TMP_DIR/server.js" "/tmp/server.js"
ssh_exec "sudo cp /tmp/server.js /opt/$APP/webhook/server.js && sudo chmod 644 /opt/$APP/webhook/server.js && sudo rm /tmp/server.js"

echo "  - deploy-on-push.sh"
scp_to "$TMP_DIR/deploy-on-push.sh" "/tmp/deploy-on-push.sh"
ssh_exec "sudo cp /tmp/deploy-on-push.sh /opt/$APP/deploy-on-push.sh && sudo chmod +x /opt/$APP/deploy-on-push.sh && sudo rm /tmp/deploy-on-push.sh"

echo "  - ${APP}-webhook.service"
scp_to "$TMP_DIR/${APP}-webhook.service" "/tmp/${APP}-webhook.service"
ssh_exec "sudo cp /tmp/${APP}-webhook.service /etc/systemd/system/${APP}-webhook.service && sudo rm /tmp/${APP}-webhook.service"

# ---------- Clone du repo ----------
echo ""
echo "→ Étape 5/6 : Clone du repo GitHub"
if $STAGING; then
  BRANCH="develop"
else
  BRANCH="main"
fi
ssh_exec "sudo -u $VPS_USER git clone --branch $BRANCH $REPO /opt/$APP/repo 2>&1 | tail -3 || echo '⚠️  Clone déjà existant, skip'"

# ---------- Configuration Caddy ----------
echo ""
echo "→ Étape 6/6 : Configuration Caddy"

STAGING_SUBDOMAIN=""
if $STAGING; then
  STAGING_SUBDOMAIN="staging."
fi
CADDY_DOMAIN="${STAGING_SUBDOMAIN}${DOMAIN}"

# Bloc Caddy à ajouter
CADDY_BLOCK=$(cat <<EOF

# ─── ${APP} (${CADDY_DOMAIN}) ───
${CADDY_DOMAIN} {
    encode zstd gzip

    @webhook path /webhook /health
    handle @webhook {
        reverse_proxy 127.0.0.1:${WEBHOOK_PORT}
    }

    handle {
        reverse_proxy 127.0.0.1:${PORT} {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    log {
        output file /var/log/caddy/${APP}-access.log {
            roll_size 100mb
            roll_keep 5
            roll_keep_for 720h
        }
        level INFO
    }
}
EOF
)

if $DRY_RUN; then
  echo "[DRY-RUN] Bloc Caddy à ajouter dans /etc/caddy/Caddyfile :"
  echo "$CADDY_BLOCK"
else
  CADDY_FILE="/etc/caddy/${APP}.conf"
  ssh_exec "echo \"$CADDY_BLOCK\" | sudo tee $CADDY_FILE > /dev/null"

  # Ajouter l'import dans le Caddyfile principal si pas déjà présent
  ssh_exec "sudo grep -q \"import ${APP}.conf\" /etc/caddy/Caddyfile || sudo sed -i '/^}$/i \  import ${APP}.conf' /etc/caddy/Caddyfile"

  # Valider + reload
  ssh_exec "sudo caddy validate --config /etc/caddy/Caddyfile 2>&1 | tail -3"
  ssh_exec "sudo systemctl reload caddy"
fi

# ---------- Démarrage du webhook ----------
echo ""
echo "→ Démarrage du webhook service"
ssh_exec "sudo systemctl daemon-reload && sudo systemctl enable --now ${APP}-webhook.service && sleep 2"
ssh_exec "sudo systemctl is-active ${APP}-webhook.service | head -1"

# ---------- Instructions finales ----------
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Setup terminé pour ${APP} !"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 Configuration :"
echo "   Domaine    : https://${CADDY_DOMAIN}"
echo "   Webhook URL: https://${CADDY_DOMAIN}/webhook"
echo "   Healthcheck: https://${CADDY_DOMAIN}/health"
echo "   Branche    : $BRANCH"
echo ""
echo "🔐 Secret HMAC (à coller dans GitHub webhook) :"
echo "   $SECRET"
echo ""
echo "🌐 Prochaines étapes côté GitHub :"
echo "   1. Ouvre : https://github.com/$(echo $REPO | sed 's|https://github.com/||; s|\.git$||')/settings/hooks/new"
echo "   2. Payload URL : https://${CADDY_DOMAIN}/webhook"
echo "   3. Content type : application/json"
echo "   4. Secret : (le secret ci-dessus)"
echo "   5. Events : Just the 'push' event"
echo "   6. Add webhook"
echo ""
echo "🧪 Test :"
echo "   ssh $VPS_HOST 'sudo journalctl -u ${APP}-webhook -f'"
echo "   # Puis sur ton poste :"
echo "   cd /chemin/vers/${APP}"
echo "   git commit --allow-empty -m 'test deploy'"
echo "   git push origin $BRANCH"
echo ""
echo "📝 Tu dois aussi créer /opt/${APP}/.env avec tes variables de production :"
echo "   ssh $VPS_HOST 'sudo nano /opt/${APP}/.env'"
echo ""
echo "   Contenu attendu (exemple) :"
echo "   PORT=${PORT}"
echo "   DATABASE_URL=..."
echo "   API_KEY=..."
echo "   (chmod 600 après création)"
echo ""
echo "════════════════════════════════════════════════════════════"