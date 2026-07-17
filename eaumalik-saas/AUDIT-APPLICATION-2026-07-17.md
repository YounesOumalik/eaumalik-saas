# Audit application EAUMALIK — 17 juillet 2026

## Résumé

L’erreur OAuth affichée a été corrigée et vérifiée. La cause était une redirection
absolue construite à partir de `request.url` : dans le serveur standalone, cette
valeur contenait l’adresse d’écoute interne `0.0.0.0:3100`, qui n’est pas une
destination navigateur fiable.

L’audit a aussi identifié des vulnérabilités critiques dans la couche Supabase,
des secrets à traiter et plusieurs risques de performance/maintenabilité. Les
points nécessitant une modification de base de données, une rotation ou un accès
au VPS sont signalés comme tels et n’ont pas été appliqués automatiquement.

## Correctif appliqué — OAuth Google

- Les réponses du callback OAuth et du middleware utilisent désormais un en-tête
  `Location` relatif : l’hôte public du navigateur est conservé.
- Le navigateur remplace `0.0.0.0` ou `[::]` par `localhost` **avant** de créer
  le cookie PKCE ; le callback reste donc sur le même hôte que ce cookie.
- `callbackUrl` est centralisé, limité aux chemins internes et protège aussi la
  page de finalisation contre les redirections externes (`//`, `\\`, contrôles).
- Les cookies Supabase créés pendant une requête sont conservés lors des
  redirections du middleware et en cas d’échec d’échange OAuth.
- Cinq tests unitaires de régression ont été ajoutés, ainsi qu’une étape `npm
  test` dans la CI.

Validation HTTP après correctif :

| Cas | Résultat |
| --- | --- |
| callback sans code | `307 Location: /login?callbackUrl=%2Fpanier&error=oauth_code_missing` |
| callback hostile `/\\evil.example` | fallback sûr vers `/client` |
| typecheck, lint, tests et build | réussis (7 avertissements lint préexistants) |

## Vulnérabilités critiques à traiter avant mise en production

| Priorité | Constat vérifié | Preuves | Action requise |
| --- | --- | --- | --- |
| P0 | Un client peut modifier des champs privilégiés de son profil (`role`, permissions, cashback…) via PostgREST et devenir administrateur. | `supabase/migrations/0007_fix_users_iu_trigger.sql`, `supabase/security-hardening.sql`, `supabase/schema-eaumalik.sql` | Créer et appliquer une **nouvelle migration** : révoquer les écritures directes, limiter les colonnes modifiables par l’utilisateur et bloquer les changements de champs privilégiés au niveau de la table de base. |
| P0 | Les commandes et lignes de commande peuvent être créées/modifiées directement avec des prix, totaux, statuts ou propriétaires falsifiés. | `supabase/security-hardening.sql`, politiques/triggers `orders` et `order_items` | Révoquer les écritures directes anon/authenticated et créer une RPC transactionnelle qui relit produits/prix/stock côté base. |
| P0 | La clé `SUPABASE_SERVICE_ROLE_KEY` actuelle est présente dans l’historique Git. | commits `dccda9b`, `4cc8c88`, `1a3d51e` | Révoquer/faire tourner immédiatement clé service role, clé anon et secret JWT concernés ; purger l’historique si le dépôt a été partagé. |
| P0 | Les fichiers versionnés de `data-store` contiennent des PII et des mots de passe en clair. | `data-store/users.json`, commandes associées | Retirer les données réelles de Git, les remplacer par des fixtures anonymisées, réécrire l’historique si exposé et forcer une réinitialisation des mots de passe concernés. |

## Vulnérabilités et risques élevés

| Priorité | Constat | Action |
| --- | --- | --- |
| P1 | CAPTCHA contournable : la réponse est encodée dans un token envoyé au navigateur ; absence de rate limiting sur les parcours sensibles. | Remplacer par un nonce opaque stocké côté serveur/Redis, cookie `HttpOnly`, consommation unique, rate limit IP + email. |
| P1 | `createManualOrderAction` n’exige pas le rôle/la permission nécessaire avant les écritures service-role. | Exiger `requirePermission('can_validate_orders')` ou `requireAdmin()` dès l’entrée. |
| P1 | La vue `user_profile_complete` peut contourner RLS et expose plus de données que nécessaire. | Utiliser `security_invoker=true`, limiter la vue à `id` + `is_complete`, révoquer l’accès anon. |
| P1 | Les fichiers `.env.production` sont inclus dans l’image Docker/artefact standalone. | Exclure tous les `.env*` du contexte Docker ; injecter uniquement les variables publiques nécessaires au build et les secrets au runtime. Faire tourner les secrets si une image a circulé. |
| P1 | `next@14.2.35` et PostCSS sont signalés vulnérables par `npm audit` (1 haute, 1 modérée). | Planifier une montée de version contrôlée vers une version Next corrigée, avec tests de régression avant déploiement. |

## Performance, architecture et qualité

- `data-store/news.json` fait environ 926 Ko, dont une image Data URL d’environ
  923 000 caractères. Déplacer les images vers Supabase Storage et conserver une
  URL ; cela réduira Git, RSC/HTML et améliorera le cache.
- Les assets publics pèsent environ 7,3 Mio. Plusieurs composants désactivent
  l’optimisation `next/image`; réactiver formats modernes, dimensions et lazy
  loading.
- Le middleware couvre presque toutes les requêtes et appelle Supabase plusieurs
  fois pour un utilisateur connecté. Exclure les healthchecks/API publiques et
  réduire les lectures profil.
- Les opérations stock/commande sont séparées et non transactionnelles : risque
  de survente ou de commande orpheline. Utiliser une RPC SQL atomique.
- Aucun lockfile n’est suivi alors que la CI emploie `npm ci`. Versionner
  `package-lock.json` et utiliser `npm ci` dans Docker pour des builds
  reproductibles.
- Fichiers à découper en priorité : `CrmNews.tsx` (1103 lignes),
  `repositories.ts` (1088), `CatalogueManager.tsx` (1057), `OrdersView.tsx`
  (780) et `ordersActions.ts` (774).
- Les 7 avertissements lint restants concernent les dépendances de hooks, les
  polices externes et une image non optimisée.

## Limites de l’audit

La revue a inclus le code, les migrations, la configuration, le build et des
tests HTTP locaux. Elle n’a pas exécuté de vraie connexion Google, de migration
sur Supabase, de rotation de secrets, ni de vérification du VPS/Caddy ou des
politiques effectivement présentes en production.
