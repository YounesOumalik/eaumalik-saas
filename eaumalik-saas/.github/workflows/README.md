# ⚠️ ABANDONNÉ — Approche remplacée par le webhook VPS

**Date d'abandon** : 2026-07-15
**Remplacé par** : `infra/webhook/` côté VPS + webhook GitHub configuré sur le repo

## Pourquoi abandonné

Les workflows GitHub Actions (CI + deploy) ont été remplacés par un **webhook receiver Node.js** sur le VPS. Plus simple, plus rapide, sans dépendances externes.

Voir [`infra/webhook/`](../../../../infra/webhook/) pour la nouvelle approche.

## Fichiers archivés (ne plus utiliser)

- `ci.yml` — lint + typecheck + build (GitHub-hosted)
- `deploy.yml` — déploiement via self-hosted runner

## Différences avec l'approche webhook

| | GitHub Actions | Webhook VPS |
|---|---|---|
| Coût | Minutes GitHub | Gratuit |
| Latence | 3-5 min (queue + build VM) | 1-3 min (local) |
| Tokens | Runner token + secrets | HMAC secret unique |
| Logs | UI GitHub | journald VPS |
| Visibilité UI | ✅ Badge sur le commit | ❌ Pas d'intégration UI |

→ L'approche webhook est **plus rapide et plus simple** pour un projet solo/dev. Revenir aux GitHub Actions serait utile seulement si on a besoin d'une matrice multi-OS ou d'une UI de review par PR.