# Fix Forgot-Password — EAUMALIK (2026-07-16)

## Diagnostic

L'utilisateur `younesoumalik@gmail.com` ne reçoit pas l'email de réinitialisation
après un `POST /api/auth/forgot-password`.

### Tests API
- `https://db.eaumalik.com/auth/v1/health` → **200 OK** (auth-prod vivant).
- `POST https://db.eaumalik.com/auth/v1/recover` → **200 OK** puis 429 rate limit (normal).
- Logs auth-prod : l'audit `user_recovery_requested` est bien créé, **mais aucun log SMTP**.

### Causes racines identifiées

#### 1. SMTP GoTrue **non configuré pour la prod**
Fichier `/opt/eaumalik-supabase/_stack/.env` (extrait) :

```bash
GOTRUE_SMTP_HOST=                 # ← vide
GOTRUE_SMTP_USER=                 # ← vide
GOTRUE_SMTP_PORT=2500             # ← port MailPit dev, jamais remplacé
GOTRUE_SMTP_PASS=...              # ← set mais inutile
GOTRUE_SMTP_ADMIN_EMAIL=admin@eaumalik.com   # ← mauvais domaine
GOTRUE_SMTP_SENDER_NAME=SmartApp Dev         # ← mauvais nom
```

**Conséquence** : GoTrue accepte les requêtes, journalise `user_recovery_requested`,
mais ne tente **aucun envoi SMTP** (silencieusement).

#### 2. DNS `eaumalik.com` non préparé pour Resend
- ❌ Pas de TXT SPF (`v=spf1 include:resend.dev ~all`)
- ❌ Pas de CNAME DKIM (`resend._domainkey.eaumalik.com`)
- ❌ Pas de TXT DMARC (`_dmarc.eaumalik.com`)
- ✅ MX OK (`10 mail.eaumalik.com`)

**Conséquence** : Gmail va rejeter/spammer les mails venant de `eaumalik.com`.

DNS géré chez **Contabo** (NS : `ns1.contabo.net`, `ns2.contabo.net`, `ns3.contabo.net`).

#### 3. `GOTRUE_SITE_URL` + `GOTRUE_URI_ALLOW_LIST` pointent vers dev
```bash
GOTRUE_SITE_URL=https://eaumalik.com
GOTRUE_URI_ALLOW_LIST=https://db.eaumalik.com
```

**Conséquence** : si le template email utilise `{{ .SiteURL }}` (au lieu de
`{{ .ConfirmationURL }}`), le lien de reset renvoie vers le dashboard Supabase
au lieu de l'app. Et Supabase peut refuser le `redirectTo=https://eaumalik.com/...`
car non listé dans `URI_ALLOW_LIST`.

---

## Plan de correction (3 étapes)

### Étape A — DNS Contabo (à faire via https://my.contabo.com → DNS Management)

Ajouter 4 records sur la zone `eaumalik.com` :

