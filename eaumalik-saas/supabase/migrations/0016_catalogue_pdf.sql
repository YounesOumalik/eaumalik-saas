-- ============================================================================
-- Migration 0016 — Catalogue PDF (flipbook landing page)
-- ----------------------------------------------------------------------------
-- Ajoute une table singleton `eaumalik.catalogue_pdf` qui stocke le PDF
-- "feuilletable" affiché sur la page d'accueil. Le binaire est conservé
-- en colonne bytea pour éviter la dépendance à Supabase Storage (non
-- provisionné sur le déploiement self-hosted actuel).
--
-- Singleton : id = 'singleton' (PK text). On upsert/delete sur cette clé
-- depuis `data/repositories.ts::saveCataloguePdf / deleteCataloguePdfRecord`.
--
-- La vue bridge `public.catalogue_pdf` est ajoutée pour exposer uniquement
-- les métadonnées (filename/size/uploaded_at) en lecture publique — le
-- payload binaire reste protégé par les policies RLS du schéma `eaumalik`.
-- ============================================================================

SET search_path TO eaumalik, public;

CREATE TABLE IF NOT EXISTS eaumalik.catalogue_pdf (
  id            TEXT PRIMARY KEY DEFAULT 'singleton',
  payload       BYTEA NOT NULL,
  filename      TEXT  NOT NULL,
  mime          TEXT  NOT NULL DEFAULT 'application/pdf',
  size          BIGINT NOT NULL CHECK (size >= 0),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by   TEXT
);

COMMENT ON TABLE eaumalik.catalogue_pdf IS
  'PDF du catalogue produits affiché comme flipbook sur la landing page.'
  ' Singleton (id=singleton). Remplaceable par l''admin depuis /admin/catalogue.';

-- On garantit que la table reste un singleton : on bloque l'INSERT d'un 2e
-- row via trigger (idempotent : ne fait rien si déjà 'singleton').
CREATE OR REPLACE FUNCTION eaumalik.catalogue_pdf_singleton_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL OR NEW.id <> 'singleton' THEN
    RAISE EXCEPTION 'catalogue_pdf est une table singleton (id doit valoir %)', 'singleton';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_catalogue_pdf_singleton ON eaumalik.catalogue_pdf;
CREATE TRIGGER trg_catalogue_pdf_singleton
  BEFORE INSERT OR UPDATE ON eaumalik.catalogue_pdf
  FOR EACH ROW EXECUTE FUNCTION eaumalik.catalogue_pdf_singleton_guard();

ALTER TABLE eaumalik.catalogue_pdf ENABLE ROW LEVEL SECURITY;

-- Lecture publique des métadonnées (pour la landing page) via la vue bridge.
-- L'accès au binaire `payload` reste verrouillé au service role.
DROP POLICY IF EXISTS "eaum_catalogue_pdf_admin_all" ON eaumalik.catalogue_pdf;
CREATE POLICY "eaum_catalogue_pdf_admin_all" ON eaumalik.catalogue_pdf
  FOR ALL
  USING (eaumalik.is_admin())
  WITH CHECK (eaumalik.is_admin());

GRANT ALL ON eaumalik.catalogue_pdf TO service_role;

-- Vue bridge : métadonnées UNIQUEMENT (pas le payload).
DROP VIEW IF EXISTS public.catalogue_pdf CASCADE;
CREATE VIEW public.catalogue_pdf AS
  SELECT id, filename, mime, size, uploaded_at, uploaded_by
  FROM eaumalik.catalogue_pdf;
ALTER VIEW public.catalogue_pdf OWNER TO postgres;
ALTER VIEW public.catalogue_pdf SET (security_invoker = true);
GRANT SELECT ON public.catalogue_pdf TO anon, authenticated, service_role;

-- ============================================================================
-- FIN — 0016_catalogue_pdf.sql
-- ============================================================================