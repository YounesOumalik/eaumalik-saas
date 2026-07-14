# Déploiement EAUMALIK SARL — `eaumalik.com` sur SmartServeur

## Architecture

```
Internet (eaumalik.com)
        │
        ▼
   Caddy (déjà installé, port 80/443)
   /etc/caddy/Caddyfile
        │
        ├── /         → container eaumalik-app:3000 (Docker, réseau supabase-prod-net)
        └── /admin/*  → container eaumalik-app:3000

   Supabase existant (déjà up sur le serveur)
   ├── db-prod     postgres:17      5432
   ├── auth-prod   gotrue:v2.189     9999
   ├── rest-prod   postgrest:v14     3000
   └── studio-prod studio             3000
   → Kong gateway expose le tout via db-dev.smartefp.com:8000
   → Schéma SQL dédié : eaumalik.* (isolé des autres projets)
```

> **Aucun service existant n'est arrêté.** On ajoute un container Next.js sur le réseau `supabase-prod-net` (stack Supabase self-hosted) déjà en place.

---

## Pré-requis (une seule fois)

### 1. Clés SSH et accès
- Alias SSH `smartserveur` doit fonctionner : `ssh smartserveur echo OK`
- Docker local installé (pour le build)

### 2. Récupérer les credentials Supabase côté serveur

```bash
ssh smartserveur

# JWT secret de auth-prod (= service role key partagée)
docker exec auth-prod printenv GOTRUE_JWT_SECRET

# Clé anon (regénère-la si besoin depuis Studio : Settings > API > anon)
docker exec auth-prod printenv GOTRUE_JWT_SECRET
# Ou via le Studio déjà exposé sur studio.smartefp.com
```

### 3. Renseigner `.env.prod` (local, jamais commité)

```bash
cd eaumalik-saas
cp .env.prod.example .env.prod
# Éditer et coller les vraies valeurs
nano .env.prod
```

Valeurs à mettre :
```env
NEXT_PUBLIC_APP_URL=https://eaumalik.com
NEXT_PUBLIC_SUPABASE_URL=https://db-dev.smartefp.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
NEXT_PUBLIC_USE_MOCKS=false
NODE_ENV=production
```

---

## Étape 1 — Créer le schéma SQL EAUMALIK (une seule fois)

```bash
ssh smartserveur 'docker exec -i db-prod psql -U postgres' < supabase/schema-eaumalik.sql
```

Vérif :
```bash
ssh smartserveur 'docker exec db-prod psql -U postgres -c "\dt eaumalik.*"'
```

Attendu : 9 tables (company_profile, users, products, orders, order_items, maintenance_alerts, messages, news, carts).

---

## Étape 2 — Premier déploiement

```bash
cd eaumalik-saas
./scripts/deploy.sh
```

Le script :
1. Build l'image Docker locale : `eaumalik-saas:<timestamp>` + `:latest`
2. Export en tar.gz → SCP vers le serveur
3. `docker load` sur le serveur
4. Supprime l'ancien container et relance
5. Attend le healthcheck Docker

À la fin il affiche l'IP du container dans le réseau `supabase-prod-net` (ex : `10.0.5.x`).

---

## Étape 3 — Ajouter le bloc Caddy

Sur le serveur, éditer `/etc/caddy/Caddyfile` :

```bash
ssh smartserveur 'sudo nano /etc/caddy/Caddyfile'
```

Ajouter **avant** le bloc `:80 { ... }` :

```caddy
# ─── EAUMALIK SARL ───
eaumalik.com, www.eaumalik.com {
    encode zstd gzip
    reverse_proxy 10.0.1.45:3000 {        # ← adapter à l'IP affichée par deploy.sh
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto https
    }
    log {
        output file /var/log/caddy/eaumalik-access.log {
            roll_size 100mb
            roll_keep 5
            roll_keep_for 720h
        }
        level INFO
    }
}
```

> **Caddy génère automatiquement le certificat Let's Encrypt** au reload — pas besoin de certbot.

Recharger :
```bash
ssh smartserveur 'sudo systemctl reload caddy'
# Ou : docker kill -s HUP caddy
```

