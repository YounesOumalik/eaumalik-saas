#!/usr/bin/env bash
# ============================================================================
# rotate-all.sh — Rotation COMPLÈTE des secrets EAUMALIK (clé en main)
# ============================================================================
# Enchaîne :
#   1. Backup /opt/smartefp-supabase-prod/_stack/.env + /opt/eaumalik/.env
#   2. Régénère TOUS les secrets Supabase via generate-secrets.sh
#   3. Extrait automatiquement ANON_KEY + SERVICE_ROLE_KEY du nouveau .env
#   4. Patch /opt/eaumalik/.env (anon, service_role, CAPTCHA_SECRET)
#   5. Redémarre : auth-prod → db-prod → rest-prod → eaumalik-app
#   6. Vérifie end-to-end : HTTP 200 sur /, /login, /api/auth/captcha
#
# ⚠️  CE SCRIPT PROVOQUE LA DÉCONNEXION DE TOUS LES UTILISATEURS
#     (rotation du JWT_SECRET invalide toutes les sessions actives).
#
# Usage :
#   ssh smartserveur
#   sudo /opt/eaumalik/scripts/rotate-all.sh
#
# ⚠️  APRÈS : penser à mettre à jour le secret GitHub 'ENV_PROD' pour que
#     le prochain deploy n'écrase pas /opt/eaumalik/.env avec les anciennes clés.
# ============================================================================
set -euo pipefail

# Couleurs
RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'
log()  { printf '%b\n' "$*"; }
ok()   { printf '%b\n' "${GRN}✓${RST} $*"; }
warn() { printf '%b\n' "${YEL}⚠${RST}  $*"; }
step() { printf '%b\n' "${DIM}→${RST}  $*"; }
err()  { printf '%b\n' "${RED}✗${RST}  $*" >&2; }

SUPABASE_DIR="/opt/smartefp-supabase-prod"
STACK_ENV="$SUPABASE_DIR/_stack/.env"
APP_ENV="/opt/eaumalik/.env"
BACKUP_DIR="/opt/eaumalik/.env-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# ---------- 0. Vérifs préalables ----------
log "═══════════════════════════════════════════════════════════════"
log "  ROTATION COMPLÈTE DES SECRETS EAUMALIK"
log "  Timestamp : $TIMESTAMP"
log "═══════════════════════════════════════════════════════════════"
echo ""

command -v docker >/dev/null || { err "docker absent"; exit 1; }
[[ -d "$SUPABASE_DIR" ]] || { err "$SUPABASE_DIR introuvable"; exit 1; }
[[ -f "$SUPABASE_DIR/generate-secrets.sh" ]] || { err "generate-secrets.sh introuvable"; exit 1; }
[[ -f "$APP_ENV" ]] || { err "$APP_ENV introuvable"; exit 1; }

# Charge le module Bitwarden
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./bitwarden-push.sh
source "$SCRIPT_DIR/bitwarden-push.sh"
bw_check

log ""
warn "⚠️  Cette opération va :"
warn "   • Déconnecter TOUS les utilisateurs (JWT_SECRET changé)"
warn "   • Régénérer 16 secrets (JWT, anon, service_role, db password, ...)"
warn "   • Redémarrer 4 containers (auth-prod, db-prod, rest-prod, eaumalik-app)"
warn "   • Downtime estimé : 20-30 secondes"
echo ""
read -r -p "Continuer ? (o/N) " -n 1 -r
echo ""
[[ $REPLY =~ ^[oOyY]$ ]] || { err "Annulé."; exit 1; }

# ---------- 1. Backups ----------
log ""
step "1. Backups des .env actuels"
mkdir -p "$BACKUP_DIR"
SUPABASE_BACKUP="$BACKUP_DIR/supabase-stack.env.bak.$TIMESTAMP"
APP_BACKUP="$BACKUP_DIR/app.env.bak.$TIMESTAMP"
sudo cp -a "$STACK_ENV" "$SUPABASE_BACKUP"
sudo cp -a "$APP_ENV" "$APP_BACKUP"
sudo chmod 600 "$SUPABASE_BACKUP" "$APP_BACKUP"
ok "  → $SUPABASE_BACKUP"
ok "  → $APP_BACKUP"

# ---------- 2. Régénération secrets Supabase ----------
log ""
step "2. Régénération des secrets Supabase (generate-secrets.sh)"
cd "$SUPABASE_DIR"
# Pipe "o" pour auto-confirmer l'écrasement de _stack/.env
echo "o" | sudo bash ./generate-secrets.sh
ok "  → $STACK_ENV régénéré"

