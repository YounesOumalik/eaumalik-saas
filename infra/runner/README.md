# ⚠️ ABANDONNÉ — Approche remplacée par `infra/webhook/`

**Date d'abandon** : 2026-07-15
**Remplacé par** : [`infra/webhook/`](../webhook/) — webhook GitHub simple, sans token, sans runner

## Pourquoi abandonné

L'approche self-hosted runner présentait plusieurs problèmes opérationnels :

| Problème | Impact |
|----------|--------|
| Registration token expire en 1h | Difficile à scripter de bout en bout |
| Nécessite un PAT GitHub avec scope `administration:write` | Surface d'attaque accrue |
| Runner Docker + socket + permissions = fragile | Multiples bugs de permissions (root vs user, volume mounts, etc.) |
| VM Minutes GitHub consommées | Coût récurrent |

L'approche **webhook GitHub → service Node.js** retenue à la place est :

- ✅ **Zéro token** : utilise HMAC SHA-256 uniquement (secret partagé)
- ✅ **Zéro minute GitHub** : tout se passe sur le VPS
- ✅ **Zéro dépendance externe** : pas de runner à maintenir
- ✅ **Vercel-like** : push → deploy en 2-3 minutes
- ✅ **Fiable** : validé en production sur `eaumalik.com`

## Fichiers archivés (ne plus utiliser)

- `docker-compose.runner.yml` — container du runner
- `github-runner.service` — unit systemd
- `register-runner.sh` — script d'enregistrement (générait un registration token API)

## Si tu veux revenir au runner (non recommandé)

Ces fichiers sont **toujours fonctionnels** mais inutiles. Pour les utiliser, il faudrait :

1. Régénérer un PAT GitHub avec `administration:write` sur le repo
2. Réexécuter `register-runner.sh --pat <PAT>`
3. Renouveler le registration token toutes les heures (impossible à automatiser proprement)

→ Mieux vaut utiliser [`infra/webhook/`](../webhook/) qui est déjà en place.