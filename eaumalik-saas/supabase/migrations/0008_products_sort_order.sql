-- Migration 0008 : Ajout du champ sort_order pour ordonner manuellement
-- les produits dans la boutique et dans l'admin.
-- Convention : 0 par défaut. Plus sort_order est PETIT, plus le produit
-- est affiché en haut. L'admin peut modifier l'ordre via le tableau
-- admin (drag-and-drop ou flèches haut/bas).

-- 1) Ajouter la colonne sur la table source.
ALTER TABLE eaumalik.products
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS products_sort_order_idx
  ON eaumalik.products (sort_order ASC, created_at DESC);

COMMENT ON COLUMN eaumalik.products.sort_order IS
  'Ordre d''affichage manuel : plus petit = affiché en premier.';

-- 2) Recréer la view public.products pour exposer sort_order.
--    (voir migration 0007 pour l''explication du mécanisme view statique)
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
    price_on_request,
    sort_order
  FROM eaumalik.products;

COMMENT ON VIEW public.products IS
  'View publique exposant les produits eaumalik (utilisée par PostgREST).';

-- 3) Grants pour les rôles Supabase.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products
  TO anon, authenticated, service_role;