# ---------- 3. Extraction des nouvelles clés ----------
log ""
step "3. Extraction des nouvelles clés JWT"
NEW_ANON=$(sudo grep "^ANON_KEY=" "$STACK_ENV" | cut -d= -f2-)
NEW_SERVICE=$(sudo grep "^SERVICE_ROLE_KEY=" "$STACK_ENV" | cut -d= -f2-)
NEW_JWT_SECRET_LEN=$(sudo grep "^JWT_SECRET=" "$STACK_ENV" | cut -d= -f2- | tr -d '\n' | wc -c)
NEW_POSTGRES_PWD_LEN=$(sudo grep "^POSTGRES_PASSWORD=" "$STACK_ENV" | cut -d= -f2- | tr -d '\n' | wc -c)

# Validations
if [[ ${#NEW_ANON} -lt 100 ]]; then
  err "ANON_KEY invalide (trop courte: ${#NEW_ANON} chars)"; exit 1
fi
if [[ ${#NEW_SERVICE} -lt 100 ]]; then
  err "SERVICE_ROLE_KEY invalide (trop courte: ${#NEW_SERVICE} chars)"; exit 1
fi
ok "  → ANON_KEY (${#NEW_ANON} chars)"
ok "  → SERVICE_ROLE_KEY (${#NEW_SERVICE} chars)"
ok "  → JWT_SECRET ($NEW_JWT_SECRET_LEN chars)"
ok "  → POSTGRES_PASSWORD ($NEW_POSTGRES_PWD_LEN chars)"

# ---------- 4. Nouveau CAPTCHA_SECRET ----------
log ""
step "4. Génération d'un nouveau CAPTCHA_SECRET"
NEW_CAPTCHA=$(openssl rand -hex 32)
ok "  → CAPTCHA_SECRET (${#NEW_CAPTCHA} chars)"

# ---------- 5. Patch /opt/eaumalik/.env ----------
log ""
step "5. Patch de $APP_ENV"
sudo sed -i \
  -e "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEW_ANON}|" \
  -e "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${NEW_SERVICE}|" \
  -e "s|^CAPTCHA_SECRET=.*|CAPTCHA_SECRET=${NEW_CAPTCHA}|" \
  "$APP_ENV"
sudo chmod 600 "$APP_ENV"
ok "  → anon + service_role + CAPTCHA_SECRET mis à jour"

# ---------- 6. Redémarrage des containers ----------
log ""
step "6. Redémarrage des containers (ordre : auth-prod → db-prod → rest-prod → eaumalik-app)"

# 6a. auth-prod lit JWT_SECRET + ANON_KEY + SERVICE_ROLE_KEY
sudo docker restart auth-prod
log "  auth-prod → redémarrage en cours..."
sleep 6

# 6b. db-prod a un mot de passe changé : NE PAS redémarrer si la DB tourne !
#     (sinon : perte de connexion, le nouveau POSTGRES_PASSWORD ne sera pris en compte
#      qu'au prochain démarrage de db-prod + recréation du cluster)
#     → On garde db-prod tel quel : la nouvelle POSTGRES_PASSWORD sera effective au
#       prochain redémarrage manuel de db-prod (à faire dans une fenêtre de maintenance).
warn "  ⚠ db-prod NON redémarré : le POSTGRES_PASSWORD a changé mais la DB tourne."
warn "     Pour appliquer : sudo docker restart db-prod (downtime ~1min, fenêtre maintenance)"

# 6c. rest-prod lit anon/service_role
sudo docker restart rest-prod
log "  rest-prod → redémarrage en cours..."
sleep 3

# 6d. eaumalik-app lit /opt/eaumalik/.env (anon + service_role + CAPTCHA_SECRET)
sudo docker restart eaumalik-app
log "  eaumalik-app → redémarrage en cours..."
sleep 8

# ---------- 7. Vérifications ----------
log ""
step "7. Vérifications end-to-end"

# Santé containers
echo ""
log "  Container states :"
for c in auth-prod rest-prod eaumalik-app; do
  STATE=$(sudo docker inspect --format "{{.State.Health.Status}}" "$c" 2>/dev/null || echo "unknown")
  RUN=$(sudo docker inspect --format "{{.State.Running}}" "$c" 2>/dev/null || echo "false")
  printf "    %-15s health=%-10s running=%s\n" "$c" "$STATE" "$RUN"
done

echo ""
log "  HTTP checks :"
curl -fsS -m 5 -o /dev/null -w "    /                            → HTTP %{http_code}\n" https://eaumalik.com/ 2>/dev/null || echo "    / → FAILED"
curl -fsS -m 5 -o /dev/null -w "    /login                       → HTTP %{http_code}\n" https://eaumalik.com/login 2>/dev/null || echo "    /login → FAILED"
curl -fsS -m 5 -o /dev/null -w "    /login/mot-de-passe-oublie   → HTTP %{http_code}\n" https://eaumalik.com/login/mot-de-passe-oublie 2>/dev/null || echo "    /login/mot-de-passe-oublie → FAILED"
curl -fsS -m 5 -o /dev/null -w "    /api/auth/captcha            → HTTP %{http_code}\n" https://eaumalik.com/api/auth/captcha 2>/dev/null || echo "    /api/auth/captcha → FAILED"
curl -fsS -m 5 -o /dev/null -w "    db-dev.smartefp.com/auth/v1/health → HTTP %{http_code}\n" https://db-dev.smartefp.com/auth/v1/health 2>/dev/null || echo "    auth → FAILED"

# Vérif cohérence : anon key de l'app doit matcher celle de la stack
echo ""
log "  Cohérence des clés :"
APP_ANON=$(sudo grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$APP_ENV" | cut -d= -f2-)
STACK_ANON=$(sudo grep "^ANON_KEY=" "$STACK_ENV" | cut -d= -f2-)
if [[ "$APP_ANON" == "$STACK_ANON" ]]; then
  ok "    ANON_KEY : app ↔ stack COHÉRENTE ✅"
else
  err "    ANON_KEY : app ↔ stack DIFFÉRENTES ❌"
fi

APP_SR=$(sudo grep "^SUPABASE_SERVICE_ROLE_KEY=" "$APP_ENV" | cut -d= -f2-)
STACK_SR=$(sudo grep "^SERVICE_ROLE_KEY=" "$STACK_ENV" | cut -d= -f2-)
if [[ "$APP_SR" == "$STACK_SR" ]]; then
  ok "    SERVICE_ROLE_KEY : app ↔ stack COHÉRENTE ✅"
else
  err "    SERVICE_ROLE_KEY : app ↔ stack DIFFÉRENTES ❌"
fi

# ---------- 8. Sortie des secrets pour Bitwarden ----------
log ""
log "═══════════════════════════════════════════════════════════════"
ok "ROTATION TERMINÉE"
log "═══════════════════════════════════════════════════════════════"
echo ""
log "  Backups :"
log "    $SUPABASE_BACKUP"
log "    $APP_BACKUP"
echo ""

# ---------- Push Bitwarden (auto ou fallback) ----------
bw_push_secrets_from_env <<EOF
ANON_KEY=$NEW_ANON
SERVICE_ROLE_KEY=$NEW_SERVICE
CAPTCHA_SECRET=$NEW_CAPTCHA
EOF
NEW_JWT_SECRET=$(sudo grep "^JWT_SECRET=" "$STACK_ENV" | cut -d= -f2- || true)
[[ -n "$NEW_JWT_SECRET" ]] && \
  bw_push_secret "EAUMALIK — Supabase JWT_SECRET ($(date +%Y-%m-%d))" "$NEW_JWT_SECRET"
NEW_PG_PWD=$(sudo grep "^POSTGRES_PASSWORD=" "$STACK_ENV" | cut -d= -f2- || true)
[[ -n "$NEW_PG_PWD" ]] && \
  bw_push_secret "EAUMALIK — Postgres POSTGRES_PASSWORD ($(date +%Y-%m-%d))" "$NEW_PG_PWD"
NEW_VAULT_KEY=$(sudo grep "^VAULT_ENC_KEY=" "$STACK_ENV" | cut -d= -f2- || true)
[[ -n "$NEW_VAULT_KEY" ]] && \
  bw_push_secret "EAUMALIK — Supabase VAULT_ENC_KEY ($(date +%Y-%m-%d))" "$NEW_VAULT_KEY"
bw_print_commands

warn "⚠️  APRÈS CE SCRIPT :"
warn "   1. Mettre à jour le secret GitHub 'ENV_PROD' (sinon le prochain deploy"
warn "      écrasera /opt/eaumalik/.env avec les anciennes clés)."
warn "      → https://github.com/YounesOumalik/eaumalik-saas/settings/secrets/actions"
warn "   2. (Optionnel, fenêtre de maintenance) sudo docker restart db-prod"
warn "      pour appliquer le nouveau POSTGRES_PASSWORD."
warn "   3. Tester end-to-end : login → logout → /login/mot-de-passe-oublie"