-- ============================================================================
-- Migration 0002 — Table users_archive pour les comptes personnel supprimés
-- ============================================================================
-- Permet de récupérer un compte staff effacé par erreur.
-- Workflow :
--   1. archiveStaffUserAction(id)  : snapshot vers users_archive + delete
--   2. restoreStaffUserAction(id)  : recrée auth.users + réinsert users
--   3. purgeArchivedStaffAction(id): suppression définitive irréversible
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users_archive (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb,
  original_created_at TIMESTAMPTZ,
  original_updated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT now(),
  archived_reason TEXT,
  archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_archive_archived_at ON public.users_archive(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_archive_email       ON public.users_archive(email);

-- RLS : seuls les admins peuvent lire / écrire dans l'archive
ALTER TABLE public.users_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent l'archive utilisateurs" ON public.users_archive;
CREATE POLICY "Admins gèrent l'archive utilisateurs" ON public.users_archive
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
