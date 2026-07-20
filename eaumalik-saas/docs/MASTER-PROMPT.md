# MASTER PROMPT — Finalisation BW + Fix Forgot-Password

## CONTEXTE

Projet : **EAUMALIK SaaS** (Next.js 14 + Supabase self-hosted + Resend pour SMTP)
Localisation : `/home/oumalik-younes/Documents/younes/Eaumalik/`
VPS : `smartserveur` (Contabo, SSH via `~/.ssh/id_smartserveur`)
Domaine : `eaumalik.com` (DNS chez Contabo)
Email cible : `younesoumalik@gmail.com`
Compte admin : `supadmin@gmail.com` (dans BW déjà)
Coffre BW : déjà pré-peuplé avec 3 Secure Notes + 4 Identifiants

## OBJECTIF

1. **Finaliser l'intégration Bitwarden** (`bw` CLI fonctionnel + peuplement complet)
2. **Réparer le forgot-password** (SMTP Resend + DNS Contabo)
3. **Tester end-to-end** (email de reset reçu dans Gmail)

---

## ÉTAPE 1 — Connexion `bw` CLI avec API key (5 min)

### 1.1 Récupérer client_id + client_secret sur le web

Va sur **https://vault.bitwarden.com/#/settings/security**

→ Scroll tout en bas → section **"Clé API"**
→ Clique **"Afficher"** (demande master password)
→ Copie les 2 valeurs dans `/tmp/bw_keys.txt` :

```bash
nano /tmp/bw_keys.txt
# Format :
# CLIENT_ID=user.xxxxxxxxxxxxxxxxxxxxxxx
# CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Ctrl+O, Entrée, Ctrl+X
```

### 1.2 Login + unlock

```bash
# Dans le terminal INTERACTIF (pas via bash -c)
bw login --apikey
# → Coller CLIENT_ID
# → Coller CLIENT_SECRET

# Déverrouiller
bw unlock
# → Saisir master password

# Capturer la session
export BW_SESSION="$(bw unlock --raw)"
echo "Session : ${BW_SESSION:0:30}..."

# Supprimer le fichier de clés
shred -u /tmp/bw_keys.txt 2>/dev/null || rm /tmp/bw_keys.txt
```

### 1.3 Vérification

```bash
bw status
# Doit afficher : "status": "unlocked"

bw list items --session "$BW_SESSION" | python3 -c "
import sys, json
items = json.load(sys.stdin)
print(f'✅ {len(items)} items dans le coffre')
for it in items:
  print(f\"  - {it.get('name','?')} [{it.get('type')}]\")
"
# Doit afficher 8 items (3 Secure Notes EAUMALIK + 4 Logins + 1 my.contabo)
```

---

## ÉTAPE 2 — Persistance de la session BW (optionnel, 2 min)

### 2.1 Ajouter à ~/.bashrc

```bash
cat >> ~/.bashrc <<'EOF'

# Bitwarden session (renouvelable)
export BW_SESSION="$(bw unlock --raw 2>/dev/null)"
EOF
source ~/.bashrc
```

### 2.2 Tester l'intégration du module push

```bash
bash -c '
source /home/oumalik-younes/Documents/younes/Eaumalik/eaumalik-saas/scripts/bitwarden-push.sh
echo "Mode détecté : $BW_MODE"
bw_check
'
# Attendu : "✓ bw CLI détecté et déverrouillé — push automatique activé."
```

---

## ÉTAPE 3 — Peuplement initial des Secure Notes manquants (10 min)

### 3.1 Lancer le script de peuplement (à créer)

À ce stade, demande à Copilot de créer **`scripts/bw-populate.sh`** qui :

```bash
#!/usr/bin/env bash
# Récupère tous les secrets depuis le VPS et crée les Secure Notes manquants dans BW
# Usage : ./scripts/bw-populate.sh
```

Ce script doit :
1. `ssh smartserveur` pour lire `/opt/eaumalik-supabase/_stack/.env` + `/opt/eaumalik/.env`
2. Extraire : `JWT_SECRET`, `VAULT_ENC_KEY`, `POSTGRES_PASSWORD`, `CAPTCHA_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`
3. Utiliser `bw create item` pour créer/mettre à jour les Secure Notes avec les noms suivants :

| Nom BW (exact)                                | Source                                      |
| --------------------------------------------- | ------------------------------------------- |
| `EAUMALIK — Supabase JWT_SECRET`              | `JWT_SECRET` dans stack .env                |
| `EAUMALIK — Supabase VAULT_ENC_KEY`           | `VAULT_ENC_KEY` dans stack .env             |
| `EAUMALIK — Postgres POSTGRES_PASSWORD`       | `POSTGRES_PASSWORD` dans stack .env         |
| `EAUMALIK — Supabase ANON_KEY`                | `ANON_KEY` dans stack .env                  |
| `EAUMALIK — Supabase SERVICE_ROLE_KEY`        | `SERVICE_ROLE_KEY` dans stack .env          |
| `EAUMALIK — CAPTCHA_SECRET`                   | `CAPTCHA_SECRET` dans app .env              |

