---
name: vps-webhook-deploy
description: Déployer automatiquement une application web (Next.js, Node.js, etc.) sur le VPS SmartServeur (Contabo) via un webhook GitHub simple — sans GitHub Actions, sans runners, sans tokens. Approche Vercel-like : push sur main → déploiement en 1-3 min.
---

# 🚀 VPS Webhook Deploy — Pattern réutilisable

## Quand utiliser cette skill

- Application web à déployer sur le VPS (`164.68.97.103`)
- Domaine pointe déjà sur Caddy (`smartefp.com`, `younesoumalik.smartefp.com`, etc.)
- Tu veux du **Vercel/Hostinger-like** : `git push origin main` → site mis à jour en 1-3 min
- Tu ne veux **pas** gérer de runner, token GitHub, ou minutes GitHub consommées

## Architecture

```
git push origin main
       ↓
GitHub → POST https://DOMAIN/webhook (HMAC SHA-256 signé)
       ↓
Caddy reverse_proxy vers 127.0.0.1:9000
       ↓
Webhook receiver Node.js (systemd)
   ├─ vérifie signature
   ├─ vérifie ref = refs/heads/main
   └─ lance deploy-on-push.sh en background
       ↓
git fetch + reset --hard SHA
       ↓
docker build → docker run → healthcheck → smoke test
       ↓
✅ Site mis à jour
```

## Fichiers à copier-coller (4 fichiers)

### 1. `infra/webhook/server.js` — Receiver HTTP

