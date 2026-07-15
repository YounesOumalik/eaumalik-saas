#!/usr/bin/env bash
# ============================================================================
# EAUMALIK — Enregistrement initial du self-hosted runner
#
# À exécuter UNE SEULE FOIS sur le VPS, en tant que root ou avec sudo.
# Crée :
#   - l'utilisateur système `runner` (non-root, gid docker)
#   - le dossier /opt/github-runner
#   - génère le RUNNER_TOKEN via l'API GitHub (nécessite PAT)
#   - démarre le container via docker-compose
#
# Usage :
#   sudo ./register-runner.sh \
#     --repo "Oumalik/Eaumalik" \
#     --pat "ghp_xxxxxxxxxxxxxxxxxxxx" \
#     --labels "self-hosted,linux,x64,vps-eaumalik"
#
# ⚠️  Le PAT doit avoir le scope :
#     - "administration: write" (fine-grained) OU
#     - "repo" + "admin:org" (classic) — pour pouvoir créer le runner
#
# Alternative si vous préférez générer le token manuellement :
#   Settings → Actions → Runners → "New self-hosted runner" → copier
#   le token affiché, puis :
#     sudo RUNNER_TOKEN="xxxxxx" ./register-runner.sh --repo "Oumalik/Eaumalik"
# ============================================================================
set -euo pipefail

# ---------- Args ----------
REPO=""
PAT=""
LABELS="self-hosted,linux,x64,vps-eaumalik"
RUNNER_NAME="vps-eaumalik-prod"
RUNNER_VERSION="2.319.1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)        REPO="$2"; shift 2 ;;
    --pat)         PAT="$2"; shift 2 ;;
    --labels)      LABELS="$2"; shift 2 ;;
    --name)        RUNNER_NAME="$2"; shift 2 ;;
    --version)     RUNNER_VERSION="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,30p' "$0"; exit 0 ;;
    *) echo "❌ Option inconnue : $1"; exit 1 ;;
  esac
done

[[ -z "$REPO" ]] && { echo "❌ --repo requis (ex: Oumalik/Eaumalik)"; exit 1; }

# ---------- Vérifs root ----------
if [[ $EUID -ne 0 ]]; then
  echo "❌ Ce script doit être exécuté en root (sudo $0 …)"
  exit 1
fi

# ---------- Création user système ----------
if ! id runner &>/dev/null; then
  echo "→ Création de l'utilisateur runner"
  useradd --system \
          --shell /bin/bash \
          --home /opt/github-runner \
          --comment "GitHub Actions runner" \
          runner
fi

# Ajout au groupe docker pour pouvoir dialoguer avec le socket
usermod -aG docker runner

# Dossier d'install
mkdir -p /opt/github-runner
chown -R runner:runner /opt/github-runner
chmod 755 /opt/github-runner

# ---------- Génération du RUNNER_TOKEN via API ----------
# ⚠️  ATTENTION CONFUSION FRÉQUENTE :
#   - PAT (github_pat_…)         : sert à l'authentification API
#   - RUNNER_TOKEN (registration): sert à enregistrer le runner, expire 1h
# Si --pat est fourni, on l'utilise pour générer un registration token via l'API.
# Si RUNNER_TOKEN est fourni directement, on l'utilise tel quel (déjà un registration token).
if [[ -n "$PAT" ]]; then
  if [[ "$PAT" == github_pat_* ]]; then
    echo "→ Génération du RUNNER_TOKEN via l'API GitHub (à partir du PAT)"
    REGISTRATION_TOKEN=$(curl -fsS \
      -X POST \
      -H "Authorization: token ${PAT}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${REPO}/actions/runners/registration-token" \
      | grep -oE '"token":\s*"[^"]+"' | cut -d'"' -f4)

    if [[ -z "$REGISTRATION_TOKEN" ]]; then
      echo "❌ Impossible de générer le token. Vérifie le PAT et le repo."
      exit 1
    fi
    echo "  → Registration token généré (${#REGISTRATION_TOKEN} caractères)"
  else
    # Le --pat ressemble déjà à un registration token (forme ATCxxxx…)
    # On l'utilise tel quel.
    echo "→ Le --pat ressemble à un registration token, utilisation directe"
    REGISTRATION_TOKEN="$PAT"
  fi
else
  if [[ -z "${RUNNER_TOKEN:-}" ]]; then
    echo "⚠️  Aucun --pat ni RUNNER_TOKEN fourni."
    echo "   Génère-le manuellement : Settings → Actions → Runners → New"
    echo "   Puis relance avec : RUNNER_TOKEN=ABC123 sudo $0 --repo $REPO"
    exit 1
  fi
  REGISTRATION_TOKEN="$RUNNER_TOKEN"
fi

# ---------- Fichier .env pour le container ----------
cat > /opt/github-runner/.env <<EOF
# Généré par register-runner.sh le $(date -u +%Y-%m-%dT%H:%M:%SZ)
# NE PAS COMMITER
REPO_URL=https://github.com/${REPO}
RUNNER_TOKEN=${REGISTRATION_TOKEN}
RUNNER_NAME=${RUNNER_NAME}
RUNNER_LABELS=${LABELS}
EOF
chown runner:runner /opt/github-runner/.env
chmod 600 /opt/github-runner/.env

# ---------- Copie du docker-compose ----------
if [[ ! -f /opt/github-runner/docker-compose.runner.yml ]]; then
  echo "→ Copie de docker-compose.runner.yml vers /opt/github-runner/"
  cp "$(dirname "$0")/docker-compose.runner.yml" /opt/github-runner/
  chown runner:runner /opt/github-runner/docker-compose.runner.yml
fi

# ---------- systemd ----------
if [[ ! -f /etc/systemd/system/github-runner.service ]]; then
  echo "→ Installation du service systemd"
  cp "$(dirname "$0")/github-runner.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable github-runner.service
fi

# ---------- Démarrage ----------
echo "→ Démarrage du runner"
systemctl start github-runner.service

sleep 5

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Runner installé et démarré"
echo ""
echo "Vérifie le statut :"
echo "  systemctl status github-runner"
echo "  journalctl -u github-runner -f"
echo ""
echo "Vérifie côté GitHub :"
echo "  https://github.com/${REPO}/settings/actions/runners"
echo "  → tu dois voir '${RUNNER_NAME}' avec le status 'Idle'"
echo "════════════════════════════════════════════════════════"