-- ============================================================================
-- 0003_news_promotions.sql
-- Extension de la table news pour supporter :
--   1) Choix des destinataires (tous OU liste de clients spécifiques)
--   2) Promotion spéciale (prix optionnel + produits inclus du catalogue)
--
-- Cible :
--   - public.news        (schéma legacy)
--   - eaumalik.news      (schéma isolé)
-- L'idempotence est garantie via IF NOT EXISTS / EXCEPTION handlers.
-- ============================================================================

SET search_path TO public, eaumalik;

-- ----------------------------------------------------------------------------
-- 1) Colonnes ajoutées à public.news (legacy / 0001)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.price déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.original_price déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS product_ids UUID[] DEFAULT '{}'::uuid[];
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.product_ids déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS target_all BOOLEAN NOT NULL DEFAULT TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.target_all déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS target_user_ids UUID[] DEFAULT '{}'::uuid[];
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.target_user_ids déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS is_promotion BOOLEAN NOT NULL DEFAULT FALSE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.is_promotion déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.valid_until déjà présent (%).', SQLERRM;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_news_promotion ON public.news(is_promotion, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_target     ON public.news USING GIN(target_user_ids);

-- ----------------------------------------------------------------------------
-- 2) Colonnes ajoutées à eaumalik.news (schéma isolé production)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.price déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.original_price déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS product_ids UUID[] DEFAULT '{}'::uuid[];
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.product_ids déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS target_all BOOLEAN NOT NULL DEFAULT TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.target_all déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS target_user_ids UUID[] DEFAULT '{}'::uuid[];
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.target_user_ids déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS is_promotion BOOLEAN NOT NULL DEFAULT FALSE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.is_promotion déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.valid_until déjà présent (%).', SQLERRM;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_news_promotion ON eaumalik.news(is_promotion, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_target     ON eaumalik.news USING GIN(target_user_ids);

-- ----------------------------------------------------------------------------
-- 3) Refresh des vues public.* (assure que product_ids/target_user_ids sont
--    exposés aux requêtes .from('news') du code Next.js).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.news CASCADE;
CREATE VIEW public.news AS SELECT * FROM eaumalik.news;
ALTER VIEW public.news OWNER TO postgres;
ALTER VIEW public.news SET (security_invoker = true);

GRANT SELECT ON public.news TO anon, authenticated, service_role;

-- ============================================================================
-- FIN — 0003_news_promotions.sql
-- ============================================================================
