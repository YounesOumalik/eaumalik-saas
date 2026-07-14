-- ============================================================================
-- 0005_news_archive.sql
-- Ajout du support d'archivage des actualités / promotions.
--
-- Une publication archivée :
--   * disparaît du carrousel landing + boutique + espace client
--   * reste listée dans l'administration (`/admin/publications`) afin que
--     l'admin puisse la restaurer (unarchive) ou la supprimer définitivement
--
-- Cible :
--   - public.news        (schéma legacy)
--   - eaumalik.news      (schéma isolé production)
-- Idempotent via IF NOT EXISTS / EXCEPTION handlers.
-- ============================================================================

SET search_path TO public, eaumalik;

-- ----------------------------------------------------------------------------
-- 1) Colonnes ajoutées à public.news
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.is_archived déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.archived_at déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE public.news ADD COLUMN IF NOT EXISTS archived_reason TEXT;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'public.news.archived_reason déjà présent (%).', SQLERRM;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_news_archived ON public.news(is_archived, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2) Colonnes ajoutées à eaumalik.news
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.is_archived déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.archived_at déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.news ADD COLUMN IF NOT EXISTS archived_reason TEXT;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'eaumalik.news.archived_reason déjà présent (%).', SQLERRM;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_news_archived ON eaumalik.news(is_archived, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3) Refresh de la vue public.news (assure l'exposition des nouvelles colonnes
--    aux requêtes .from('news') du code Next.js).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.news CASCADE;
CREATE VIEW public.news AS SELECT * FROM eaumalik.news;
ALTER VIEW public.news OWNER TO postgres;
ALTER VIEW public.news SET (security_invoker = true);

GRANT SELECT ON public.news TO anon, authenticated, service_role;

-- ============================================================================
-- FIN — 0005_news_archive.sql
-- ============================================================================
