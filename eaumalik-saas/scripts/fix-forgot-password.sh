#!/usr/bin/env bash
# ============================================================
# fix-forgot-password.sh
# Corrige la config SMTP GoTrue + redirect URLs sur le VPS.
# À exécuter UNE FOIS sur smartserveur (root).
#
# Usage :
#   ssh smartserveur 'sudo bash /opt/eaumalik/scripts/fix-forgot-password.sh'
#
# Pré-requis :
#   - Avoir une clé API Resend active pour le domaine eaumalik.com
#     (format : re_XXXXXXXXXXXXXXXXXX).
#   - Avoir ajouté les DNS SPF/DKIM/DMARC chez Contabo.
#
# Effet :
#   1. Backup de /opt/smartefp-supabase-prod/_stack/.env
#   2. Met à jour les vars GOTRUE_SMTP_* avec Resend
#   3. Met à jour GOTRUE_SITE_URL + GOTRUE_URI_ALLOW_LIST
#   4. Restart auth-prod
#   5. Vérifie que auth-prod lit bien la nouvelle config
#   6. Push de la clé Resend vers Bitwarden (si bw CLI dispo)
# ============================================================

set -euo pipefail

# Charge le module Bitwarden
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./bitwarden-push.sh
source "$SCRIPT_DIR/bitwarden-push.sh"
bw_check

STACK_ENV="/opt/smartefp-supabase-prod/_stack/.env"

# ---------- Garde-fous ----------
if [[ $EUID -ne 0 ]]; then
  echo "[!] Ce script doit être lancé en root : sudo bash $0"
  exit 1
fi

if [[ ! -f "$STACK_ENV" ]]; then
  echo "[!] Stack env introuvable : $STACK_ENV"
  exit 1
fi

# ---------- Demande de la clé API Resend ----------
echo "=== Configuration SMTP Resend pour auth-prod ==="
echo
echo "Clé API Resend (re_XXXX...) :"
read -r -s RESEND_KEY
echo
if [[ -z "$RESEND_KEY" || ! "$RESEND_KEY" =~ ^re_[A-Za-z0-9]+$ ]]; then
  echo "[!] Clé Resend invalide (doit commencer par re_)."
  exit 1
fi

# ---------- Backup ----------
TS="$(date +%Y%m%d-%H%M%S)"
cp -a "$STACK_ENV" "${STACK_ENV}.bak.pre-smtp-fix.${TS}"
echo "[OK] Backup créé : ${STACK_ENV}.bak.pre-smtp-fix.${TS}"

# ---------- Helpers d'édition (Python, sed ne gère pas \x27 sur BusyBox) ----------
python3 - "$STACK_ENV" "$RESEND_KEY" <<'PY'
import sys, re, pathlib

env_path = pathlib.Path(sys.argv[1])
resend_key = sys.argv[2]

content = env_path.read_text()

# Patch SMTP Resend
patches = {
    "GOTRUE_SMTP_HOST":          "smtp.resend.com",
    "GOTRUE_SMTP_PORT":          "465",
    "GOTRUE_SMTP_USER":          "resend",
    "GOTRUE_SMTP_PASS":          resend_key,
    "GOTRUE_SMTP_ADMIN_EMAIL":   "no-reply@eaumalik.com",
    "GOTRUE_SMTP_SENDER_NAME":   "EAUMALIK",
    "GOTRUE_SITE_URL":           "https://eaumalik.com",
    # Les liens de récupération sont utilisables 30 minutes et une seule fois.
    "GOTRUE_MAILER_OTP_EXP":     "1800",
    # Allow-list : on garde db-dev.smartefp.com ET on ajoute eaumalik.com
    "GOTRUE_URI_ALLOW_LIST":     "https://db-dev.smartefp.com,https://eaumalik.com,http://localhost:3000",
}

for key, val in patches.items():
    # Remplace la ligne si elle existe, sinon l'ajoute en fin de fichier.
    pattern = rf"^{re.escape(key)}=.*$"
    replacement = f"{key}={val}"
    if re.search(pattern, content, flags=re.MULTILINE):
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        print(f"[PATCH] {key} → {val if 'PASS' not in key else '***REDACTED***'}")
    else:
        content += f"\n{replacement}\n"
        print(f"[ADD]   {key} → {val if 'PASS' not in key else '***REDACTED***'}")

# Re-chmod 600
env_path.write_text(content)
env_path.chmod(0o600)
print("[OK] Fichier .env mis à jour (chmod 600).")
PY

# ---------- Restart auth-prod ----------
echo
echo "=== Restart auth-prod ==="
cd /opt/smartefp-supabase-prod
docker compose restart auth-prod
echo "[OK] auth-prod redémarré."

# ---------- Attente health ----------
echo
echo "=== Attente health (max 30s) ==="
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null -w "%{http_code}" https://db-dev.smartefp.com/auth/v1/health 2>/dev/null | grep -q 200; then
    echo "[OK] auth-prod healthy."
    break
  fi
  sleep 1
done

# ---------- Vérif env runtime ----------
echo
echo "=== Vérification env GoTrue runtime ==="
docker exec auth-prod env | grep -E "^GOTRUE_SMTP|^GOTRUE_SITE_URL|^GOTRUE_URI_ALLOW_LIST" \
  | sed -E "s/(PASS)=.*/\1=***REDACTED***/"

echo
echo "=== Terminé. ==="
echo "Prochaines étapes :"
echo "  1. Sur https://resend.com → Emails : vérifie qu'un test est passé."
echo "  2. Sur https://eaumalik.com/login/mot-de-passe-oublie : demande un reset pour younesoumalik@gmail.com."
echo "  3. Sur smartserveur, surveille : sudo docker logs auth-prod -f | grep -iE 'smtp|mail|email'"

# ---------- Push Bitwarden ----------
bw_push_secrets_from_env <<EOF
RESEND_API_KEY=$RESEND_KEY
EOF
bw_print_commands
