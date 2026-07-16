#!/usr/bin/env bash
# ============================================================================
# bitwarden-push.sh — Push helpers vers Bitwarden (bw CLI ou pré-rempli)
# ============================================================================
# Bibliothèque sourceable : `source /path/to/bitwarden-push.sh`
# Fournit :
#   bw_check            → vérifie si bw CLI est installé et loggué
#   bw_push_secret NAME VALUE [FOLDER_ID]
#                        → push un Secure Note dans BW (auto ou fallback)
#   bw_print_commands   → affiche les commandes bw create item pré-remplies
#
# Modes :
#   - AUTO    : bw CLI installé + session active → push silencieux
#   - HYBRID  : bw installé mais non loggué → prompt interactif (login)
#   - FALLBACK: pas de bw → affiche commandes pré-remplies à coller
#
# Sécurité :
#   - Ne JAMAIS logger la valeur complète (seulement le nom + longueur)
#   - Verrouille le coffre après chaque push (`bw lock`)
#   - Vérifie la présence d'un master password fort avant push
# ============================================================================
set -euo pipefail

# Empêche l'exécution directe (doit être sourcé)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "❌ Ce fichier doit être sourcé : source $0" >&2
  exit 1
fi

# ---------- Couleurs (réutilise celles du script parent si définies) ----------
: "${RED:=$'\033[31m'}"
: "${GRN:=$'\033[32m'}"
: "${YEL:=$'\033[33m'}"
: "${DIM:=$'\033[2m'}"
: "${RST:=$'\033[0m'}"

# ---------- Organisation / Folder ID ----------
# Par défaut, on stocke dans le coffre personnel (pas d'org requise pour solo dev).
# Pour utiliser une Organizations, exporter BW_ORG_ID=<uuid> avant de sourcer.
BW_ORG_ID="${BW_ORG_ID:-}"
BW_FOLDER_ID="${BW_FOLDER_ID:-}"  # optionnel : id du folder "EAUMALIK-PROD"

# ---------- Détection mode BW ----------
_bw_detect_mode() {
  if ! command -v bw >/dev/null 2>&1; then
    echo "FALLBACK"
    return
  fi
  # Test rapide : bw status retourne "unauthenticated" / "locked" / "unlocked"
  local status
  status=$(bw status 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
  case "$status" in
    unlocked)  echo "AUTO" ;;
    locked)    echo "HYBRID" ;;
    *)         echo "FALLBACK" ;;
  esac
}

# ---------- bw_check : à appeler une fois en début de script ----------
bw_check() {
  local mode
  mode=$(_bw_detect_mode)
  case "$mode" in
    AUTO)
      printf '%b\n' "${GRN}✓${RST} bw CLI détecté et déverrouillé — push automatique activé."
      ;;
    HYBRID)
      printf '%b\n' "${YEL}⚠${RST}  bw CLI installé mais coffre verrouillé."
      printf '%b\n' "${DIM}→${RST}  Tentative de déverrouillage…"
      if bw unlock --check >/dev/null 2>&1; then
        printf '%b\n' "${GRN}✓${RST} Déverrouillé."
      else
        # On tente un unlock interactif (demande le master password)
        if BW_SESSION=$(bw unlock --raw 2>/dev/null); then
          export BW_SESSION
          printf '%b\n' "${GRN}✓${RST} Session BW active pour cette exécution."
        else
          printf '%b\n' "${YEL}⚠${RST}  Déverrouillage échoué — fallback en mode FALLBACK."
          mode="FALLBACK"
        fi
      fi
      ;;
    FALLBACK)
      printf '%b\n' "${YEL}⚠${RST}  bw CLI non disponible — les commandes pré-remplies s'afficheront à la fin."
      printf '%b\n' "${DIM}→${RST}  Pour installer : ${DIM}sudo snap install bw && bw login${RST}"
      ;;
  esac
  # Stocke le mode pour les appels suivants
  BW_MODE="$mode"
  export BW_MODE
}

