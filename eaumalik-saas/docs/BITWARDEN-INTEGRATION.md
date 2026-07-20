# Intégration Bitwarden — EAUMALIK (2026-07-16)

## Objectif

Centraliser tous les secrets de production dans Bitwarden, avec un mode
**automatique** (si `bw` CLI installé) ou **fallback** (commandes pré-remplies
à coller depuis le terminal de dev).

## Architecture

```
[eaumalik-saas/scripts/]
├── bitwarden-push.sh       # Bibliothèque partagée (sourceable)
├── rotate-all.sh           # Rotation complète → pousse 7 items
├── rotate-secrets.sh       # Rotation ciblée → pousse 3 items
├── recreate-admin.sh       # Création admin → pousse 1 item
└── fix-forgot-password.sh  # SMTP Resend → pousse 1 item
```

## Modes de fonctionnement

### Mode AUTO (recommandé)

Si le `bw` CLI est installé et loggué, les secrets sont **automatiquement
poussés** dans BW après chaque rotation. Aucun copier-coller.

#### Setup (1 fois)

```bash
# 1. Installer le CLI
sudo snap install bw
bw --version    # doit afficher 2026.6.0 ou +

# 2. Login
bw login
# → Saisir email + master password + code 2FA
# → Un token de session est généré

# 3. (Optionnel) Définir la session dans le shell courant
export BW_SESSION="$(bw unlock --raw)"

# 4. Vérifier
bw list items | head -5
```

### Mode FALLBACK (par défaut si pas de bw)

Les scripts détectent l'absence du CLI et **affichent à la fin de l'exécution
une boîte colorée** avec les commandes `bw create item` pré-remplies. Il suffit
de les copier-coller dans un terminal où `bw` est installé.

**Exemple de sortie** :

```
╔════════════════════════════════════════════════════════════════╗
║  📋  COMMANDES BITWARDEN À COLLER (mode FALLBACK)            ║
╚════════════════════════════════════════════════════════════════╝
→ Sur ton poste dev, après avoir fait bw login :

# EAUMALIK — Supabase ANON_KEY (2026-07-16)
bw create item '{"type":2,"name":"EAUMALIK — Supabase ANON_KEY (2026-07-16)","notes":"eyJhbGc...","secureNote":{"type":0},"fields":[{"name":"rotated_at","value":"2026-07-16","type":0}]}'

# EAUMALIK — Supabase SERVICE_ROLE_KEY (2026-07-16)
bw create item '...'
```

### Mode HYBRID

Si `bw` est installé mais le coffre verrouillé, le script propose
automatiquement un déverrouillage interactif (`bw unlock`).

## Items BW créés

Tous les items sont de type **Secure Note** (`type: 2`), avec un champ custom
`rotated_at` pour la traçabilité.

| Item name (préfixe `EAUMALIK — ...`)            | Source            | Quand |
| ------------------------------------------------ | ----------------- | ----- |
| `Supabase ANON_KEY`                              | rotate-all, rotate-secrets | rotation JWT |
| `Supabase SERVICE_ROLE_KEY`                      | rotate-all, rotate-secrets | rotation JWT |
| `Supabase JWT_SECRET`                            | rotate-all, rotate-secrets | rotation JWT |
| `CAPTCHA_SECRET`                                 | rotate-all, rotate-secrets | rotation JWT |
| `Resend API_KEY`                                 | fix-forgot-password | fix SMTP |
| `Admin password`                                 | recreate-admin    | création admin |
| `Postgres POSTGRES_PASSWORD`                     | rotate-all        | rotation JWT |
| `Supabase VAULT_ENC_KEY`                         | rotate-all        | rotation JWT |

## Utilisation après setup

Une fois `bw` CLI installé, **aucune action manuelle n'est requise** :

```bash
# Sur le VPS
ssh smartserveur
sudo /opt/eaumalik/scripts/rotate-all.sh
# → Détection auto : "✓ bw CLI détecté et déverrouillé — push automatique activé."
# → Fin de la rotation : "✓ BW push : EAUMALIK — Supabase ANON_KEY (2026-07-16) (152 chars)"
# → Aucune commande à copier-coller.
```

## Sécurité

- **Aucune valeur de secret n'est jamais loguée** dans la console : seuls les
  noms et longueurs sont affichés.
- Le coffre est **automatiquement reverrouillé** à la fin du script (`bw lock`).
- Les items existants sont **mis à jour** (delete + recreate) si un même nom
  est poussé à nouveau, pour suivre les rotations successives.

## Peuplement initial (à faire 1 fois)

Si tu pars d'un coffre BW vide, je recommande un setup manuel rapide :

1. Va sur https://vault.bitwarden.com
2. Crée une Organization `EAUMALIK` (gratuit, 2 users max)
3. Crée un Folder `EAUMALIK-PROD` (dans l'org)
4. Récupère les valeurs sur le VPS :
   ```bash
   ssh smartserveur 'sudo grep -E "^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD|VAULT_ENC_KEY)=" /opt/eaumalik-supabase/_stack/.env'
   ssh smartserveur 'sudo grep -E "^(NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|CAPTCHA_SECRET)=" /opt/eaumalik/.env'
   ```
5. Crée 8 Secure Notes dans BW avec ces valeurs (noms ci-dessus).

Une fois peuplé, les futures rotations **mettent à jour** automatiquement
ces items (via le push du script).

## Troubleshooting

### "✗ BW push échoué pour : XXX — fallback manuel ci-dessous."

Causes possibles :
- `bw` est installé mais BW_SESSION expirée → refaire `bw unlock`
- L'item existe en doublon dans plusieurs folders → renommer l'ancien
- Token API Bitwarden révoqué → refaire `bw login`

### Les commandes `bw create item` échouent avec "Vault is locked"

```bash
bw unlock
# OU export BW_SESSION=$(bw unlock --raw)
```

### Je veux utiliser une Organizations au lieu du coffre perso

```bash
# Récupère l'ID de l'org :
bw list organizations
# → "id": "abc-123-def-456"

# Exporte avant de lancer le script :
export BW_ORG_ID="abc-123-def-456"
sudo /opt/eaumalik/scripts/rotate-all.sh
```

## Roadmap (idées futures)

- [ ] Script `bw-pull.sh` qui **récupère** un secret depuis BW au démarrage
      d'un container (alternative à `docker secret`)
- [ ] Cron `bw-rotate-check.sh` qui vérifie que les items BW ont moins de 90j
- [ ] Alerte email si un secret prod est modifié hors-script (via `bw events`)
- [ ] Support HashiCorp Vault (option 3 du doc OPERATIONS-SECURITY.md §1.4)