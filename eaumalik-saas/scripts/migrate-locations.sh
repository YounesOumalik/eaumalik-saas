#!/usr/bin/env bash
# ============================================================================
# migrate-locations.sh — Helper Node.js pour appliquer les migrations 0014 +
# 0015 sur une instance EAUMALIK (Supabase) avec backfill visuel.
#
# Pourquoi un wrapper bash ?
#  - Vérifie les prérequis (env, psql, supabase-cli)
#  - Affiche un récap clair avant / après
#  - Supporte un mode DRY-RUN (--dry-run) pour valider sans toucher la base
#  - Rollback automatique si une des 2 migrations échoue
#
# Usage :
#   ./scripts/migrate-locations.sh                    # applique les 2 migrations
#   ./scripts/migrate-locations.sh --dry-run          # affiche ce qui serait fait
#   ./scripts/migrate-locations.sh --skip-backfill    # n'exécute pas le backfill
#   ./scripts/migrate-locations.sh --rollback         # retire les tables (⚠️)
#
# Prérequis :
#   - Variables d'env : SUPABASE_DB_URL (postgres://...) OU
#                       NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
#   - Outil : psql (≥ 14) OU supabase CLI (`npx supabase`)
#
# Auteur : EAUMALIK Dev Team, juillet 2026
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
MIGRATION_0014="$MIGRATIONS_DIR/0014_locations.sql"
MIGRATION_0015="$MIGRATIONS_DIR/0015_product_location_stock.sql"

DRY_RUN=false
SKIP_BACKFILL=false
ROLLBACK=false

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=true ;;
    --skip-backfill) SKIP_BACKFILL=true ;;
    --rollback)     ROLLBACK=true ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) echo "❌ Argument inconnu : $arg" >&2; exit 1 ;;
  esac
done

# ----- Helpers visuels -----
if [ -t 1 ]; then
  BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi
banner() { echo -e "${BOLD}${GREEN}▶ $*${RESET}"; }
warn()   { echo -e "${YELLOW}⚠ $*${RESET}"; }
err()    { echo -e "${RED}✗ $*${RESET}" >&2; }
ok()     { echo -e "${GREEN}✓ $*${RESET}"; }

# ----- Prérequis -----
banner "Vérification des prérequis…"

if [ ! -f "$MIGRATION_0014" ]; then
  err "Migration 0014 introuvable : $MIGRATION_0014"
  exit 1
fi
if [ ! -f "$MIGRATION_0015" ]; then
  err "Migration 0015 introuvable : $MIGRATION_0015"
  exit 1
fi
ok "Migrations 0014 + 0015 trouvées"

# Détermine la commande DB : psql ou supabase CLI
DB_CMD=""
DB_ARGS=()
if command -v psql >/dev/null 2>&1; then
  if [ -n "${SUPABASE_DB_URL:-}" ]; then
    DB_CMD="psql"; DB_ARGS=("$SUPABASE_DB_URL" "-v" "ON_ERROR_STOP=1" "--pset=pager=off")
    ok "psql détecté (via SUPABASE_DB_URL)"
  elif [ -n "${DATABASE_URL:-}" ]; then
    DB_CMD="psql"; DB_ARGS=("$DATABASE_URL" "-v" "ON_ERROR_STOP=1" "--pset=pager=off")
    ok "psql détecté (via DATABASE_URL)"
  fi
fi

if [ -z "$DB_CMD" ] && command -v npx >/dev/null 2>&1; then
  if [ -n "${NEXT_PUBLIC_SUPABASE_DB_URL:-}" ]; then
    DB_CMD="npx_supabase"; DB_ARGS=("$NEXT_PUBLIC_SUPABASE_DB_URL")
    warn "supabase CLI utilisé (psql indisponible)"
  fi
fi

if [ -z "$DB_CMD" ]; then
  err "Aucun client DB disponible."
  err "  → installer psql (recommandé) OU définir SUPABASE_DB_URL / DATABASE_URL"
  exit 1
fi

