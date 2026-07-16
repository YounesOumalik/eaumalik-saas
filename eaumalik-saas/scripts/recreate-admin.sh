#!/usr/bin/env bash
# ============================================================================
# recreate-admin.sh — Recréer un superadmin après reset DB
# ============================================================================
# Usage :
#   ssh smartserveur
#   sudo /opt/eaumalik/scripts/recreate-admin.sh
#
# Le mot de passe est saisi de manière masquée (read -s, ne s'affiche pas).
# Après création, le MDP est affiché UNE FOIS pour que tu puisses le noter
# (ou le stocker dans Bitwarden immédiatement).
# ============================================================================
set -euo pipefail

# Charge le module Bitwarden
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./bitwarden-push.sh
source "$SCRIPT_DIR/bitwarden-push.sh"
bw_check

ENV_FILE="/opt/smartefp-supabase-prod/_stack/.env"
# IMPORTANT : on tape DIRECTEMENT sur auth-prod via son IP Docker (10.0.5.7)
# car Kong ne route pas correctement /auth/v1/admin/users (HTTP 502).
# On passe par un container (eaumalik-app) qui a accès au réseau Docker et aux outils curl/wget.
SUPABASE_URL="http://10.0.5.7:9999"
API_CONTAINER="eaumalik-app"
API_CMD="wget"  # eaumalik-app a wget (Alpine-based Next.js standalone)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE introuvable" >&2
  exit 1
fi

SR_KEY=$(sudo grep "^SERVICE_ROLE_KEY=" "$ENV_FILE" | cut -d= -f2-)
if [[ -z "$SR_KEY" ]]; then
  echo "❌ SERVICE_ROLE_KEY absente du .env" >&2
  exit 1
fi

# Email par défaut (correspond à l'ancien admin)
ADMIN_EMAIL="${ADMIN_EMAIL:-supadmin@gmail.com}"
read -r -p "Email admin [$ADMIN_EMAIL] : " input
ADMIN_EMAIL="${input:-$ADMIN_EMAIL}"

# Mot de passe (saisi masqué)
while true; do
  read -r -s -p "Mot de passe (min 8, 1 maj, 1 chiffre) : " ADMIN_PASSWORD
  echo ""
  if [[ ${#ADMIN_PASSWORD} -ge 8 ]] && [[ "$ADMIN_PASSWORD" =~ [A-Z] ]] && [[ "$ADMIN_PASSWORD" =~ [0-9] ]]; then
    break
  fi
  echo "❌ Mot de passe invalide. Recommence."
done

# Confirmation
read -r -s -p "Confirme le mot de passe : " ADMIN_PASSWORD_CONFIRM
echo ""
if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
  echo "❌ Les mots de passe ne correspondent pas." >&2
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Création de $ADMIN_EMAIL"
echo "═══════════════════════════════════════════════════════"
echo ""

# 1. Création dans auth.users via l'API admin (depuis le container eaumalik-app)
echo "→ 1/3 Création user auth..."
RESP=$(sudo docker exec "$API_CONTAINER" "$API_CMD" -qO- --post-data="{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Administrateur EAUMALIK\",\"role\":\"admin\"}}" \
  --header="apikey: ${SR_KEY}" \
  --header="Authorization: Bearer ${SR_KEY}" \
  --header="Content-Type: application/json" \
  "${SUPABASE_URL}/admin/users" 2>&1)
USER_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or '')" 2>/dev/null)
if [[ -z "$USER_ID" ]]; then
  echo "  ❌ Erreur API admin: $RESP"
  exit 1
fi
echo "  ✅ user_id = $USER_ID"

# 2. Insertion dans eaumalik.users avec role=admin
echo ""
echo "→ 2/3 Promotion en admin dans eaumalik.users..."
sudo docker exec db-prod psql -U postgres <<EOF >/dev/null
INSERT INTO eaumalik.users (id, email, full_name, role)
VALUES ('${USER_ID}', '${ADMIN_EMAIL}', 'Administrateur EAUMALIK', 'admin')
ON CONFLICT (email) DO UPDATE
  SET role = 'admin',
      full_name = 'Administrateur EAUMALIK',
      updated_at = now();
EOF
echo "  ✅"

# 3. Vérification
echo ""
echo "→ 3/3 Vérification..."
sudo docker exec db-prod psql -U postgres -c "SELECT u.id, u.email, u.role, u.full_name, u.created_at FROM eaumalik.users u WHERE u.email = '${ADMIN_EMAIL}';" 2>&1 | head -5

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ ADMIN CRÉÉ : ${ADMIN_EMAIL}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  → Connecte-toi sur https://eaumalik.com/login"
echo ""
echo "  ╔════════════════════════════════════════════════════╗"
echo "  ║  MOT DE PASSE (affiché 1 fois, NOTE-LE) :        ║"
echo "  ║                                                    ║"
echo "  ║  ${ADMIN_PASSWORD}"
echo "  ║                                                    ║"
echo "  ╚════════════════════════════════════════════════════╝"
echo ""
echo "  ⚠️  Stocke-le MAINTENANT dans Bitwarden (coffre EAUMALIK-PROD)."
echo "  ⚠️  Ne le colle PAS dans le chat."

# ---------- Push vers Bitwarden ----------
bw_push_secrets_from_env <<EOF
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
bw_print_commands