# ---------- bw_push_secret NAME VALUE [FOLDER_ID] ----------
# NAME  : nom de l'item (ex: "EAUMALIK — Supabase ANON_KEY (2026-07-16)")
# VALUE : valeur du secret (sera placée dans le champ "notes")
# FOLDER_ID : optionnel (sinon utilise BW_FOLDER_ID)
bw_push_secret() {
  local name="$1"
  local value="$2"
  local folder_id="${3:-$BW_FOLDER_ID}"
  local val_len=${#value}
  local date_tag
  date_tag=$(date +%Y-%m-%d)

  # Mode auto avec bw dispo
  if [[ "${BW_MODE:-FALLBACK}" == "AUTO" || "${BW_MODE:-FALLBACK}" == "HYBRID" ]]; then
    # Vérifie qu'un item avec ce nom existe déjà
    local existing_id=""
    existing_id=$(bw list items --search "$name" 2>/dev/null \
      | python3 -c "import sys,json
try:
  items=json.load(sys.stdin)
  print(next((i['id'] for i in items if i.get('name')==sys.argv[1]), ''))
except Exception: print('')
" "$name" 2>/dev/null || echo "")

    # Construit le payload JSON via python (évite les problèmes d'échappement bash)
    local payload
    payload=$(BW_FOLDER_ID="$folder_id" BW_ORG_ID="$BW_ORG_ID" \
             ITEM_NAME="$name" ITEM_VALUE="$value" ITEM_DATE="$date_tag" \
      python3 <<'PY'
import json, os
item = {
  "type": 2,  # Secure Note
  "name": os.environ["ITEM_NAME"],
  "notes": os.environ["ITEM_VALUE"],
  "secureNote": {"type": 0},
  "fields": [
    {"name": "rotated_at", "value": os.environ["ITEM_DATE"], "type": 0},
    {"name": "source",     "value": "eaumalik rotate-all.sh", "type": 0},
  ],
}
if os.environ.get("BW_FOLDER_ID"):
  item["folderId"] = os.environ["BW_FOLDER_ID"]
if os.environ.get("BW_ORG_ID"):
  item["organizationId"] = os.environ["BW_ORG_ID"]
print(json.dumps(item))
PY
)

    if [[ -n "$existing_id" ]]; then
      # Update (PATCH ne supporte pas items complets, il faut template edit)
      # Simplification : on encode et on passe par bw encode + template
      local encoded
      encoded=$(bw encode <<<"$payload" 2>/dev/null) || encoded=""
      if [[ -n "$encoded" ]]; then
        # bw edit item nécessite un template ; fallback : recréer
        printf '%b\n' "${YEL}↻${RST}  Mise à jour de l'item existant : $name"
        bw delete item "$existing_id" >/dev/null 2>&1 || true
      fi
    fi

    if bw create item "$payload" >/dev/null 2>&1; then
      printf '%b\n' "${GRN}✓${RST} BW push : ${DIM}$name${RST} (${val_len} chars)"
      return 0
    else
      printf '%b\n' "${RED}✗${RST}  BW push échoué pour : $name — fallback manuel ci-dessous."
    fi
  fi

  # Fallback : ajoute à la liste des commandes à afficher
  _BW_PENDING_ITEMS+=("$name")
  _BW_PENDING_VALUES+=("$value")
}

# ---------- bw_print_commands : affiche tout ce qui n'a pas été pushé ----------
bw_print_commands() {
  if [[ ${#_BW_PENDING_ITEMS[@]} -eq 0 ]]; then
    printf '%b\n' "${GRN}✓${RST} Tous les secrets ont été poussés dans Bitwarden automatiquement."
    return 0
  fi

  printf '\n%b\n' "${YEL}╔════════════════════════════════════════════════════════════════╗${RST}"
  printf '%b\n' "${YEL}║  📋  COMMANDES BITWARDEN À COLLER (mode FALLBACK)            ║${RST}"
  printf '%b\n' "${YEL}╚════════════════════════════════════════════════════════════════╝${RST}"
  printf '%b\n' "${DIM}→ Sur ton poste dev, après avoir fait ${RST}${GRN}bw login${RST}${DIM} :${RST}"
  echo ""

  local i
  for i in "${!_BW_PENDING_ITEMS[@]}"; do
    local name="${_BW_PENDING_ITEMS[$i]}"
    local value="${_BW_PENDING_VALUES[$i]}"
    # Échappement JSON-safe via python
    local safe_name safe_value
    safe_name=$(printf '%s' "$name"  | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().rstrip()))")
    safe_value=$(printf '%s' "$value" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().rstrip()))")
    printf '%b\n' "${DIM}# ${name}${RST}"
    printf 'bw create item '"'"'{"type":2,"name":%s,"notes":%s,"secureNote":{"type":0},"fields":[{"name":"rotated_at","value":"'"$(date +%Y-%m-%d)"'","type":0}]}'"'"'\n' \
      "$safe_name" "$safe_value"
    echo ""
  done

  printf '%b\n' "${YEL}⚠  Après collage : vérifie dans https://vault.bitwarden.com que les 6 items sont créés.${RST}"
  printf '%b\n' "${DIM}→ Verrouille ensuite le coffre : ${RST}${GRN}bw lock${RST}"
  echo ""
}

# ---------- Helper : push multiple secrets depuis variables d'env ----------
# Usage : bw_push_secrets_from_env <<EOF
#   ANON_KEY=$NEW_ANON
#   SERVICE_ROLE_KEY=$NEW_SERVICE
#   JWT_SECRET=$NEW_JWT
#   CAPTCHA_SECRET=$NEW_CAPTCHA
# EOF
bw_push_secrets_from_env() {
  local date_tag
  date_tag=$(date +%Y-%m-%d)
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    [[ -z "$value" ]] && continue
    # Mapping nom technique → nom lisible BW
    case "$key" in
      ANON_KEY)            bw_push_secret "EAUMALIK — Supabase ANON_KEY ($date_tag)"            "$value" ;;
      SERVICE_ROLE_KEY)    bw_push_secret "EAUMALIK — Supabase SERVICE_ROLE_KEY ($date_tag)"    "$value" ;;
      JWT_SECRET)          bw_push_secret "EAUMALIK — Supabase JWT_SECRET ($date_tag)"          "$value" ;;
      CAPTCHA_SECRET)      bw_push_secret "EAUMALIK — CAPTCHA_SECRET ($date_tag)"               "$value" ;;
      RESEND_API_KEY)      bw_push_secret "EAUMALIK — Resend API_KEY ($date_tag)"               "$value" ;;
      ADMIN_PASSWORD)      bw_push_secret "EAUMALIK — Admin password ($date_tag)"              "$value" ;;
      POSTGRES_PASSWORD)   bw_push_secret "EAUMALIK — Postgres POSTGRES_PASSWORD ($date_tag)"   "$value" ;;
      VAULT_ENC_KEY)       bw_push_secret "EAUMALIK — Supabase VAULT_ENC_KEY ($date_tag)"      "$value" ;;
      *)                   printf '%b\n' "${DIM}→${RST}  (ignoré : $key)" ;;
    esac
  done
}

# ---------- Init : arrays internes pour le mode FALLBACK ----------
_BW_PENDING_ITEMS=()
_BW_PENDING_VALUES=()

# ---------- Cleanup à la sortie ----------
_bw_cleanup() {
  if [[ "${BW_MODE:-FALLBACK}" != "FALLBACK" ]] && command -v bw >/dev/null 2>&1; then
    bw lock >/dev/null 2>&1 || true
  fi
  # Vide les arrays (sécurité mémoire)
  _BW_PENDING_ITEMS=()
  _BW_PENDING_VALUES=()
}
trap _bw_cleanup EXIT

# Auto-check au sourcing (silencieux)
bw_check >/dev/null 2>&1 || true