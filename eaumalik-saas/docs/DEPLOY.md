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

## Déploiement automatisé (Webhook GitHub)

**Approche actuelle** (depuis 2026-07-15) : webhook GitHub → service Node.js sur le VPS → git pull + docker build + restart. **Aucune dépendance externe**, **zéro token**, **zéro runner à maintenir**. Aussi simple que Vercel/Hostinger.

```
┌──────────────┐         HTTPS POST                ┌─────────────────────┐
│  git push    │ ─────────────────────────────────► │ eaumalik.com/webhook│
│  origin main │   HMAC SHA-256 signé              │   (Caddy → :9000)   │
│              │                                    │  Node.js service    │
└──────────────┘                                    └──────────┬──────────┘
                                                              │ vérifie
                                                              ▼
                                                    ┌─────────────────────┐
                                                    │  deploy-on-push.sh  │
                                                    │  - git fetch+reset  │
                                                    │  - docker build     │
                                                    │  - docker run       │
                                                    │  - healthcheck      │
                                                    │  - smoke test       │
                                                    └──────────┬──────────┘
                                                              ▼
                                                    eaumalik-app (port 3100)
                                                    sur réseau supabase-prod-net
```

### Pourquoi un webhook plutôt que GitHub Actions ?

| Critère | Webhook (actuel) | GitHub Actions runner |
|---------|------------------|------------------------|
| Coût | Gratuit | Minutes GitHub consommées |
| Latence | 1-3 min | 3-7 min (queue + build VM) |
| Complexité | 1 service systemd | Runner + PAT + secrets + reviewer |
| Logs | `journalctl -u eaumalik-webhook` | UI GitHub |
| Visibilité UI | ❌ Pas de badge | ✅ Badge sur le commit |
| Rollback | Re-tag + redeploy manuel | Bouton Re-run |

→ Pour un projet solo/dev, le webhook est imbattable. Garder GitHub Actions serait utile seulement pour des matrices multi-OS ou une review visuelle par PR.

### Installation (une seule fois)

#### Prérequis côté VPS
- Docker Engine ≥ 24.0
- Docker Compose v2 (plugin)
- Accès `sudo`
- Caddy déjà configuré (déjà le cas ici)
- Le réseau Docker `supabase-prod-net` existant (déjà le cas)

#### Étape 1 — Installation du service webhook

```bash
# Sur le VPS, en tant que root :
cd /opt/eaumalik
bash install-webhook.sh
```

Ce script :
1. Clone le repo dans `/opt/eaumalik/repo`
2. Crée `/etc/eaumalik/webhook-secret` (HMAC 32 bytes hex)
3. Installe le service systemd `eaumalik-webhook.service`
4. Démarre le service et affiche les instructions

#### Étape 2 — Configuration Caddy (route `/webhook`)

Ajouter dans `/etc/caddy/eaumalik.conf` :

```caddy
eaumalik.com, www.eaumalik.com {
    encode zstd gzip

    @webhook path /webhook /health
    handle @webhook {
        reverse_proxy 127.0.0.1:9000
    }

    handle {
        reverse_proxy 127.0.0.1:3100 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}
```

Recharger : `sudo systemctl reload caddy`

#### Étape 3 — Configuration GitHub

1. Ouvre : `https://github.com/YounesOumalik/eaumalik-saas/settings/hooks/new`
2. Remplis :
   - **Payload URL** : `https://eaumalik.com/webhook`
   - **Content type** : `application/json`
   - **Secret** : contenu de `/etc/eaumalik/webhook-secret` (32 bytes hex)
   - **Which events** : ☑ Just the `push` event
   - **Active** : ✅
3. **Add webhook**

### Utilisation au quotidien

```bash
# Depuis ton poste local :
cd /chemin/vers/eaumalik-saas
# ... fais tes modifs ...
git add .
git commit -m "feat: ma nouvelle fonctionnalité"
git push origin main
# → 1-3 min plus tard : site mis à jour sur https://eaumalik.com
```

### Surveillance

```bash
# Logs webhook (déclenchements push)
sudo journalctl -u eaumalik-webhook -f

# Logs du dernier deploy (build Docker, healthcheck, smoke test)
sudo ls -t /var/log/eaumalik-deploy/ | head -1 | xargs sudo tail -f

# Healthcheck externe
curl https://eaumalik.com/health
# → {"status":"ok","service":"eaumalik-webhook"}

# Container status
sudo docker ps --filter name=eaumalik-app
```