```javascript
#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PORT = 9000;
const WEBHOOK_SECRET_FILE = '/etc/eaumalik/webhook-secret';
const DEPLOY_SCRIPT = '/opt/eaumalik/deploy-on-push.sh';
const LOG_FILE = '/var/log/eaumalik-webhook.log';

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  process.stdout.write(line);
  try { appendFileSync(LOG_FILE, line); } catch {}
}

function loadSecret() {
  if (!existsSync(WEBHOOK_SECRET_FILE)) {
    log('ERROR', `Secret file missing: ${WEBHOOK_SECRET_FILE}`);
    process.exit(1);
  }
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
    res.end(JSON.stringify({ status: 'ok', service: 'webhook' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    if (!verifySignature(loadSecret(), req.headers['x-hub-signature-256'], rawBody)) {
      log('WARN', `Invalid signature from ${req.socket.remoteAddress}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }

    const event = req.headers['x-github-event'];
    if (event !== 'push') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', event }));
      return;
    }

    let payload;
    try { payload = JSON.parse(rawBody); } catch { res.writeHead(400).end('{}'); return; }

    if (payload.ref !== 'refs/heads/main') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', ref: payload.ref }));
      return;
    }

    const sha = (payload.after || '').slice(0, 7);
    const pusher = payload.pusher?.name || 'unknown';
    log('INFO', `Deploy requested by ${pusher} (commit ${sha})`);

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'deploying', sha }));

    const child = spawn('bash', [DEPLOY_SCRIPT, sha], {
      env: { ...process.env, DEPLOY_SHA: sha, DEPLOY_PUSHER: pusher },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.unref();

    child.stdout.on('data', (d) => log('DEPLOY', `[stdout] ${d.toString().trim()}`));
    child.stderr.on('data', (d) => log('DEPLOY', `[stderr] ${d.toString().trim()}`));
    child.on('exit', (code) => log(code === 0 ? 'INFO' : 'ERROR', `Deploy ${sha} exit=${code}`));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => log('INFO', `Webhook listening on :${PORT}`));
```

### 2. `infra/webhook/deploy-on-push.sh` — Script de déploiement

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============ VARIABLES À ADAPTER ============
APP_NAME="<APP>"                  # ex: portfolio, app, blog
IMAGE_NAME="<APP>-image"
CONTAINER_NAME="${APP_NAME}-app"
NETWORK_NAME="<NETWORK>"          # ex: supabase-prod-net OU vide (= bridge par défaut)
SERVER_DIR="/opt/${APP_NAME}"
REPO_DIR="${SERVER_DIR}/repo"
APP_DIR="${REPO_DIR}"             # adapter si monorepo
ENV_FILE="${SERVER_DIR}/.env"
PORT="${PORT:-3000}"
# ============================================

SHA="${1:-${DEPLOY_SHA:-unknown}}"
BUILD_TAG="${SHA:0:7}-$(date +%Y%m%d-%H%M%S)"
LOG_DIR="/var/log/${APP_NAME}-deploy"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== DEPLOY $APP_NAME ==="
echo "SHA: $SHA  Tag: $BUILD_TAG"

[[ -d "$REPO_DIR" ]] || { echo "❌ Repo absent: $REPO_DIR"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "❌ .env absent: $ENV_FILE"; exit 1; }

cd "$REPO_DIR"
git fetch origin main --quiet
git reset --hard "$SHA" --quiet

cd "$APP_DIR"
DOCKER_BUILDKIT=1 docker build \
  --build-arg "CACHE_BUST=$(date +%s)" \
  --tag "${IMAGE_NAME}:${BUILD_TAG}" \
  --tag "${IMAGE_NAME}:latest" .

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  ${NETWORK_NAME:+--network "$NETWORK_NAME"} \
  --env-file "$ENV_FILE" \
  -e HOSTNAME=0.0.0.0 \
  -e PORT="$PORT" \
  -p "127.0.0.1:${PORT}:${PORT}" \
  --log-driver json-file \
  --log-opt max-size=20m \
  --log-opt max-file=5 \
  "${IMAGE_NAME}:${BUILD_TAG}"

for i in $(seq 1 30); do
  STATUS=$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo 'starting')
  echo "[$i/30] $STATUS"
  [[ "$STATUS" == "healthy" ]] && break
  [[ $i -eq 30 ]] && { docker logs "$CONTAINER_NAME" --tail 30; exit 1; }
  sleep 2
done

HTTP=$(curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" 2>/dev/null || echo "000")
[[ "$HTTP" == "200" ]] || { docker logs "$CONTAINER_NAME" --tail 30; exit 1; }

echo "✅ Deploy OK"
```

### 3. `infra/webhook/<APP>-webhook.service` — Unit systemd

```ini
[Unit]
Description=<APP> GitHub Webhook Receiver
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=younes
Group=docker
WorkingDirectory=/opt/<APP>/webhook
ExecStart=/usr/bin/node /opt/<APP>/webhook/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=<APP>-webhook
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=false
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 4. `infra/webhook/install.sh` — Installateur one-shot

```bash
#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -ne 0 ]] && { echo "❌ Run as root"; exit 1; }

APP="$1"        # ex: portfolio, app, blog
DOMAIN="$2"     # ex: younesoumalik.smartefp.com
REPO_URL="$3"   # ex: https://github.com/YounesOumalik/portfolio.git
PORT="${4:-3000}"
SECRET_FILE="/etc/eaumalik/${APP}-webhook-secret"
SERVER_DIR="/opt/${APP}"

mkdir -p "$SERVER_DIR/webhook" /etc/eaumalik /var/log/${APP}-webhook.log /var/log/${APP}-deploy
chmod 755 /var/log/${APP}-webhook.log /var/log/${APP}-deploy

[[ -d "${SERVER_DIR}/repo" ]] || git clone "$REPO_URL" "${SERVER_DIR}/repo"

cp "$(dirname "$0")/server.js" "${SERVER_DIR}/webhook/"
cp "$(dirname "$0")/deploy-on-push.sh" "${SERVER_DIR}/deploy-on-push.sh"
cp "$(dirname "$0")/${APP}-webhook.service" /etc/systemd/system/
chmod +x "${SERVER_DIR}/deploy-on-push.sh" "${SERVER_DIR}/webhook/server.js"

if [[ ! -f "$SECRET_FILE" ]]; then
  openssl rand -hex 32 > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
fi

systemctl daemon-reload
systemctl enable --now "${APP}-webhook.service"

echo ""
echo "════════════════════════════════════════════"
echo "✅ Webhook installé"
echo ""
echo "Prochaines étapes :"
echo "  1. Ajouter dans /etc/caddy/Caddyfile :"
echo "     ${DOMAIN} {"
echo "         @webhook path /webhook /health"
echo "         handle @webhook { reverse_proxy 127.0.0.1:9000 }"
echo "         handle { reverse_proxy 127.0.0.1:${PORT} }"
echo "     }"
echo ""
echo "  2. sudo systemctl reload caddy"
echo ""
echo "  3. GitHub → Settings → Webhooks → Add :"
echo "     URL    : https://${DOMAIN}/webhook"
echo "     Secret : \$(cat $SECRET_FILE)"
echo "════════════════════════════════════════════"
```

## Variables à adapter par projet

| Variable | Défaut eaumalik | Où |
|----------|-----------------|-----|
| `APP` | `eaumalik` | deploy script, systemd |
| `IMAGE_NAME` | `${APP}-image` | deploy script |
| `CONTAINER_NAME` | `${APP}-app` | deploy script |
| `NETWORK_NAME` | (vide = bridge par défaut) | deploy script |
| `DOMAIN` | `younesoumalik.smartefp.com` | install.sh, Caddy |
| `REPO_URL` | GitHub repo URL | install.sh |
| `PORT` | `3000` (Next.js) ou `3100` (eaumalik) | deploy script |
| `WEBHOOK_PORT` | `9000` | server.js |
| `SECRET_FILE` | `/etc/eaumalik/${APP}-webhook-secret` | server.js, install.sh |

## Checklist installation nouveau projet

- [ ] Créer le dossier `infra/webhook/` dans le repo
- [ ] Copier les 4 fichiers (server.js, deploy-on-push.sh, *.service, install.sh)
- [ ] Adapter les variables (APP, IMAGE_NAME, DOMAIN, REPO_URL, PORT)
- [ ] Sur le VPS : `cd /opt && bash install.sh <app> <domain> <repo-url> <port>`
- [ ] Ajouter le bloc Caddy + `systemctl reload caddy`
- [ ] Sur GitHub : Settings → Webhooks → Add (URL + secret)
- [ ] Test : `git commit --allow-empty -m test && git push origin main`
- [ ] Vérifier : `journalctl -u <app>-webhook -f` + `https://<domain>/`

## Configuration Caddy (template)

```caddy
DOMAIN {
    encode zstd gzip

    @webhook path /webhook /health
    handle @webhook {
        reverse_proxy 127.0.0.1:9000
    }

    handle {
        reverse_proxy 127.0.0.1:PORT {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    log {
        output file /var/log/caddy/APP-access.log {
            roll_size 100mb
            roll_keep 5
            roll_keep_for 720h
        }
        level INFO
    }
}
```

## Troubleshooting

| Symptôme | Cause | Fix |
|----------|-------|-----|
| 401 Invalid signature | Secret désynchronisé | Vérifier `/etc/eaumalik/<app>-webhook-secret` = celui configuré dans GitHub |
| `cannot open .git/FETCH_HEAD: Read-only file system` | `ProtectSystem=strict` dans systemd | Passer à `ProtectSystem=full` et `ProtectHome=false` |
| `EACCES: permission denied, mkdir '/app/data-store'` | Dockerfile standalone ne crée pas data-store | Ajouter `RUN mkdir -p /app/data-store && chown -R nextjs:nodejs /app/data-store` |
| `Connection reset by peer` sur / | Server standalone écoute sur 127.0.0.1 | Ajouter `-e HOSTNAME=0.0.0.0` dans deploy-on-push.sh |
| `npm ci` fail (no lockfile) | `package-lock.json` gitignoré | Remplacer `npm ci` par `npm install` dans Dockerfile |
| Container unhealthy | Crash app | `docker logs <app>-app --tail 50` |

## Avantages vs autres approches

- ✅ **0 token** (HMAC seulement)
- ✅ **0 runner** à maintenir
- ✅ **0 minute GitHub** consommée
- ✅ **Vercel-like** : push = deploy
- ✅ **Logs locaux** : journald + fichiers `/var/log/<app>-deploy/`
- ✅ **Rollback simple** : 3 derniers tags conservés

## Limitations

- ❌ Pas d'UI GitHub intégrée (pas de badge sur le commit)
- ❌ Pas de matrice multi-OS / multi-arch
- ❌ Pas de tests automatisés avant deploy (à ajouter dans deploy-on-push.sh si besoin)
- ❌ 1 seul webhook par projet (pas de staging séparé)