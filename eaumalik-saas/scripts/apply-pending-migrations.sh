#!/usr/bin/env bash
# ============================================================================
# apply-pending-migrations.sh — Applique automatiquement les migrations SQL
# EAUMALIK qui n'ont pas encore été jouées sur la base cible.
#
# Pourquoi ?
#   Pour ne plus avoir à se souvenir manuellement d'appliquer 0014+0015
#   (et les futures) après chaque push. Le webhook GitHub déclenche ce script
#   juste après le `docker compose up` du container app, AVANT le smoke test.
#
# Tracking :
#   Table `eaumalik._applied_migrations` (créée à la volée si absente).
#   Colonnes : filename TEXT PK, applied_at TIMESTAMPTZ, sha256 TEXT, ok BOOL.
#
# Idempotence :
#   - Une migration est "pending" si son nom n'est PAS dans la table.
#   - Les scripts SQL eux-mêmes doivent être idempotents
#     (`CREATE TABLE IF NOT EXISTS`, `DROP ... IF EXISTS`,
#      `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.).
#   - Si une migration échoue, on logue l'erreur et on sort en code 1
#     (le deploy webhook marquera le deploy comme failed).
#
# Cible DB :
#   Détectée via le container Docker `db-prod` (Postgres Supabase).
#   On utilise `docker exec db-prod psql ...` plutôt que d'exiger un psql
#   local ou une variable SUPABASE_DB_URL — ça colle au déploiement Docker.
#
# Usage :
#   ./scripts/apply-pending-migrations.sh              # applique
#   ./scripts/apply-pending-migrations.sh --dry-run    # liste les pending
#   ./scripts/apply-pending-migrations.sh --status     # montre l'historique
#
# Auteur : EAUMALIK Dev Team, juillet 2026
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
DB_CONTAINER="${EAUMALIK_DB_CONTAINER:-db-prod}"

DRY_RUN=false
SHOW_STATUS=false
BOOTSTRAP=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true ;;
    --status)    SHOW_STATUS=true ;;
    --bootstrap) BOOTSTRAP=true ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *) echo "❌ Argument inconnu : $arg" >&2; exit 1 ;;
  esac
done

# ----- Helpers visuels -----
if [ -t 1 ]; then
  BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; CYAN="\033[36m"; RESET="\033[0m"
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; CYAN=""; RESET=""
fi
banner() { echo -e "${BOLD}${GREEN}▶ $*${RESET}"; }
warn()   { echo -e "${YELLOW}⚠ $*${RESET}"; }
err()    { echo -e "${RED}✗ $*${RESET}" >&2; }
ok()     { echo -e "${GREEN}✓ $*${RESET}"; }
info()   { echo -e "${CYAN}· $*${RESET}"; }

# ----- Prérequis -----
banner "Vérification des prérequis…"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  err "Dossier migrations introuvable : $MIGRATIONS_DIR"
  exit 1
fi
ok "Dossier migrations : $MIGRATIONS_DIR"

if ! command -v docker >/dev/null 2>&1; then
  err "docker absent"
  exit 1
fi

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB_CONTAINER"; then
  err "Container DB '$DB_CONTAINER' introuvable (docker ps)"
  err "  → soit le nom est différent (override avec EAUMALIK_DB_CONTAINER=...)"
  err "  → soit ton user n'a pas accès au socket Docker (groupes : $(id -Gn))"
  err "  → ajoutes-toi au groupe 'docker' : sudo usermod -aG docker \$USER"
  exit 1
fi
ok "Container DB : $DB_CONTAINER"

# Helper : exécuter du SQL dans le container DB
db_psql() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -A -t "$@"
}

# ----- Création de la table de tracking si absente -----
banner "Initialisation du tracking eaumalik._applied_migrations…"
db_psql <<'SQL' >/dev/null
CREATE TABLE IF NOT EXISTS eaumalik._applied_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sha256     TEXT,
  ok         BOOLEAN NOT NULL DEFAULT true,
  error_msg  TEXT
);
GRANT SELECT ON eaumalik._applied_migrations TO authenticated, anon;
COMMENT ON TABLE eaumalik._applied_migrations IS
  'Historique des migrations SQL appliquées par apply-pending-migrations.sh';
SQL
ok "Table de tracking prête"

# ----- Mode STATUS -----
if [ "$SHOW_STATUS" = true ]; then
  banner "Migrations déjà appliquées sur la cible"
  db_psql -c "SELECT filename, applied_at, ok, COALESCE(LEFT(error_msg,60),'-') AS err FROM eaumalik._applied_migrations ORDER BY filename;"
  exit 0
fi