### 3.2 Vérification post-peuplement

```bash
bw list items --search "EAUMALIK" --session "$BW_SESSION" | python3 -c "
import sys, json
items = json.load(sys.stdin)
print(f'✅ {len(items)} items EAUMALIK trouvés')
for it in items:
  print(f\"  - {it.get('name')}\")
"
```

### 3.3 Items à créer MANUELLEMENT (ne peuvent pas être auto-pullés)

| Nom BW (à créer sur le web)                   | Valeur                                       |
| --------------------------------------------- | -------------------------------------------- |
| `EAUMALIK — Resend API_KEY`                   | À créer sur https://resend.com/api-keys      |
| `EAUMALIK — 2FA Supabase recovery codes`      | Settings → Security → 2FA recovery           |
| `EAUMALIK — 2FA GitHub recovery codes`        | https://github.com/settings/security        |
| `EAUMALIK — 2FA VPS recovery codes`           | Codes `google-authenticator` sur smartserveur|
| `EAUMALIK — 2FA Resend recovery codes`        | Settings → Security → 2FA recovery           |
| `EAUMALIK — Admin password eaumalik.com`      | MDP du compte `supadmin@gmail.com`           |

---

## ÉTAPE 4 — Création de la clé API Resend (5 min)

### 4.1 Sur https://resend.com

1. Login sur https://resend.com
2. **Domains** → ajoute `eaumalik.com`
3. Resend te donne les DNS à ajouter (voir Étape 5)
4. **API Keys** → **Create API Key**
   - Name : `eaumalik-prod`
   - Permission : `Sending access`
   - Domain : `eaumalik.com` (si demandé)
5. **Copie la clé** (`re_xxxxxxxxxxxxxxxxx`) → stocke-la dans BW :
   - Sur https://vault.bitwarden.com → **Nouveau** → **Note sécurisée**
   - Nom : `EAUMALIK — Resend API_KEY`
   - Notes : colle la clé `re_...`
   - Champs custom : `domain=eaumalik.com`, `created_at=2026-07-16`

---

## ÉTAPE 5 — Ajout des DNS chez Contabo (10 min + 30 min propagation)

### 5.1 Sur https://my.contabo.com

1. DNS Management → zone `eaumalik.com`
2. Ajoute ces 4 records (les valeurs exactes viennent de Resend) :

| Type  | Host                                 | Value                                          |
| ----- | ------------------------------------ | ---------------------------------------------- |
| TXT   | `eaumalik.com`                       | `v=spf1 include:resend.dev ~all`               |
| CNAME | `resend._domainkey.eaumalik.com`     | `resend._domainkey.resend.dev` (Resend donne) |
| CNAME | `resend2._domainkey.eaumalik.com`    | `resend2._domainkey.resend.dev` (si Resend)    |
| TXT   | `_dmarc.eaumalik.com`                | `v=DMARC1; p=none; rua=mailto:admin@eaumalik.com` |

### 5.2 Vérification

```bash
# Sur ton poste dev
dig +short TXT eaumalik.com
# → Doit afficher : "v=spf1 include:resend.dev ~all"

dig +short CNAME resend._domainkey.eaumalik.com
# → Doit afficher : resend._domainkey.resend.dev.

dig +short TXT _dmarc.eaumalik.com
# → Doit afficher : "v=DMARC1; p=none; rua=mailto:admin@eaumalik.com"
```

### 5.3 Vérifier sur Resend

Sur https://resend.com/domains → `eaumalik.com` → status doit passer à **"Verified"**.

---

## ÉTAPE 6 — Récupérer la clé Resend depuis BW (1 min)

Sur le web vault, ouvre la note `EAUMALIK — Resend API_KEY`, copie la valeur.

OU via CLI :

```bash
bw get notes "EAUMALIK — Resend API_KEY" --session "$BW_SESSION"
```

⚠️ **NE PAS coller cette clé dans le chat** — donne-la directement dans le terminal quand tu lances le script.

---

## ÉTAPE 7 — Lancer le script de fix SMTP (2 min)

### 7.1 Copier le script sur le VPS

```bash
scp /home/oumalik-younes/Documents/younes/Eaumalik/eaumalik-saas/scripts/fix-forgot-password.sh smartserveur:/tmp/
```

### 7.2 Exécuter

```bash
ssh smartserveur
sudo bash /tmp/fix-forgot-password.sh
```

→ Le script te demande la clé Resend : colle-la (input masqué)
→ Il patche `/opt/eaumalik-supabase/_stack/.env` (backup auto)
→ Redémarre `auth-prod`
→ Vérifie la santé
→ **Push automatique de la clé Resend dans BW** (via bitwarden-push.sh)