### Fallback manuel (si webhook tombe)

Le script `scripts/deploy.sh` historique reste fonctionnel :

```bash
cd eaumalik-saas
./scripts/deploy.sh              # deploy normal
./scripts/deploy.sh --rollback   # rollback
./scripts/deploy.sh --no-build   # réutilise l'image :latest locale
```

### Rollback manuel

Le script `deploy-on-push.sh` garde les **3 derniers tags** pour permettre un rollback :

```bash
ssh smartserveur
# Lister les tags disponibles
sudo docker images eaumalik-saas --format "{{.Tag}} {{.CreatedAt}}" | head -5

# Restaurer un tag spécifique
sudo docker rm -f eaumalik-app
sudo docker run -d --name eaumalik-app \
  --network supabase-prod-net \
  --env-file /opt/eaumalik/.env \
  -e HOSTNAME=0.0.0.0 -e PORT=3100 \
  -p 127.0.0.1:3100:3100 \
  --restart unless-stopped \
  eaumalik-saas:<TAG_A_RESTAUER>
```

### Troubleshooting

| Symptôme | Cause probable | Fix |
|----------|---------------|-----|
| Push ne déclenche rien | Webhook GitHub non configuré ou erreur 4xx | Onglet **Webhooks** du repo → **Recent deliveries** |
| `HTTP 401 Invalid signature` dans les logs | Secret HMAC désynchronisé entre GitHub et le VPS | Vérifier `sudo cat /etc/eaumalik/webhook-secret` correspond à celui configuré dans GitHub |
| `EACCES: permission denied, mkdir '/app/data-store'` | Dockerfile pas à jour | Pull + rebuild : `cd /opt/eaumalik/repo && git pull && bash deploy-on-push.sh HEAD` |
| `npm ci: package-lock.json missing` | `package-lock.json` gitignoré volontairement | Dockerfile utilise `npm install` (pas `npm ci`), vérifier la dernière version |
| `Connection reset by peer` sur / | Container écoute sur 127.0.0.1 au lieu de 0.0.0.0 | Vérifier `-e HOSTNAME=0.0.0.0` dans `deploy-on-push.sh` |
| Container crash immédiatement | Mauvais .env ou NEXT_PUBLIC_* manquant | `docker logs eaumalik-app --tail 50` |
| Build trop long (>5 min) | Cache BuildKit non réutilisé | `docker builder prune -af` puis rebuild |
| Disk plein (image accumulées) | Vieux tags non nettoyés | `docker image prune -af` (⚠️ supprime tout) |

### Sécurité du webhook

- ✅ **HMAC SHA-256** : chaque requête est signée avec un secret partagé. Une requête non signée est rejetée en `401`.
- ✅ **Branch filter** : seuls les pushes sur `main` déclenchent un deploy.
- ✅ **Service systemd** : tourne en user `younes`, pas root. Pas de capabilities excessives.
- ✅ **Pas de token GitHub** : impossible de compromettre le compte GitHub via ce canal.
- ✅ **Logs auditables** : chaque deploy laisse un fichier `/var/log/eaumalik-deploy/deploy-*.log` complet.
| `DEPLOY_USER` | `younes` (User du bloc `smartserveur`) |
| `ENV_PROD` | Contenu **exact** de `.env.prod` local (contient les clés Supabase service-role) |

### Notes

- Le `.env` du serveur (`/opt/eaumalik/.env`) est **recréé à chaque déploiement** depuis le secret `ENV_PROD` (idempotent, autonome — aucune étape manuelle préalable sur le serveur).
- `deploy.sh --rollback` reste utilisable manuellement en cas de besoin (le tag précédent est sauvegardé dans `/opt/eaumalik/.last_image`).
- Un groupe `concurrency: deploy-smartserveur` empêche 2 pushes rapides de lancer 2 déplois concurrents.
- Le réseau `supabase-prod-net` et le bloc Caddy sont gérés séparément (étapes « une seule fois » ci-dessus).

### Vérification post-déploiement

```bash
# Onglet Actions : workflow vert + log « ✅ Container eaumalik-app healthy »
curl -sI https://eaumalik.com          # Attendu : 200 + HSTS
ssh smartserveur 'docker ps --filter name=eaumalik-app'   # Up ... (healthy)
```

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
