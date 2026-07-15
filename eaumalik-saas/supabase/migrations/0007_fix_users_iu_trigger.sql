-- Migration 0007 : autorise le service_role (PostgREST admin) à insérer/updater
-- via la vue public.users, en plus des admins authentifiés.
--
-- Contexte :
--   - public.users est une VIEW INSTEAD OF (trigger public.users_iu).
--   - Le trigger vérifie (auth.uid() = NEW.id) OR eaumalik.is_admin().
--   - Quand l'app appelle supabase.auth.admin.createUser (avec la clé service
--     role via PostgREST), auth.uid() est NULL et is_admin() retourne false
--     → RAISE EXCEPTION 'accès refusé (users insert)'.
--
-- Cette migration autorise aussi les rôles postgres / service_role (utilisés
-- par la clé admin côté backend) à court-circuiter la garde.

CREATE OR REPLACE FUNCTION public.users_iu()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'eaumalik', 'public'
AS $function$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_is_admin boolean := eaumalik.is_admin();
  -- true si la session courante est server-side (service role, postgres…)
  v_is_privileged boolean := (
    current_setting('role', true) IN ('service_role', 'postgres')
    OR session_user IN ('postgres', 'service_role')
  );
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Auto-inscription par l'utilisateur lui-même OU admin authentifié OU service role.
    IF v_caller IS DISTINCT FROM NEW.id AND NOT v_is_admin AND NOT v_is_privileged THEN
      RAISE EXCEPTION 'accès refusé (users insert)';
    END IF;
    INSERT INTO eaumalik.users SELECT NEW.*;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF v_caller IS DISTINCT FROM OLD.id AND NOT v_is_admin AND NOT v_is_privileged THEN
      RAISE EXCEPTION 'accès refusé (users update)';
    END IF;
    UPDATE eaumalik.users SET
      email=NEW.email, full_name=NEW.full_name, avatar_url=NEW.avatar_url,
      phone=NEW.phone, address=NEW.address, city=NEW.city, google_id=NEW.google_id,
      role=NEW.role, permissions=NEW.permissions, referral_code=NEW.referral_code,
      referred_by=NEW.referred_by, cashback_balance=NEW.cashback_balance,
      nps_score=NEW.nps_score, updated_at=now()
    WHERE id = OLD.id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;
