-- Migration 0007 : Ajout du champ "Prix sur devis" sur les produits
-- Quand price_on_request = true, le prix n'est pas affiché en boutique
-- et le bouton "Ajouter au panier" est remplacé par "Demander un devis".

-- 1) Ajouter la colonne sur la table source.
ALTER TABLE eaumalik.products
  ADD COLUMN IF NOT EXISTS price_on_request BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN eaumalik.products.price_on_request IS
  'Si true, le prix du produit n''est pas affiché en boutique : remplacé par "Sur devis".';

-- 2) Recréer la view public.products pour exposer la nouvelle colonne.
--    La view est statique (SELECT explicite des colonnes) — un ALTER TABLE
--    sur la table source ne la met PAS à jour automatiquement.
--    PostgREST ne voit que les schémas listés dans PGRST_DB_SCHEMAS
--    (public, storage, graphql_public) → la view public.products est
--    l'unique point d'entrée pour l'API.
DROP VIEW IF EXISTS public.products CASCADE;

CREATE VIEW public.products
  WITH (security_invoker = true) AS
  SELECT
    id,
    name,
    slug,
    description,
    price,
    category,
    image_url,
    specs,
    is_featured,
    stock,
    stock_alert_threshold,
    filter_lifespan_months,
    is_out_of_stock,
    is_archived,
    created_at,
    updated_at,
    image_url_local,
    wholesale_price,
    price_on_request
  FROM eaumalik.products;

COMMENT ON VIEW public.products IS
  'View publique exposant les produits eaumalik (utilisée par PostgREST).';

-- 3) Recréer les grants éventuels (le CASCADE les a supprimés sur les
--    vues dépendantes — ici il n'y en a pas, mais on sécurise).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated, service_role;