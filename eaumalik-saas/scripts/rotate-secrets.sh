#!/usr/bin/env bash
# ============================================================================
# rotate-secrets.sh — Rotation complète des secrets EAUMALIK
# ============================================================================
# Usage :
#   ssh smartserveur 'sudo bash /opt/eaumalik/scripts/rotate-secrets.sh'
#
# Ce script :
#   1. Backup de l'ancien /opt/eaumalik/.env
#   2. Patch les clés Supabase (anon, service_role) + CAPTCHA_SECRET
#   3. Patch le JWT secret dans /opt/smartefp-supabase-prod/_stack/.env
#   4. Redémarre auth-prod puis eaumalik-app
#   5. Vérifie que /, /login, /api/auth/captcha répondent 200
#
# PRÉ-REQUIS : avoir généré les nouvelles clés depuis le dashboard Supabase
# (Settings → API → Generate new anon/service_role/JWT secret).
# Les valeurs sont saisies interactivement (lues au clavier, JAMAIS passées
# en argument ni via echo).
# ============================================================================
set -euo pipefail

ENV_FILE="/opt/eaumalik/.env"
SUPABASE_ENV="/opt/smartefp-supabase-prod/_stack/.env"
BACKUP_DIR="/opt/eaumalik/.env-backups"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE introuvable" >&2; exit 1
fi
if [[ ! -f "$SUPABASE_ENV" ]]; then
  echo "⚠️  $SUPABASE_ENV introuvable — skip de l'étape JWT secret" >&2
  SKIP_JWT=1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$BACKUP_DIR/.env.bak.$TIMESTAMP"
cp -a "$ENV_FILE" "$BACKUP"
chmod 600 "$BACKUP"
echo "✅ Backup créé : $BACKUP"

echo ""
echo "📋 Saisis les nouvelles valeurs (elles ne s'afficheront PAS à l'écran)."
echo "   Récupère-les depuis https://app.supabase.com → Settings → API"
echo ""

read -r -s -p "Nouvelle NEXT_PUBLIC_SUPABASE_ANON_KEY : " NEW_ANON; echo
read -r -s -p "Nouvelle SUPABASE_SERVICE_ROLE_KEY     : " NEW_SR; echo
read -r -s -p "Nouveau CAPTCHA_SECRET (openssl rand -hex 32) : " NEW_CAPTCHA; echo
echo ""

# Validation basique
if [[ ${#NEW_ANON} -lt 100 ]]; then
  echo "❌ anon key trop courte (attendu JWT ~150+ chars)" >&2; exit 1
fi
if [[ ${#NEW_SR} -lt 100 ]]; then
  echo "❌ service_role key trop courte" >&2; exit 1
fi
if [[ ${#NEW_CAPTCHA} -lt 32 ]]; then
  echo "❌ CAPTCHA_SECRET trop court (min 32 chars)" >&2; exit 1
fi

# Patch /opt/eaumalik/.env
sed -i \
  -e "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEW_ANON}|" \
  -e "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${NEW_SR}|" \
  -e "s|^CAPTCHA_SECRET=.*|CAPTCHA_SECRET=${NEW_CAPTCHA}|" \
  "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "✅ /opt/eaumalik/.env patché (anon + service_role + CAPTCHA_SECRET)"

# Patch JWT secret si dispo
if [[ -z "${SKIP_JWT:-}" ]]; then
  read -r -s -p "Nouveau GOTRUE_JWT_SECRET (depuis Supabase Settings → API → JWT Secret) : " NEW_JWT; echo
  if [[ ${#NEW_JWT} -lt 32 ]]; then
    echo "❌ JWT secret trop court" >&2; exit 1
  fi
  cp -a "$SUPABASE_ENV" "${SUPABASE_ENV}.bak.$TIMESTAMP"
  sed -i "s|^GOTRUE_JWT_SECRET=.*|GOTRUE_JWT_SECRET=${NEW_JWT}|" "$SUPABASE_ENV"
  chmod 600 "$SUPABASE_ENV"
  echo "✅ $SUPABASE_ENV patché (JWT secret)"
fi

echo ""
echo "═══ Redémarrage des services ═══"
if [[ -z "${SKIP_JWT:-}" ]]; then
  sudo docker restart auth-prod
  echo "  auth-prod restarted, attente..."
  sleep 8
fi
sudo docker restart eaumalik-app
echo "  eaumalik-app restarted, attente..."
sleep 8

echo ""
echo "═══ Vérifications ═══"
sudo docker inspect --format "eaumalik-app health: {{.State.Health.Status}}" eaumalik-app
sudo docker inspect --format "auth-prod running : {{.State.Running}}" auth-prod
echo ""
curl -fsS -m 5 -o /dev/null -w "  /                    → HTTP %{http_code}\n" https://eaumalik.com/
curl -fsS -m 5 -o /dev/null -w "  /login               → HTTP %{http_code}\n" https://eaumalik.com/login
curl -fsS -m 5 -o /dev/null -w "  /api/auth/captcha    → HTTP %{http_code}\n" https://eaumalik.com/api/auth/captcha
curl -fsS -m 5 -o /dev/null -w "  /login/mot-de-passe-oublie → HTTP %{http_code}\n" https://eaumalik.com/login/mot-de-passe-oublie

echo ""
echo "✅ Rotation terminée."
echo "   Backup : $BACKUP"
echo "   ⚠️  IMPORTANT : édite aussi le secret GitHub 'ENV_PROD' sinon le prochain deploy écrasera ces changements."
echo "   ⚠️  Stocker les nouvelles clés dans Bitwarden (coffre EAUMALIK-PROD)."