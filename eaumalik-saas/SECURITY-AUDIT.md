# Audit de sécurité — EAUMALIK SaaS

**Date** : 2026-07
**Périmètre** : Application Next.js 14 (App Router) + Supabase (Auth/Postgres/RLS) déployée sur https://eaumalik.com
**Méthodologie** : Revue manuelle assistée (skill `security-review`) — OWASP Top 10 2021, trace de flux de données, audit de dépendances, scan de secrets, vérification RLS.

---

## Résumé exécutif

| Sévérité | Nombre | Références |
|---|---|---|
| 🔴 CRITICAL | 2 | F-01 (escalade de privilèges), F-02 (RLS probablement non appliquée) |
| 🟠 HIGH | 2 | F-03 (Next.js obsolète/CVE), F-04 (injection PostgREST latente) |
| 🟡 MEDIUM | 3 | F-05 (fuite commandes invitées), F-06 (usurpation messages), F-07 (CSP faible) |
| 🟢 LOW | 2 | F-08 (pas de rate-limiting), F-09 (clé service role exposée) |

**État des correctifs (code)** : F-01, F-03, F-04, F-07 corrigés dans le code (ce commit). F-02, F-05, F-06 nécessitent l'application d'un script SQL sur la base de production (voir `supabase/security-hardening.sql`).

---

## F-01 — Escalade de privilèges à l'inscription (CRITICAL)

- **Fichiers** : `supabase/schema-eaumalik.sql:186`, `supabase/migrations/0001_auth_rls_claims.sql:45`
- **Type** : Contrôle d'accès cassé / Élévation de privilèges — CWE-269
- **Description** : Le trigger `handle_new_user` lit le rôle depuis `NEW.raw_user_meta_data ->> 'role'`. Ce champ est **contrôlable par le client** via l'API Auth Supabase (`/auth/v1/signup` avec la clé anon). Un attaquant peut s'inscrire avec `{"email":"x","password":"...","data":{"role":"admin"}}` et obtenir un compte admin sans aucune authentification préalable.
- **Impact** : Compromission totale (accès admin, gestion des produits, commandes, personnel, messages).
- **Correctif appliqué** : Le rôle est désormais **toujours** `'client'` dans le trigger. L'élévation en `admin` ne se fait que via les Server Actions admin (clé service role). Les fichiers SQL source ont été corrigés ; il faut **ré-appliquer le trigger sur la base live** (voir script de durcissement).

```sql
-- AVANT (vulnérable)
v_role := COALESCE((NEW.raw_user_meta_data ->> 'role'), 'client');
-- APRÈS (corrigé)
v_role := 'client';
```

---

## F-02 — RLS probablement non appliquée (CRITICAL / à vérifier)

- **Fichiers** : `supabase/migrations/0001_auth_rls_claims.sql`, `supabase/views-public-bridge.sql`
- **Type** : Contrôle d'accès cassé — CWE-284
- **Description** : L'architecture utilise des **vues** `public.*` qui pointent vers les tables `eaumalik.*` (pont de compatibilité). Or :
  1. Les politiques RLS du fichier `0001` sont créées sur `products`, `orders`, `users`, etc. — c'est-à-dire sur les **vues** `public.*` (ex. `ALTER TABLE products ENABLE ROW LEVEL SECURITY`). RLS ne s'active **pas** sur une vue ; ces commandes échouent ou sont supprimées en cascade quand les vues sont (re)créées.
  2. Les tables de base `eaumalik.*` n'ont **pas** de politique RLS propre.
  → Résultat probable : **aucune RLS n'est réellement active** sur les données. La clé anon (publique) permettrait alors un accès lecture/écriture total via l'API REST Supabase.
- **Impact** : Fuite de toutes les données (clients, commandes, messages, profils) et modification arbitraire.
- **Action requise** : Vérifier sur la base live (`SELECT relname FROM pg_class WHERE relrowsecurity;` sur `eaumalik.*`) puis appliquer `supabase/security-hardening.sql` qui :
  - active RLS sur les tables `eaumalik.*` de base ;
  - recrée les politiques sur ces tables ;
  - passe les vues `public.*` en `SECURITY INVOKER` (PostgreSQL 15+) pour que la RLS de la table sous-jacente s'applique.

> ⚠️ Cette hypothèse doit être confirmée contre la base de production. Le script de durcissement ci-dessous la corrige dans tous les cas.

---

## F-03 — Next.js 14.2.13 obsolète (HIGH)

