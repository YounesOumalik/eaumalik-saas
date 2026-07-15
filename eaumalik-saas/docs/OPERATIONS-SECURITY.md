# Operations & Security — EAUMALIK SaaS

**Audience** : propriétaires du projet (Younes) + tout intervenant ayant accès au VPS ou au dashboard Supabase.
**Date de création** : 2026-07-15
**Statut** : **vivant** — à relire à chaque incident / rotation / nouveau déploiement.

---

## Sommaire

1. [Hygiène des secrets](#1-hygiène-des-secrets)
2. [Gestion des accès admin](#2-gestion-des-accès-admin)
3. [Récupération de mot de passe (flow utilisateur)](#3-récupération-de-mot-de-passe-flow-utilisateur)
4. [Configuration SMTP pour l'envoi d'emails](#4-configuration-smtp-pour-lenvoi-demails)
5. [2FA sur les comptes critiques](#5-2fa-sur-les-comptes-critiques)
6. [Procédure de rotation des clés](#6-procédure-de-rotation-des-clés)
7. [Checklist pré-déploiement](#7-checklist-pré-déploiement)

---

## 1. Hygiène des secrets

### 1.1 Ce qui est versionné (OK)

| Fichier                       | Contenu                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `.env.local.example`          | Template dev, valeurs factices (`YOUR-ANON-KEY`...)       |
| `.env.prod.example`           | Template prod, placeholders (`<COLLER_...>`)              |
| `*.example.toml` / `*.json`   | Configs publiques                                         |

### 1.2 Ce qui n'est JAMAIS versionné

- `.env`, `.env.local`, `.env.prod`, `.env.production`, `.env.staging`, etc.
  → Bloqué par `.gitignore` (`/^\.env/` + `!.env.*.example`).
- Toute clé JWT (anon / service role Supabase), `CAPTCHA_SECRET`, clés API Resend/Stripe/…
- Les credentials SSH (`.ssh/`) — protégés par `chmod 600` côté OS.

### 1.3 Où sont stockés les vrais secrets (runtime)

| Environnement  | Emplacement                                                       | Permissions       |
| -------------- | ----------------------------------------------------------------- | ----------------- |
| **Dev local**  | `~/.1password/...` ou `~/Vaultwarden/...` (gestionnaire mdp)      | coffre-fort mdp   |
| **VPS prod**   | `/opt/eaumalik/.env.prod` (`chmod 600`, owner `root` ou `eaumalik`) | `chmod 600`       |
| **CI / runner**| GitHub Actions Secrets (jamais en clair dans les logs)            | scope `repo`      |

> **Règle d'or** : un secret commité dans git = secret considéré comme compromis, à **rotater immédiatement**.

### 1.4 Gestionnaire de secrets recommandé

Choix par ordre de préférence :

1. **Bitwarden** (gratuit, self-hostable sur le VPS, client desktop + mobile)
2. **1Password** (payant, UX excellente, équipes)
3. **HashiCorp Vault** (surdimensionné pour ce projet, mais OK si l'écosystème grossit)

Vault d'équipe Bitwarden (recommandé pour ce projet) :

- Créer un coffre `EAUMALIK-PROD` partagé entre les admins de confiance.
- Stocker : anon key, service role key, `CAPTCHA_SECRET`, `SMTP_PASSWORD`, mot de passe admin, URL dashboard Supabase, URL adminer, etc.
- Activer la 2FA sur le compte Bitwarden.
- Audit log accessible à tous les membres.

---

## 2. Gestion des accès admin

### 2.1 Comptes admin en base

```bash
# Lister les admins
ssh smartserveur 'docker exec db-prod psql -U postgres -c "SELECT id, email, role, created_at FROM eaumalik.users WHERE role = '\''admin'\'';"'
```

### 2.2 Créer un superadmin

```bash
ADMIN_EMAIL=nouveau.admin@eaumalik.com \
ADMIN_PASSWORD='STRONG_PWD_à_générer_avec_bitwarden' \
  ./scripts/create-admin.sh
```

> Le mot de passe doit être généré via le gestionnaire de mots de passe (16+ caractères, généré aléatoirement), **jamais inventé à la main**.

### 2.3 Promouvoir un client en admin (sans recréer le compte)

```bash
ssh smartserveur "docker exec db-prod psql -U postgres -c \"UPDATE eaumalik.users SET role='admin', updated_at=now() WHERE email='user@example.com';\""
```

### 2.4 Révoquer un admin

```bash
ssh smartserveur "docker exec db-prod psql -U postgres -c \"UPDATE eaumalik.users SET role='client', updated_at=now() WHERE email='ex.admin@eaumalik.com';\""
```

Puis **désactiver le compte auth** (sinon l'utilisateur peut toujours se logger) :

```bash
ssh smartserveur "docker exec auth-prod psql -U postgres -c \"UPDATE auth.users SET banned_until='2099-01-01' WHERE email='ex.admin@eaumalik.com';\""
```

### 2.5 Récupérer l'accès si on a tout perdu

1. Se logger au VPS via SSH avec la clé privée (`~/.ssh/id_smartserveur`).
2. Générer un nouveau mot de passe admin via le script ci-dessus (la service role key étant sur le VPS, on peut bypasser l'auth).
3. Si la service role key elle-même est compromise → voir §6 (rotation d'urgence).

---

## 3. Récupération de mot de passe (flow utilisateur)

### 3.1 Parcours utilisateur

```
[Page /login]
   └─ Clic "Mot de passe oublié"
       └─ /login/mot-de-passe-oublie
           └─ Saisit email + CAPTCHA
               └─ POST /api/auth/forgot-password
                   ├─ CAPTCHA validé ✅
                   ├─ Supabase.auth.resetPasswordForEmail(email, {
                   │     redirectTo: https://eaumalik.com/login/reinitialiser
                   │   })
                   └─ Réponse générique (ne révèle pas si email existe)
                       │
                       ▼
   [Email reçu : "Réinitialisez votre mot de passe EAUMALIK"]
   └─ Clic sur le lien → https://eaumalik.com/login/reinitialiser#access_token=...&type=recovery
       └─ /login/reinitialiser
           ├─ getSession() détecte la session de recovery
           ├─ Saisit nouveau MDP + confirmation + CAPTCHA
           └─ supabase.auth.updateUser({ password }) → signOut() → redirect /login
```

### 3.2 Configuration côté Supabase Dashboard

**Auth → URL Configuration** :
- `Site URL` : `https://eaumalik.com`
- `Additional Redirect URLs` :
  - `https://eaumalik.com/login/reinitialiser`
  - `http://localhost:3000/login/reinitialiser` (dev)

**Auth → Email Templates → Reset Password** :
- Subject : `Réinitialisation de votre mot de passe EAUMALIK`
- Body : HTML avec bouton "Réinitialiser mon mot de passe" → `{{ .ConfirmationURL }}`
- Le `{{ .ConfirmationURL }}` pointe déjà vers le `redirectTo` ci-dessus (Supabase injecte le token en hash).

### 3.3 Comportement en mode mock (dev local)

- Pas d'email envoyé — l'URL est loggée dans le container :
  ```
  [forgot-password] Lien de réinitialisation (mode démo) : http://localhost:3000/login/reinitialiser?token=abc...
  ```
- Le token est stocké dans `data-store/password_resets.json` (1h, single-use).
- La page `/login/reinitialiser` détecte `isMockMode()` et bascule sur l'API mock.

### 3.4 Limites connues

- **Pas de rate-limiting** côté app (F-08 du SECURITY-AUDIT) : un attaquant peut spammer `/api/auth/forgot-password`. Mitigation : à court terme, rate-limit Supabase par IP (Auth → Rate Limits).
- **Pas de 2FA sur les comptes users** : voir §5.

---

## 4. Configuration SMTP pour l'envoi d'emails

### 4.1 Pourquoi un SMTP custom ?

Par défaut, Supabase Auth utilise son propre SMTP avec une limite de **~3 emails / heure** — incompatible avec un site en production. Il faut **impérativement** brancher un SMTP custom.

### 4.2 Providers recommandés

| Provider   | Coût         | Délivrabilité | Recommandation |
| ---------- | ------------ | ------------- | -------------- |
| **Resend** | 3 000 mails/mois gratuits, puis $20/mois | ⭐⭐⭐⭐⭐ | **Recommandé** — simple, API HTTP, dashboard clean |
| Brevo (ex-Sendinblue) | 300/jour gratuits | ⭐⭐⭐⭐ | Alternative EU, RGPD-friendly |
| OVH Mail Pro / SMTP OVH | ~3€/mois | ⭐⭐⭐ | Si déjà client OVH (hébergeur VPS) |
| Amazon SES | $0.10 / 1000 mails | ⭐⭐⭐⭐⭐ | Si déjà sur AWS |

### 4.3 Setup avec Resend (recommandé)

1. Créer un compte sur https://resend.com
2. Vérifier le domaine `eaumalik.com` (ajout des DNS `MX` + `TXT SPF` + `CNAME DKIM` indiqués par Resend).
3. Créer une **API Key** : `eaumalik-prod` (scope `Sending access`).
4. Stocker dans Bitwarden (coffre `EAUMALIK-PROD`).
5. Dans Supabase Dashboard → **Auth → SMTP Settings** → **Enable Custom SMTP** :
   - Host : `smtp.resend.com`
   - Port : `465` (SSL) ou `587` (STARTTLS)
   - User : `resend`
   - Password : `<API_KEY_RESEND>`
   - Sender email : `no-reply@eaumalik.com`
   - Sender name : `EAUMALIK`
6. Cliquer **Send test email** pour valider.
7. Mettre à jour `/opt/eaumalik/.env.prod` sur le VPS avec les variables SMTP (même si elles ne sont pas utilisées par Next.js directement, c'est utile pour les opérations).

### 4.4 Vérification post-setup

```bash
# Demande un reset (depuis l'UI ou en curl direct) et vérifie la réception du mail.
ssh smartserveur 'cd /opt/eaumalik && docker logs eaumalik-app 2>&1 | grep -iE "smtp|email|reset" | tail -20'

# Vérifier côté Supabase :
#   Logs → Auth → "send_recovery_email"
#   Doit afficher status 200 et le provider SMTP utilisé.
```

---

## 5. 2FA sur les comptes critiques

### 5.1 Sur Supabase (dashboard & utilisateurs Auth)

⚠️ **Limite connue** : Supabase Auth ne propose **PAS de 2FA TOTP native** pour les utilisateurs finaux. Les options actuelles :

| Méthode                            | Effet                                                      |
| ---------------------------------- | ---------------------------------------------------------- |
| **Magic link / OTP email**         | Connexion sans MDP via code à 6 chiffres reçu par mail      |
| **OAuth (Google, GitHub...)**      | Connexion déléguée au provider (2FA portée par le provider)|
| **Captcha + rate-limiting**        | Anti-bot sur signup/login/reset                            |

**Workaround pour les admins** : ajouter OAuth Google avec compte Google qui a la 2FA activée → la 2FA est alors portée par Google (cf. Supabase Auth → Providers → Google).

### 5.2 Sur les autres services critiques

| Service                | Type de 2FA à activer              | Priorité |
| ---------------------- | ---------------------------------- | -------- |
| **Dashboard Supabase** | TOTP (Authy/Google Authenticator)  | 🔴 P0   |
| **VPS Contabo**        | TOTP via SSH + clé physique (YubiKey si possible) | 🔴 P0 |
| **GitHub** (admin repo)| TOTP obligatoire (Settings → Password and authentication) | 🔴 P0 |
| **Compte email admin** | TOTP (Gmail/Outlook)               | 🔴 P0   |
| **Caddy/Cloudflare DNS** | TOTP                              | 🟠 P1   |
| **Bitwarden** (coffre partagé) | TOTP                             | 🟠 P1   |

### 5.3 Procédure d'activation TOTP sur Supabase Dashboard

1. Se connecter à https://app.supabase.com
2. Cliquer sur l'avatar en haut à droite → **Account Settings**
3. Onglet **Security** → **Two-Factor Authentication** → Enable
4. Scanner le QR code avec **1Password / Bitwarden / Authy / Google Authenticator**
5. Saisir le code de confirmation
6. **Sauvegarder les codes de secours** dans Bitwarden (coffre `EAUMALIK-PROD`)
7. Vérifier la déconnexion / reconnexion : la 2FA est demandée.

### 5.4 Procédure d'activation TOTP sur le VPS

```bash
ssh smartserveur
sudo apt install -y libpam-google-authenticator
google-authenticator
# Répondre : y, y, n, n, y (time-based, no reuse, no confirm)
# Scanner le QR avec Bitwarden → 6 codes de secours dans Bitwarden.

# Activer le PAM module :
sudo nano /etc/pam.d/sshd
# Ajouter en haut :  auth required pam_google_authenticator.so

sudo nano /etc/ssh/sshd_config
# Vérifier :  ChallengeResponseAuthentication yes
#            UsePAM yes

sudo systemctl restart sshd
# ⚠️  GARDER UNE DEUXIÈME SESSION SSH OUVERTE pour ne pas se lock out !
```

---

## 6. Procédure de rotation des clés

### 6.1 Quand rotater ?

- ✅ **Maintenant** (suite à l'incident F-09 du SECURITY-AUDIT : clés JWT committées dans l'historique git, voir commit fix du 2026-07-15)
- ✅ Tous les **90 jours** (cron de rappel)
- ✅ Immédiatement après tout départ d'un intervenant ayant eu accès
- ✅ Immédiatement après toute compromission suspectée

### 6.2 Étapes

#### Étape 1 — Générer de nouvelles clés Supabase

1. Dashboard Supabase → **Settings → API**
2. **Generate new anon key** → copier dans Bitwarden (champ `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. **Generate new service_role key** → ⚠️ NE LA RÉVÈLE QU'UNE FOIS, copier immédiatement dans Bitwarden (champ `SUPABASE_SERVICE_ROLE_KEY`)
4. **Generate new JWT secret** → ⚠️ CELA RÉVOQUE TOUS LES TOKENS EXISTANTS. Copier dans Bitwarden (champ `GOTRUE_JWT_SECRET`).
   → Les utilisateurs devront se reconnecter.

#### Étape 2 — Mettre à jour le VPS

```bash
ssh smartserveur
sudo nano /opt/eaumalik/.env.prod
# Remplacer les 3 clés, enregistrer (chmod 600 respecté)

# Redémarrer les services impactés
docker restart auth-prod     # si service role / JWT secret a changé
docker restart eaumalik-app  # si anon key a changé
```

#### Étape 3 — Mettre à jour CI (si applicable)

```bash
# GitHub Actions → Settings → Secrets and variables → Actions
# Mettre à jour : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CAPTCHA_SECRET
```

#### Étape 4 — Régénérer CAPTCHA_SECRET

```bash
openssl rand -hex 32
# → Copier dans /opt/eaumalik/.env.prod (CAPTCHA_SECRET) + Bitwarden
docker restart eaumalik-app
```

#### Étape 5 — Vérifier

```bash
curl -fsS -o /dev/null -w "eaumalik.com → HTTP %{http_code}\n" https://eaumalik.com/
# Tester login avec un compte client
# Tester forgot-password end-to-end (doit recevoir un email)
```

#### Étape 6 — Purger l'historique git (optionnel mais recommandé)

```bash
# ATTENTION : réécrit tout l'historique, à coordonner avec les autres contributeurs.
brew install git-filter-repo   # ou apt install git-filter-repo
cd /path/to/Eaumalik
git filter-repo --in-place --path eaumalik-saas/.env.prod --path eaumalik-saas/.env.production --invert-paths
git push --force origin main
# Informer tous les co-contributeurs de re-cloner.
```

> Si la rotation a déjà eu lieu à l'étape 1, la purge de l'historique n'est plus critique (les anciennes clés sont invalidées).

---

## 7. Checklist pré-déploiement

À passer en revue avant **chaque `git push origin main`** :

- [ ] **Aucun secret committé** : `git diff --staged | grep -iE "(api_key|password|secret|token|anon_key)" || echo OK`
- [ ] **Aucun fichier `.env` tracké** : `git ls-files | grep -E '^\.env' && echo FAIL || echo OK`
- [ ] **`.gitignore` à jour** : inclut `.env.*` sauf `*.example`
- [ ] **Secrets dans Bitwarden** : tous les secrets prod documentés
- [ ] **2FA active** sur : Supabase dashboard, VPS SSH, GitHub admin
- [ ] **SMTP custom configuré** et test envoyé OK
- [ ] **Rotation ≤ 90 jours** depuis la dernière rotation de clés
- [ ] **Tests E2E** : login, signup, forgot-password (email reçu), reset-password (MDP changé), accès admin
- [ ] **Backup DB récent** : `docker exec db-prod pg_dump -U postgres eaumalik > /opt/backups/eaumalik-$(date +%F).sql`

---

## Annexes

### A. Commandes utiles

```bash
# Logs auth Supabase (qui se connecte, reset emails, etc.)
ssh smartserveur 'docker logs auth-prod --since 1h 2>&1 | grep -iE "(recovery|signup|signin|admin)"'

# Vérifier les policies RLS actives
ssh smartserveur 'docker exec db-prod psql -U postgres -c "SELECT schemaname, tablename, policyname, cmd, qual FROM pg_policies WHERE schemanum IN ('\''public'\'', '\''eaumalik'\'');"'

# Backup complet
ssh smartserveur 'docker exec db-prod pg_dump -U postgres -Fc eaumalik > /opt/backups/eaumalik-$(date +%F).dump'

# Taille du backup
ssh smartserveur 'ls -lh /opt/backups/ | tail -5'
```

### B. Contacts d'urgence

- **Support Supabase** : https://app.supabase.com → Help
- **Support Contabo VPS** : https://my.contabo.com → Support
- **Support Resend** : https://resend.com/support
- **Support Caddy** : https://caddy.community

### C. Liens utiles

- [SECURITY-AUDIT.md](../SECURITY-AUDIT.md) — audit complet + remédiations
- [DEPLOY.md](DEPLOY.md) — procédure de déploiement
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth) — password recovery, JWT, RLS