---

## ÉTAPE 8 — Test end-to-end (5 min)

### 8.1 Vérifier les logs SMTP

```bash
# Sur le VPS, dans un autre terminal
ssh smartserveur 'sudo docker logs auth-prod -f 2>&1 | grep -iE "smtp|mail|email|recovery"'
```

### 8.2 Demande un reset depuis l'UI

Ouvre https://eaumalik.com/login/mot-de-passe-oublie

- Email : `younesoumalik@gmail.com`
- CAPTCHA : résous-le
- **Envoyer**

### 8.3 Vérifications

| Quoi | Où | Attendu |
| ---- | -- | ------- |
| Log GoTrue | `auth-prod` logs | `sending email to younesoumalik@gmail.com` + connexion `smtp.resend.com:465` |
| Email Resend | https://resend.com/emails | Status `Delivered` (pas `Bounced`) |
| Gmail | https://mail.google.com | Email dans boîte de réception (ou Spam) avec sujet "Réinitialisation..." |
| Lien cliqué | Email → bouton | Redirige vers `https://eaumalik.com/login/reinitialiser` |

---

## ÉTAPE 9 — Troubleshooting

### Si le mail arrive en Spam Gmail

- Vérifier DNS SPF + DKIM : `dig +short TXT eaumalik.com`, `dig +short CNAME resend._domainkey.eaumalik.com`
- Attendre 30 min la propagation DNS

### Si le mail n'arrive PAS du tout

```bash
ssh smartserveur 'sudo docker logs auth-prod --since 5m 2>&1 | tail -50'
```

Erreurs possibles :
- `dial tcp: lookup smtp.resend.com: no such host` → DNS du container KO
- `auth failed` → Clé Resend invalide (vérifier https://resend.com/api-keys)
- `connection refused` → Port 465 bloqué (tester 587)

### Si "redirect URL not allowed"

```bash
ssh smartserveur 'sudo grep "GOTRUE_URI_ALLOW_LIST" /opt/eaumalik-supabase/_stack/.env'
# Doit contenir : https://eaumalik.com
# Sinon relancer fix-forgot-password.sh (le script l'a déjà ajouté)
```

---

## RÉSUMÉ DES CHECKLISTES

### Checklist BW

- [ ] `bw login --apikey` réussi
- [ ] `bw unlock` + `export BW_SESSION`
- [ ] `bw list items` retourne 8+ items
- [ ] Test `bitwarden-push.sh` détecte mode AUTO
- [ ] `bw-populate.sh` créé et exécuté
- [ ] 6 Secure Notes EAUMALIK auto-créés dans BW
- [ ] 5 items manuels créés sur le web

### Checklist Forgot-Password

- [ ] Clé API Resend créée sur resend.com
- [ ] Domaine `eaumalik.com` vérifié sur Resend (status "Verified")
- [ ] DNS SPF + DKIM + DMARC ajoutés chez Contabo
- [ ] `dig` confirme la propagation DNS
- [ ] Clé Resend stockée dans BW (note sécurisée)
- [ ] `fix-forgot-password.sh` exécuté sur VPS
- [ ] Logs `auth-prod` montrent connexion SMTP OK
- [ ] Email "Delivered" sur resend.com/emails
- [ ] Email reçu dans Gmail
- [ ] Lien de reset fonctionnel → mot de passe changé

---

## SCRIPTS & DOCS DISPONIBLES

| Fichier                                                          | Usage                              |
| ---------------------------------------------------------------- | ---------------------------------- |
| `eaumalik-saas/scripts/bitwarden-push.sh`                        | Bibliothèque BW (sourceable)       |
| `eaumalik-saas/scripts/rotate-all.sh`                            | Rotation complète + push BW        |
| `eaumalik-saas/scripts/rotate-secrets.sh`                        | Rotation ciblée + push BW          |
| `eaumalik-saas/scripts/recreate-admin.sh`                        | Création admin + push BW           |
| `eaumalik-saas/scripts/fix-forgot-password.sh`                   | Fix SMTP + push clé Resend         |
| `eaumalik-saas/docs/BITWARDEN-INTEGRATION.md`                    | Doc complète BW                    |
| `eaumalik-saas/docs/FORGOT-PASSWORD-FIX-2026-07-16.md`           | Doc complète fix forgot-password   |
| `eaumalik-saas/docs/OPERATIONS-SECURITY.md`                      | Doc ops globale                    |
| `eaumalik-saas/docs/MASTER-PROMPT.md`                            | **CE FICHIER**                     |

---

## CONTACT SUPPORT

- **Resend** : https://resend.com/support
- **Contabo DNS** : https://my.contabo.com → Support
- **Supabase self-hosted** : https://github.com/supabase/supabase
- **Bitwarden** : https://bitwarden.com/help