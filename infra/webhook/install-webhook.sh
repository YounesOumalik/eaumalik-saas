#!/usr/bin/env bash
# ============================================================================
# EAUMALIK — Installation complète du webhook receiver
#
# Une seule fois sur le VPS. Crée :
#   - /opt/eaumalik/webhook/ (code Node.js)
#   - /opt/eaumalik/repo/      (clone GitHub)
#   - /opt/eaumalik/.env       (env de production)
#   - /etc/eaumalik/webhook-secret (HMAC secret partagé avec GitHub)
#   - /etc/systemd/system/eaumalik-webhook.service
# ============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "❌ Doit être exécuté en root (sudo $0 …)"
  exit 1
fi

SERVER_DIR="/opt/eaumalik"
WEBHOOK_DIR="${SERVER_DIR}/webhook"
REPO_DIR="${SERVER_DIR}/repo"
SECRET_FILE="/etc/eaumalik/webhook-secret"
REPO_URL="https://github.com/YounesOumalik/eaumalik-saas.git"

echo "▶ Installation webhook EAUMALIK"

# ---------- 1. Dossiers ----------
mkdir -p "$SERVER_DIR" "$WEBHOOK_DIR" /etc/eaumalik \
         /var/log/eaumalik-webhook.log /var/log/eaumalik-deploy
chmod 755 /var/log/eaumalik-webhook.log /var/log/eaumalik-deploy

# ---------- 2. Clone du repo (si pas déjà présent) ----------
if [[ ! -d "$REPO_DIR" ]]; then
  echo "→ Clone du repo $REPO_URL"
  git clone --branch main "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
  git config --global --add safe.directory "$REPO_DIR"
else
  echo "→ Repo déjà présent : $REPO_DIR"
fi

# ---------- 3. Copie du webhook code + deploy script ----------
echo "→ Copie du webhook + script deploy"
cp "$(dirname "$0")/server.js" "$WEBHOOK_DIR/server.js"
cp "$(dirname "$0")/deploy-on-push.sh" "${SERVER_DIR}/deploy-on-push.sh"
cp "$(dirname "$0")/package.json" "$WEBHOOK_DIR/package.json"
cp "$(dirname "$0")/eaumalik-webhook.service" /etc/systemd/system/

chmod +x "${SERVER_DIR}/deploy-on-push.sh"
chmod 755 "$WEBHOOK_DIR"

# ---------- 4. Génération du webhook secret (si absent) ----------
if [[ ! -f "$SECRET_FILE" ]]; then
  echo "→ Génération du secret HMAC (32 bytes hex)"
  openssl rand -hex 32 > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "  Secret stocké dans $SECRET_FILE"
else
  echo "→ Secret déjà présent : $SECRET_FILE"
fi

# ---------- 5. .env (à remplir manuellement si pas déjà fait) ----------
if [[ ! -f "${SERVER_DIR}/.env" ]]; then
  echo ""
  echo "⚠️  Le fichier ${SERVER_DIR}/.env est absent."
  echo "    Tu dois le créer à partir de .env.prod :"
  echo "      scp eaumalik-saas/.env.prod smartserveur:/tmp/.env.prod"
  echo "      ssh smartserveur 'sudo mv /tmp/.env.prod ${SERVER_DIR}/.env && sudo chmod 600 ${SERVER_DIR}/.env && sudo chown root:root ${SERVER_DIR}/.env'"
fi

# ---------- 6. systemd ----------
systemctl daemon-reload
systemctl enable eaumalik-webhook.service
systemctl restart eaumalik-webhook.service

sleep 2

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ Webhook installé et démarré"
echo ""
echo "Prochaines étapes :"
echo "  1. Vérifier que .env est en place :"
echo "     ls -la ${SERVER_DIR}/.env"
echo ""
echo "  2. Configurer le webhook GitHub :"
echo "     https://github.com/YounesOumalik/eaumalik-saas/settings/hooks/new"
echo "     - Payload URL : http://164.68.97.103:9000/webhook"
echo "     - Content type: application/json"
echo "     - Secret : $(cat "$SECRET_FILE")"
echo "     - SSL verification : enable (recommander si reverse proxy HTTPS)"
echo "     - Which events : Just the 'push' event"
echo "     - Active : ✓"
echo ""
echo "  3. Tester :"
echo "     curl http://164.68.97.103:9000/health"
echo "     # → {\"status\":\"ok\",\"service\":\"eaumalik-webhook\"}"
echo ""
echo "  4. Premier push :"
echo "     git push origin main"
echo "     # → logs en direct : journalctl -u eaumalik-webhook -f"
echo "═══════════════════════════════════════════════"