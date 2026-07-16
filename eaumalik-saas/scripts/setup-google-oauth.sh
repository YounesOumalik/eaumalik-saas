#!/usr/bin/env bash
# ============================================================
# setup-google-oauth.sh
# Configure Google OAuth sur le stack Supabase self-hosted (auth-prod)
# et exécute la migration 0009 (capture google_id + vue profil complet).
#
# À exécuter UNE FOIS sur smartserveur (root) :
#   ssh smartserveur 'sudo bash /opt/eaumalik/scripts/setup-google-oauth.sh'
#
# Le script demande interactivement :
#   - Google Client ID
#   - Google Client Secret
#
# Effet :
#   1. Backup de /opt/smartefp-supabase-prod/_stack/.env
#   2. Ajoute les vars GOTRUE_EXTERNAL_GOOGLE_*
#   3. Exécute supabase/migrations/0009_google_oauth.sql sur db-prod
#   4. Restart auth-prod
#   5. Vérifie /auth/v1/health
# ============================================================

set -euo pipefail

STACK_ENV="/opt/smartefp-supabase-prod/_stack/.env"
MIGRATION_LOCAL="supabase/migrations/0009_google_oauth.sql"
MIGRATION_REMOTE="/tmp/0009_google_oauth.sql"

# ---------- Garde-fous ----------
if [[ $EUID -ne 0 ]]; then
  echo "[!] Ce script doit être lancé en root : sudo bash $0"
  exit 1
fi

if [[ ! -f "$STACK_ENV" ]]; then
  echo "[!] Stack env introuvable : $STACK_ENV"
  exit 1
fi

# ---------- Demande des identifiants Google ----------
echo "=== Configuration Google OAuth pour auth-prod ==="
echo
echo "Google Client ID (xxxxx.apps.googleusercontent.com) :"
read -r GOOGLE_CLIENT_ID
echo
echo "Google Client Secret :"
read -r -s GOOGLE_CLIENT_SECRET
echo

if [[ -z "$GOOGLE_CLIENT_ID" || -z "$GOOGLE_CLIENT_SECRET" ]]; then
  echo "[!] Client ID et Secret sont obligatoires."
  exit 1
fi

# ---------- Backup ----------
TS="$(date +%Y%m%d-%H%M%S)"
cp -a "$STACK_ENV" "${STACK_ENV}.bak.pre-google-oauth.${TS}"
echo "[OK] Backup créé : ${STACK_ENV}.bak.pre-google-oauth.${TS}"

# ---------- Patch du .env (Python, compatible BusyBox) ----------
python3 - "$STACK_ENV" "$GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_SECRET" <<'PY'
import sys, pathlib

env_path = pathlib.Path(sys.argv[1])
client_id = sys.argv[2]
client_secret = sys.argv[3]

content = env_path.read_text()
lines = content.splitlines()
keys_to_set = {
    "GOTRUE_EXTERNAL_GOOGLE_ENABLED": "true",
    "GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID": client_id,
    "GOTRUE_EXTERNAL_GOOGLE_SECRET": client_secret,
    "GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI": "https://db-dev.smartefp.com/auth/v1/callback",
}

present = set()
for i, line in enumerate(lines):
    for k in list(keys_to_set):
        if line.startswith(f"{k}=") or line.startswith(f"#{k}="):
            lines[i] = f"{k}={keys_to_set[k]}"
            present.add(k)

for k, v in keys_to_set.items():
    if k not in present:
        lines.append(f"{k}={v}")

env_path.write_text("\n".join(lines) + "\n")
print("[OK] .env patché avec GOTRUE_EXTERNAL_GOOGLE_*")
PY

chmod 600 "$STACK_ENV"

# ---------- Transfert + exécution de la migration SQL ----------
echo "[..] Copie de la migration 0009 vers le VPS"
if [[ -f "$MIGRATION_LOCAL" ]]; then
  cp "$MIGRATION_LOCAL" "$MIGRATION_REMOTE"
else
  echo "[!] Migration locale introuvable : $MIGRATION_LOCAL"
  echo "    Téléversez-la manuellement puis exécutez :"
  echo "    docker exec -i db-prod psql -U postgres -d postgres -f $MIGRATION_REMOTE"
  exit 1
fi

echo "[..] Exécution de la migration sur db-prod"
docker exec -i db-prod psql -U postgres -d postgres -f "$MIGRATION_REMOTE" \
  && echo "[OK] Migration 0009 appliquée" \
  || echo "[!] Échec migration — vérifiez db-prod"

# ---------- Restart auth-prod ----------
echo "[..] Restart auth-prod"
cd /opt/smartefp-supabase-prod/_stack
docker compose restart auth-prod

# ---------- Vérification health ----------
echo "[..] Vérification /auth/v1/health"
for i in $(seq 1 10); do
  if curl -sf https://db-dev.smartefp.com/auth/v1/health >/dev/null 2>&1; then
    echo "[OK] auth-prod répond 200 sur /auth/v1/health"
    break
  fi
  sleep 3
done

echo
echo "=== Terminé ==="
echo "Client ID : $GOOGLE_CLIENT_ID"
echo "Redirection : https://db-dev.smartefp.com/auth/v1/callback"
echo "Test : /login → Continuer avec Google"