Test :
```bash
curl -I https://eaumalik.com
# Attendu : 200 OK + headers HSTS
```

---

## Étape 4 — Créer le premier superadmin

```bash
ADMIN_EMAIL=admin@eaumalik.com \
ADMIN_PASSWORD='VotreMotDePasseFort123' \
  ./scripts/create-admin.sh
```

> Mot de passe : min 8 caractères, 1 majuscule, 1 chiffre.

Puis se connecter sur `https://eaumalik.com/login` → redirection auto vers `/admin`.

---

## Étape 5 — Seed des données démo (optionnel)

```bash
ssh smartserveur
docker exec -i db-prod psql -U postgres < /opt/eaumalik/seed-demo.sql
```

(Le schéma `schema-eaumalik.sql` inclut déjà quelques produits démo.)

---

## Mises à jour ultérieures

```bash
git pull                  # récupère le code
./scripts/deploy.sh       # rebuild + redeploy
```

### Rollback

```bash
./scripts/deploy.sh --rollback
```

Le script garde le tag de l'image précédente dans `/opt/eaumalik/.last_image`.

---

## Commandes utiles

```bash
# Logs en direct
ssh smartserveur 'docker logs -f eaumalik-app'

# Healthcheck
ssh smartserveur 'docker inspect --format "{{.State.Health.Status}}" eaumalik-app'

# Shell dans le container
ssh smartserveur 'docker exec -it eaumalik-app sh'

# Backup DB (dump schema eaumalik uniquement)
ssh smartserveur "docker exec db-prod pg_dump -U postgres --schema=eaumalik > eaumalik-$(date +%F).sql"

# Restaurer
scp eaumalik-2026-XX-XX.sql smartserveur:/tmp/
ssh smartserveur "cat /tmp/eaumalik-2026-XX-XX.sql | docker exec -i db-prod psql -U postgres"

# Stats container
ssh smartserveur 'docker stats eaumalik-app --no-stream'
```

---

## Variables d'environnement — détail

| Var | Description | Source |
|-----|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL publique du gateway Kong | `https://db-dev.smartefp.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | JWT anon | `auth-prod` env `GOTRUE_JWT_SECRET` (re-vérifier) |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT service role | Idem |
| `NEXT_PUBLIC_APP_URL` | URL canonique | `https://eaumalik.com` |
| `NEXT_PUBLIC_USE_MOCKS` | Bypass DB | `false` en prod |
| `NODE_ENV` | Mode Next.js | `production` |

---

## Troubleshooting

### Erreur `ECONNREFUSED 10.0.1.45:3000` côté Caddy
→ Le container n'est pas sur le bon réseau. Vérifier :
```bash
ssh smartserveur 'docker network inspect supabase-prod-net | grep eaumalik-app'
# Si absent :
ssh smartserveur 'docker network connect supabase-prod-net eaumalik-app'
```

### `auth.jwt() ->> 'role'` ne fonctionne pas dans les policies RLS
→ C'est normal : on utilise `eaumalik.is_admin()` qui lit `eaumalik.users.role` à la place (cf. migration).

### Le login renvoie "Authentification indisponible"
→ Vérifier `.env.prod` : `NEXT_PUBLIC_USE_MOCKS=false` ET `NEXT_PUBLIC_SUPABASE_URL` valide.

### `502 Bad Gateway` au reload Caddy
→ Mauvaise IP dans le bloc Caddy. Récupérer la bonne :
```bash
ssh smartserveur 'docker inspect --format "{{.NetworkSettings.Networks.supabase-prod-net.IPAddress}}" eaumalik-app'
```

---

## Architecture réseau Docker

```
              ┌──────────────────────────┐
              │     bridge (default)     │
              │                          │
              │   eaumalik-app ◄─────────┼── caddy → eaumalik.com:443
              │                          │
              └──────────┬───────────────┘
                         │
                  réseau supabase-prod-net (10.0.5.x, 10.0.6.x)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   db-prod         auth-prod         rest-prod
   10.0.5.x:5432   10.0.5.x:9999    10.0.5.x:3000
        │                │                │
        └─────── kong-prod (gateway) ─────┘
                  db-dev.smartefp.com:8000
```
