# filepath: eaumalik-saas/scripts/create-admin.sh
#!/usr/bin/env bash
# ============================================================================
# Crée le premier superadmin sur le Supabase du serveur.
# Pré-requis : l'app doit être déployée et db-prod accessible.
#
# Usage :
#   ADMIN_EMAIL=admin@eaumalik.com ADMIN_PASSWORD='STRONG_PWD' ./scripts/create-admin.sh
#
# Le mot de passe est saisi de manière interactive si absent de l'env.
# ============================================================================
set -euo pipefail

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@eaumalik.com}"
SERVER_HOST="${DEPLOY_HOST:-smartserveur}"

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  read -r -s -p "Mot de passe admin (min 8, 1 maj, 1 chiffre) : " ADMIN_PASSWORD
  echo
fi

if [[ ! "$ADMIN_PASSWORD" =~ ^[A-Za-z0-9]{8,}$ ]] \
   || ! [[ "$ADMIN_PASSWORD" =~ [A-Z] ]] \
   || ! [[ "$ADMIN_PASSWORD" =~ [0-9] ]]; then
  echo "❌ Mot de passe invalide (min 8, 1 majuscule, 1 chiffre)" >&2
  exit 1
fi

# Récupérer la service role key
SR_KEY=$(ssh "$SERVER_HOST" "docker exec auth-prod printenv GOTRUE_JWT_SECRET 2>/dev/null || true")
if [[ -z "$SR_KEY" ]]; then
  echo "❌ Impossible de récupérer la service role key sur le serveur" >&2
  exit 1
fi

SUPABASE_URL="https://db-dev.smartefp.com"

echo "[1/3] Création de l'utilisateur auth..."
curl -fsS -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SR_KEY}" \
  -H "Authorization: Bearer ${SR_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Administrateur EAUMALIK\",\"role\":\"admin\"}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  user_id =', d.get('id') or d)" \
  || { echo "❌ Échec création user (peut-être déjà existant, on continue)"; }

echo "[2/3] Promotion en admin (schéma eaumalik)..."
ssh "$SERVER_HOST" "docker exec -i db-prod psql -U postgres -c \"UPDATE eaumalik.users SET role='admin', updated_at=now() WHERE email='${ADMIN_EMAIL}';\""

echo "[3/3] Vérification..."
ssh "$SERVER_HOST" "docker exec db-prod psql -U postgres -c \"SELECT email, role, created_at FROM eaumalik.users WHERE email='${ADMIN_EMAIL}';\""

echo ""
echo "✅ Admin créé : ${ADMIN_EMAIL}"
echo "   → Connectez-vous sur https://eaumalik.com/login"