- **Fichier** : `package.json`
- **Type** : Composants vulnérables — CWE-1104
- **Description** : `next@14.2.13` est affecté par plusieurs CVE corrigées dans les versions suivantes, notamment **CVE-2025-29927** (contournement d'autorisation via middleware, corrigé en 14.2.25) et d'autres (CVE-2024-51479, CVE-2025-27749…).
- **Impact** : Risques d'exécution de code / contournement de sécurité selon la CVE.
- **Correctif appliqué** : `next` et `eslint-config-next` passés à `^14.2.33`. **Un rebuild + redeploy est requis** pour que la correction soit effective en production.

---

## F-04 — Injection PostgREST latente dans `repositories.ts` (HIGH → corrigé)

- **Fichier** : `src/data/repositories.ts` (`listProducts`)
- **Type** : Injection — CWE-89
- **Description** : Le paramètre `filters.search` était interpolé directement dans le filtre PostgREST `.or(\`name.ilike.%${search}%,...\`)`, sans échappement. La route API (`products/route.ts`) sanitisait correctement, mais la couche repository non.
- **Exploitabilité** : Actuellement **non atteignable** depuis l'UI (tous les appels `listProducts` utilisent `{}` / `{featured:true}` / `{includeArchived:true}` ; la recherche boutique est côté client). Faille de défense en profondeur.
- **Correctif appliqué** : Réutilisation de `sanitizePostgREST` (issu de `@/lib/api-guard`) dans `repositories.ts`.

---

## F-05 — Fuite des commandes invitées (MEDIUM)

- **Fichier** : `supabase/migrations/0001_auth_rls_claims.sql` (politiques `Orders self-read`, `Order items self-read`)
- **Type** : Exposition d'information / IDOR — CWE-200
- **Description** : Les politiques incluent `user_id IS NULL` dans la clause de lecture. Tout utilisateur authentifié peut donc lire **toutes** les commandes passées par des invités (sans compte).
- **Impact** : Fuite des coordonnées et adresses des clients invités.
- **Correctif (script SQL)** : Retirer `user_id IS NULL` des politiques de lecture (les invités ne peuvent pas lire leurs commandes côté DB, elles leur sont renvoyées à la création via l'API).

---

## F-06 — Usurpation d'identité dans les messages (MEDIUM)

- **Fichier** : `supabase/migrations/0001_auth_rls_claims.sql` (politique `Messages self-insert`)
- **Type** : Usurpation — CWE-290
- **Description** : La politique d'insertion autorise `sender_id = auth.uid() OR sender_id IS NULL`. Un client utilisant directement la clé anon peut insérer un message avec `sender_id = NULL` et `sender_name = 'Administrateur'`, se faisant passer pour l'admin.
- **Correctif (script SQL)** : Exiger `sender_id = auth.uid()` pour les inserts anonymes ; réserver `NULL` au service role (admin).

---

## F-07 — Politique CSP trop permissive (MEDIUM → corrigé)

- **Fichier** : `next.config.mjs`
- **Type** : Mauvaise configuration de sécurité — CWE-693
- **Correctifs appliqués** :
  - `script-src` : suppression de `'unsafe-eval'` (dev-only, dangereux en prod).
  - `img-src` : suppression du joker `'https:'` (tout hôte) → hôtes explicites + `db.eaumalik.com`.
  - `connect-src` : retrait de `https://raw.githubusercontent.com` et `https://*.supabase.co` (hôte réel déjà inclus via `supabaseHost`).
  - Ajout de `object-src 'none'` et `upgrade-insecure-requests`.
  - Note résiduelle : `'unsafe-inline'` reste nécessaire pour le SSR Next.js (amélioration future : nonce par requête via middleware).

---

## F-08 — Absence de rate-limiting (LOW)

- **Fichiers** : `src/app/api/orders/route.ts` (POST), `src/app/actions/authActions.ts` (inscription)
- **Type** : Abus de fonctionnalité — CWE-770
- **Recommandation** : Ajouter un rate-limiting (ex. Upstash Redis / middleware) sur l'inscription et la création de commande pour éviter le spam/abus.

---

## F-09 — Clé service role exposée (LOW)

- **Description** : La clé service role et la clé anon apparaissent dans les logs/transcripts de session. La clé service role **contourne totalement la RLS**.
- **Recommandation** : **Rotation immédiate** des clés JWT Supabase (anon + service role) depuis le dashboard, et redéploiement avec les nouvelles valeurs. Ne jamais committer `.env`.

---

## Bonnes pratiques déjà en place ✅

- Middleware : redirection vers `/login` sur routes protégées + `try/catch` sur `getUser()` (pas de 500 sur session absente).
- Server Actions : validation Zod stricte + `requireAdmin()`/`requireUser()` côté serveur.
- API : garde-fous `api-guard.ts` (`safeErrorResponse`, `unauthorized`, `forbidden`, `sanitizePostgREST`).
- `invoice/route.ts` : anti-IDOR (un client ne télécharge que sa propre facture).
- Pas de secrets committés (`.env.*.example` uniquement).
- En-têtes de sécurité : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS (prod), `frame-ancestors 'none'`.

---

## Plan de remédiation

1. ✅ Code : F-01, F-03, F-04, F-07 corrigés — **rebuild + redeploy requis**.
2. ⏳ DB : appliquer `supabase/security-hardening.sql` sur la base de production (F-01 trigger, F-02 RLS, F-05, F-06).
3. ⏳ Rotation des clés Supabase (F-09).
4. ⏳ Rate-limiting (F-08).