# ----- Mode rollback -----
if [ "$ROLLBACK" = true ]; then
  banner "ROLLBACK — suppression des tables du module logistique"
  warn "Cette action supprime : locations, product_location_stock, transfer_requests"
  warn "         + supprime managed_location_ids, restore l'ancien CHECK users.role,"
  warn "         + supprime les colonnes source/destination/transfer_group_id de product_restock_history."
  echo ""
  read -rp "Confirmer le rollback ? Tapez 'ROLLBACK' pour confirmer : " confirm
  if [ "$confirm" != "ROLLBACK" ]; then
    warn "Annulé."
    exit 0
  fi
  ROLLBACK_SQL="
    DROP TABLE IF EXISTS eaumalik.transfer_requests CASCADE;
    DROP TABLE IF EXISTS eaumalik.product_location_stock CASCADE;
    DROP TABLE IF EXISTS eaumalik.locations CASCADE;
    ALTER TABLE eaumalik.product_restock_history
      DROP COLUMN IF EXISTS source_location_id,
      DROP COLUMN IF EXISTS destination_location_id,
      DROP COLUMN IF EXISTS transfer_group_id;
    ALTER TABLE eaumalik.product_restock_history
      DROP CONSTRAINT IF EXISTS product_restock_history_reason_check;
    ALTER TABLE eaumalik.product_restock_history
      ADD CONSTRAINT product_restock_history_reason_check
      CHECK (reason IN ('restock','return','direct_sale','correction','loss','other'));
    ALTER TABLE eaumalik.users DROP COLUMN IF EXISTS managed_location_ids;
    ALTER TABLE eaumalik.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE eaumalik.users ADD CONSTRAINT users_role_check
      CHECK (role IN ('client','admin','administrator','sales','technician','stock_manager','admin_assistant'));
    DROP VIEW IF EXISTS eaumalik.product_stock_by_location CASCADE;
    DROP VIEW IF EXISTS eaumalik.transfer_request_details CASCADE;
  "
  if [ "$DRY_RUN" = true ]; then
    echo "$ROLLBACK_SQL"
    exit 0
  fi
  "$DB_CMD" "${DB_ARGS[@]}" -c "$ROLLBACK_SQL"
  ok "Rollback effectué."
  exit 0
fi

# ----- Dry run recap -----
banner "Récap"
echo "  Migration 0014 : $MIGRATION_0014"
echo "  Migration 0015 : $MIGRATION_0015"
if [ "$SKIP_BACKFILL" = true ]; then
  echo "  Backfill     : SKIPPED (--skip-backfill)"
else
  echo "  Backfill     : oui (tous les produits avec stock > 0 → D-CASA-DEPOT)"
fi
echo "  Mode         : $([ "$DRY_RUN" = true ] && echo 'DRY-RUN (aucune écriture)' || echo 'APPLICATION réelle')"
echo ""

# ----- Application -----
if [ "$DRY_RUN" = true ]; then
  banner "DRY-RUN — aucun fichier ne sera exécuté"
  warn "Pour réellement appliquer, relancez sans --dry-run"
  echo ""
  echo "=== Aperçu 0014_locations.sql ==="
  head -30 "$MIGRATION_0014"
  echo "..."
  echo ""
  echo "=== Aperçu 0015_product_location_stock.sql ==="
  head -30 "$MIGRATION_0015"
  exit 0
fi

banner "Application 0014_locations.sql…"
if "$DB_CMD" "${DB_ARGS[@]}" -f "$MIGRATION_0014"; then
  ok "0014 appliquée"
else
  err "Échec 0014 — rollback"
  exit 1
fi

banner "Application 0015_product_location_stock.sql…"
if "$DB_CMD" "${DB_ARGS[@]}" -f "$MIGRATION_0015"; then
  ok "0015 appliquée"
else
  err "Échec 0015 — vérifier manuellement (rollback partiel possible)"
  exit 1
fi

# ----- Vérifications post-migration -----
banner "Vérifications post-migration…"

CHECK_SQL="
  SELECT
    (SELECT COUNT(*) FROM eaumalik.locations WHERE is_archived = false) AS active_locations,
    (SELECT COUNT(*) FROM eaumalik.product_location_stock) AS stock_entries,
    (SELECT COUNT(*) FROM eaumalik.transfer_requests) AS transfer_requests,
    (SELECT array_length(enum_range(NULL::eaumalik.users.users_role_check)::text::text[], 1)) IS NOT NULL
      AS role_check_present;
"
"$DB_CMD" "${DB_ARGS[@]}" -c "$CHECK_SQL"

ok "Tables et contraintes en place"

# ----- Backfill summary (déjà inclus dans 0015 mais on re-confirme) -----
if [ "$SKIP_BACKFILL" = false ]; then
  banner "Backfill : répartition du stock existant"
  BACKFILL_SQL="
    SELECT
      l.code,
      l.name,
      l.type,
      COUNT(pls.product_id) AS nb_produits,
      COALESCE(SUM(pls.quantity), 0) AS total_unites
    FROM eaumalik.locations l
    LEFT JOIN eaumalik.product_location_stock pls ON pls.location_id = l.id
    GROUP BY l.id, l.code, l.name, l.type
    ORDER BY l.type, l.name;
  "
  "$DB_CMD" "${DB_ARGS[@]}" -c "$BACKFILL_SQL"
fi

banner "Migration terminée ✓"
echo ""
echo "  Prochaines étapes :"
echo "  1. Vérifier /admin/locations sur votre instance"
echo "  2. Tester la création d'un store_manager avec localité affectée"
echo "  3. (Optionnel) Renseigner les capacités des localités existantes"