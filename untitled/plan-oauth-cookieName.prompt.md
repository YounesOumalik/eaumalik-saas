# Plan Définitif — Correction OAuth Google + Accès Espace Client

**Date** : 2026-07-17
**Problème** : Après connexion Google OAuth, l'utilisateur est systématiquement renvoyé à la page `/login` au lieu d'accéder à `/client` (espace client : suivi commandes, parrainages, maintenance).

---

## Analyse Globale des Tentatives

| # | Approche | Pourquoi ça a échoué |
|---|---|---|
| 1 | `detectSessionInUrl` (PKCE auto via `@supabase/ssr`) | Le `code_verifier` est stocké dans un cookie chunké → non retrouvé après redirect → "PKCE code verifier not found" |
| 2 | `exchangeCodeForSession` manuel via `@supabase/ssr` | Même problème de cookie chunké |
| 3 | `flowType: 'implicit'` (tokens dans le hash) | Supabase GoTrue ne supporte pas le flow implicite → retour à la page de login |
| 4 | Client direct `@supabase/supabase-js` + `localStorage` | **CORS** bloque le `POST /auth/v1/token?grant_type=pkce` côté navigateur |
| 5 | Proxy serveur `/api/auth/exchange-code` (bypass CORS) | Le `code_verifier` est écrasé par double clic → "code challenge does not match" |
| 6 | Guard `useRef` anti double-clic + nettoyage localStorage | Le guard empêche le double appel, mais le `code_verifier` ne matche toujours pas |

**Racine probable restante** : `localStorage` peut ne pas survivre de manière fiable au redirect OAuth (Google → Supabase → notre app) selon le navigateur, le mode de navigation privée, ou les paramètres de sécurité.

---

## Plan corrigé — Approche PKCE avec échange serveur via `@supabase/ssr`

Principe : le navigateur stocke le vérificateur PKCE dans les cookies gérés par
`@supabase/ssr`, puis la route callback échange le code côté serveur. Tous les
clients utilisent le **même nom de cookie** et les adaptateurs `getAll`/`setAll`,
qui prennent correctement en charge les cookies découpés. Pas de localStorage,
ni d'appel CORS depuis le navigateur.

### Étape 1 — Configurer un nom de cookie explicite pour `@supabase/ssr`

**Fichier** : `src/lib/supabase/client.ts`

Modifier `createSupabaseBrowserClient()` et `maybeSupabaseBrowserClient()` pour passer un `cookieOptions.name` explicite à `createBrowserClient`. Cela garantit que les noms de cookies sont identiques côté client et serveur. Le nom **ne désactive pas** le chunking : celui-ci est normal et doit être géré par `@supabase/ssr` via `getAll`/`setAll`.

```typescript
// Exemple :
return createBrowserClient(url, key, {
  cookieOptions: {
    name: 'eaumalik-sb-auth',
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  },
});
```

### Étape 2 — Créer la route serveur `/api/auth/callback` (échange PKCE côté serveur)

**Fichier** : `src/app/api/auth/callback/route.ts` (NOUVEAU)

Route GET qui :
1. Reçoit `?code=XXX&callbackUrl=/client` de Supabase (après Google OAuth)
2. Lit les cookies entrants (`cookieStore.getAll()`) — le `code_verifier` y est présent car le client `@supabase/ssr` l'a stocké AVEC LE MÊME NOM DE COOKIE (étape 1)
3. Crée un `createServerClient` avec les mêmes `cookieOptions` (même nom)
4. Appelle `supabase.auth.exchangeCodeForSession(code)` — côté serveur, **pas de CORS**
5. Les cookies de session sont posés dans la **même réponse de redirection** via `setAll`
6. Redirige (302) vers `/login/google-complete?callbackUrl=...` **SANS le `?code=`** (URL propre)

### Étape 3 — Simplifier `/login/google-complete`

**Fichier** : `src/app/login/google-complete/page.tsx`

La session est déjà dans les cookies quand la page charge (posée par la route callback). Donc :
1. Plus besoin de `createDirectSupabaseClient`
2. Plus besoin d'appeler `/api/auth/exchange-code`
3. Plus besoin de scanner localStorage
4. Juste attendre `useSupabaseAuth().user` → vérifier profil → formulaire OU redirect `/client`

### Étape 4 — Re-pointer `redirectTo` dans `/login`

**Fichier** : `src/app/login/page.tsx`

Modifier `redirectTo` pour pointer vers `/api/auth/callback?callbackUrl=...` (la nouvelle route serveur).

### Étape 5 — Nettoyage

- Supprimer `createDirectSupabaseClient` (plus nécessaire)
- Supprimer `/api/auth/exchange-code` (remplacé par `/api/auth/callback`)
- Conserver le guard `useRef` anti double-clic : un code OAuth est à usage unique, l'échange n'est donc pas idempotent.

---

## Flux Final

```
/login → clic Google
    ↓ signInWithOAuth (stocke code_verifier en cookie AVEC nom explicite)
Supabase /authorize → Google
    ↓
Google → Supabase /callback → 302 → /api/auth/callback?code=XXX&callbackUrl=/client
    ↓
/api/auth/callback (serveur) :
    - lit code_verifier depuis cookies entrants (même nom)
    - exchangeCodeForSession(code) → PAS DE CORS
    - cookies de session posés dans la réponse
    - 302 → /login/google-complete?callbackUrl=/client (propre)
    ↓
/login/google-complete :
    - useSupabaseAuth().user → dispo (cookies déjà là)
    - vérifie profil → formulaire OU auto-redirect /client
    ↓
/client → espace client ouvert ✅
```

---

## Fichiers à Modifier

| Fichier | Action |
|---|---|
| `src/lib/supabase/client.ts` | Ajouter `cookieOptions.name` explicite + supprimer `createDirectSupabaseClient` |
| `src/app/api/auth/callback/route.ts` | **NOUVEAU** — échange PKCE serveur + redirect |
| `src/app/api/auth/exchange-code/route.ts` | Supprimer (remplacé) |
| `src/app/login/page.tsx` | `redirectTo` → `/api/auth/callback` + nettoyer imports |
| `src/app/login/google-complete/page.tsx` | Simplifier (plus de localStorage, plus de fetch proxy) |
| `src/lib/supabase/middleware.ts` | S'assurer que les cookies de session sont lus avec le bon nom |
| `src/lib/supabase/server.ts` | S'assurer que `createServerClient` utilise aussi le même `cookieOptions.name` |

---

## Pourquoi ça va marcher cette fois

1. **Un seul nom de cookie** (`eaumalik-sb-auth`) côté client ET serveur → pas de mismatch
2. **Chunking correctement géré** — les adaptateurs `getAll`/`setAll` reconstituent et mettent à jour les cookies découpés si nécessaire
3. **Pas de localStorage** — tout passe par les cookies HTTP, qui survivent aux redirects
4. **Pas de CORS** — l'échange PKCE se fait côté serveur (fetch serveur → serveur)
5. **Pas de race condition** — la session est posée AVANT que React ne monte
6. **Approche documentée** — c'est le pattern recommandé par la doc officielle Supabase pour Next.js App Router