| Type  | Host                                | Value                                                                                | TTL  |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------ | ---- |
| TXT   | `eaumalik.com`                      | `v=spf1 include:resend.dev ~all`                                                     | 3600 |
| CNAME | `resend._domainkey.eaumalik.com`    | `resend._domainkey.resend.dev` (Resend donne la valeur exacte dans leur dashboard)  | 3600 |
| CNAME | `resend2._domainkey.eaumalik.com`   | `resend2._domainkey.resend.dev` (si Resend l'indique, sinon facultatif)              | 3600 |
| TXT   | `_dmarc.eaumalik.com`               | `v=DMARC1; p=none; rua=mailto:admin@eaumalik.com`                                    | 3600 |

> La valeur exacte des CNAME DKIM est fournie par Resend quand on ajoute
> le domaine : https://resend.com/domains → `eaumalik.com` → "Verify".
> Après ajout, attendre 5-30 min la propagation.

### Étape B — Clé API Resend

1. Aller sur https://resend.com → API Keys.
2. Si pas de clé pour `eaumalik-prod` → **Create API Key** (scope `Sending access`,
   nom `eaumalik-prod`).
3. **Copier la clé immédiatement** (`re_...`), elle ne s'affiche qu'une fois.
4. Stocker dans Bitwarden (coffre `EAUMALIK-PROD`).

### Étape C — Fix du `.env` stack + restart auth-prod

Sur le VPS :

```bash
# 1. Copier le script de fix (déjà ajouté dans le repo)
scp eaumalik-saas/scripts/fix-forgot-password.sh smartserveur:/tmp/

# 2. Lancer (root) — le script demande la clé Resend interactivement
ssh smartserveur 'sudo bash /tmp/fix-forgot-password.sh'
```

Le script :

1. Backup `/opt/eaumalik-supabase/_stack/.env`.
2. Patche les variables :
   ```bash
   GOTRUE_SMTP_HOST=smtp.resend.com
   GOTRUE_SMTP_PORT=465
   GOTRUE_SMTP_USER=resend
   GOTRUE_SMTP_PASS=<RESEND_API_KEY>
   GOTRUE_SMTP_ADMIN_EMAIL=no-reply@eaumalik.com
   GOTRUE_SMTP_SENDER_NAME=EAUMALIK
   GOTRUE_SITE_URL=https://eaumalik.com
   GOTRUE_URI_ALLOW_LIST=https://db.eaumalik.com,https://eaumalik.com,http://localhost:3000
   ```
3. `chmod 600` sur le `.env`.
4. `docker compose restart auth-prod`.
5. Attend que `/auth/v1/health` réponde 200.
6. Affiche l'env runtime pour confirmation.

---

## Vérification post-fix

### 1. Test bas-niveau (sans UI)

```bash
# Sur smartserveur, vérifie qu'un envoi passe par SMTP :
ssh smartserveur 'sudo docker logs auth-prod -f 2>&1 | grep -iE "smtp|mail|email"'
# Doit afficher, après un /recover : "sending email to ..." + connexion smtp.resend.com:465.
```

### 2. Test end-to-end via Next.js

```bash
# Récupérer un captcha valide (depuis l'UI) puis en curl :
curl -sS -X POST https://eaumalik.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -H "Cookie: eaumalik_captcha=<TOKEN>" \
  -d '{"email":"younesoumalik@gmail.com","captcha_answer":"<ANSWER>"}'
# Doit renvoyer {"ok":true,"message":"Si un compte existe..."}
```

### 3. Vérifier la délivrabilité

- Dans la boîte `younesoumalik@gmail.com` : chercher dans **Spam / Indésirables**.
- Dans https://resend.com/emails : le mail doit apparaître avec status `Delivered`.
- Si `Bounced` : cliquer pour voir le code SMTP (`550 5.7.1 ... SPF check failed`
  = SPF pas encore propagé, attendre).

### 4. Vérifier le lien cliqué

Le mail doit contenir un bouton/lien du type :
```
https://db.eaumalik.com/auth/v1/verify?token=...&type=recovery&redirect_to=https://eaumalik.com/login/reinitialiser
```

Cliquer → ouvre `https://eaumalik.com/login/reinitialiser` → page de saisie du
nouveau mot de passe.

---

## Si ça échoue encore

| Symptôme | Cause probable | Action |
| --- | --- | --- |
| Pas de log SMTP dans auth-prod après /recover | `GOTRUE_SMTP_HOST` pas pris en compte | `docker exec auth-prod env \| grep SMTP_*` puis `docker compose restart auth-prod` |
| Log SMTP mais erreur `dial tcp: lookup smtp.resend.com: no such host` | DNS du container KO | `docker exec auth-prod nslookup smtp.resend.com` |
| Log SMTP `auth failed` | Clé Resend invalide/révoquée | Vérifier https://resend.com/api-keys, générer une nouvelle |
| Gmail refuse le mail (550 SPF) | DNS pas propagé | Attendre 30min, puis `dig +short TXT eaumalik.com` |
| Gmail met le mail en Spam | Pas de DKIM | Vérifier CNAME DKIM Resend avec `dig +short CNAME resend._domainkey.eaumalik.com` |
| Clic lien → "redirect URL not allowed" | `GOTRUE_URI_ALLOW_LIST` incomplet | Réexécuter le script de fix (étape C) |

---

## À faire ENSUITE (hors-scope)

- [ ] Activer **2FA TOTP** sur le dashboard Resend
- [ ] Configurer une **alerte** sur le dashboard Resend si bounce rate > 5 %
- [ ] Activer le **rate-limiting** Supabase par IP (Auth → Rate Limits) pour limiter
      les abus sur `/recover` (cf. F-08 du SECURITY-AUDIT)
- [ ] Monitorer dans `eaumalik-app` les erreurs d'envoi (à ajouter dans le logger Next.js)