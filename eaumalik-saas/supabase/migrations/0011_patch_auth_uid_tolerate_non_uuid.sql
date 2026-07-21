-- Migration 0011 : patch de auth.uid() pour tolerer un sub non-UUID
-- ============================================================================
-- Symptôme observé (2026-07-21) : "invalid input syntax for type uuid: \"anon\""
-- (digest 3971974257 sur /admin/personnels) quand la requête PostgREST utilise
-- un JWT qui n'a pas un `sub` au format UUID. Cas typiques :
--   - JWT anon GoTrue (sub="anon")
--   - JWT service_role (sub="service_role")
--   - JWT custom avec sub non-UUID
--
-- Comportement par défaut dans Supabase Auth :
--   SELECT COALESCE(NULLIF(setting('sub'), ''), (...)::jsonb->>'sub')::uuid;
-- => le ::uuid plante en 22P02 sur les valeurs non-UUID, ce qui fait crasher
--    toutes les policies RLS qui appellent auth.uid().
--
-- Nouveau comportement :
--   - Si sub ressemble à un UUID (format standard) : on caste en UUID.
--   - Sinon : on retourne NULL (= aucun utilisateur authentifié).
--   Comportement attendu par les policies (id = auth.uid() → FALSE → on
--   retombe sur la branche publique / admin via is_admin()).
--
-- Ce patch est IDEMPOTENT et SAFE : il ne casse aucune policy existante
-- (les policies bien conçues acceptent NULL comme "pas moi"). Si une policy
-- s'attendait à planter en sub non-UUID, elle recevra NULL à la place, ce qui
-- est l'équivalent fonctionnel d'un utilisateur non authentifié.

CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql
  STABLE
AS $function$
  SELECT CASE
    WHEN v ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN v::uuid
    ELSE NULL
  END
  FROM (
    SELECT COALESCE(
      NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ) AS v
  ) s;
$function$;