# ----- Lister les fichiers de migration présents dans le repo -----
# On prend tous les NNNN_*.sql dans l'ordre alphabétique (= chronologique).
mapfile -t MIGRATION_FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]_*.sql' | sort)
if [ ${#MIGRATION_FILES[@]} -eq 0 ]; then
  warn "Aucune migration *.sql trouvée dans $MIGRATIONS_DIR"
  exit 0
fi
info "${#MIGRATION_FILES[@]} fichiers de migration trouvés dans le repo"

# ----- Mode BOOTSTRAP : marque toutes les migrations présentes comme déjà appliquées -----
# Usage : ./apply-pending-migrations.sh --bootstrap
#
# À utiliser UNE SEULE FOIS quand on câble ce script sur une base déjà migrée
# à la main (pour ne pas rejouer 0001..0013 sur une prod qui a déjà tout ça).
#
# ⚠️  N'exécute AUCUN SQL applicatif : il se contente de remplir
#     eaumalik._applied_migrations avec filename + sha256 uniquement.
#     Les futures exécutions ne s'occuperont que des nouvelles migrations
#     (ce qui est le but).
if [ "$BOOTSTRAP" = true ]; then
  banner "BOOTSTRAP — marquage rétroactif sans exécution"
  warn "Ce mode NE JOUE aucun SQL. Il marque juste les migrations comme"
  warn "déjà appliquées. À n'utiliser qu'une seule fois sur une base existante."
  echo ""
  read -rp "Confirmer ? Tapez 'BOOTSTRAP' : " confirm
  if [ "$confirm" != "BOOTSTRAP" ]; then
    err "Annulé."
    exit 0
  fi
  COUNT=0
  for path in "${MIGRATION_FILES[@]}"; do
    name="$(basename "$path")"
    sha=$(sha256sum "$path" | awk '{print $1}')
    db_psql <<SQL >/dev/null
INSERT INTO eaumalik._applied_migrations (filename, sha256, ok)
VALUES ('$name', '$sha', true)
ON CONFLICT (filename) DO NOTHING;
SQL
    info "marqué : $name"
    COUNT=$((COUNT+1))
  done
  ok "$COUNT migrations marquées comme déjà appliquées"
  db_psql -c "NOTIFY pgrst, 'reload schema';" >/dev/null 2>&1 || true
  exit 0
fi

# ----- Filtrer celles déjà appliquées (ok=true) -----
PENDING=()
for path in "${MIGRATION_FILES[@]}"; do
  name="$(basename "$path")"
  already=$(db_psql -c "SELECT 1 FROM eaumalik._applied_migrations WHERE filename='$name' AND ok=true LIMIT 1;")
  if [ -z "$already" ]; then
    PENDING+=("$path")
  fi
done

info "${#PENDING[@]} migrations en attente"

if [ "$DRY_RUN" = true ]; then
  banner "DRY-RUN — aucune modification ne sera appliquée"
  if [ ${#PENDING[@]} -eq 0 ]; then
    ok "Toutes les migrations du repo sont déjà appliquées."
  else
    for p in "${PENDING[@]}"; do
      echo "  → $(basename "$p")"
    done
  fi
  exit 0
fi

if [ ${#PENDING[@]} -eq 0 ]; then
  ok "Aucune migration à appliquer (DB à jour)."
  exit 0
fi

# Helper local : échapper une chaîne pour SQL (single-quote doubling).
# Doit être défini avant d'être utilisé dans le bloc d'erreur.
sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

# ----- Application séquentielle -----
APPLIED=0
FAILED=0
for path in "${PENDING[@]}"; do
  name="$(basename "$path")"
  banner "Application $name…"

  # Calcul du SHA256 (pour audit / debug)
  sha=$(sha256sum "$path" | awk '{print $1}')

  # Exécution du SQL — capture stdout/stderr
  if output=$(db_psql -f - < "$path" 2>&1); then
    # Insertion du tracking
    db_psql <<SQL >/dev/null
INSERT INTO eaumalik._applied_migrations (filename, sha256, ok)
VALUES ('$name', '$sha', true)
ON CONFLICT (filename) DO UPDATE SET
  applied_at = now(),
  sha256     = EXCLUDED.sha256,
  ok         = true,
  error_msg  = NULL;
SQL
    ok "$name appliquée (sha256: ${sha:0:12}…)"
    APPLIED=$((APPLIED+1))
  else
    err "$name a échoué :"
    echo "$output" | tail -10
    escaped=$(sql_escape "$(echo "$output" | head -c 500)")
    # Enregistrer l'échec pour debug
    db_psql -c "INSERT INTO eaumalik._applied_migrations (filename, sha256, ok, error_msg) VALUES ('$name', '$sha', false, '$escaped') ON CONFLICT (filename) DO UPDATE SET applied_at = now(), sha256 = EXCLUDED.sha256, ok = false, error_msg = EXCLUDED.error_msg;" >/dev/null
    FAILED=$((FAILED+1))
    err "Abandon : $name a échoué. Corriger et relancer."
    exit 1
  fi
done

# ----- Recharger le schema cache PostgREST -----
banner "Reload du schema cache PostgREST…"
db_psql -c "NOTIFY pgrst, 'reload schema';" 2>&1 || warn "PostgREST non joignable (peut-être dans un autre container)"

# Le NOTIFY est la voie normale. Sur certaines installations Supabase,
# PostgREST peut conserver son cache après une migration malgré le NOTIFY
# (notamment si le listener a été redémarré entre-temps). Le redémarrage
# ciblé garantit que les nouvelles colonnes sont immédiatement exposées.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'rest-prod'; then
  docker restart rest-prod >/dev/null
  ok "PostgREST rechargé (rest-prod redémarré)"
else
  warn "Container rest-prod introuvable : NOTIFY envoyé uniquement"
fi

# ----- Résumé -----
banner "Résumé"
echo "  Migrations appliquées : $APPLIED"
echo "  Échecs                : $FAILED"
echo "  Tables eaumalik       : $(db_psql -c 'SELECT COUNT(*) FROM pg_tables WHERE schemaname = $$eaumalik$$')"
echo "  Vues public           : $(db_psql -c 'SELECT COUNT(*) FROM pg_views WHERE schemaname = $$public$$')"

if [ "$APPLIED" -gt 0 ]; then
  ok "Migrations à jour ✅"
fi
