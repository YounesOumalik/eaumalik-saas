-- Migration 0008 : ajout du rôle `administrator` au guard is_admin()
-- + rendre handle_new_user gracieux (no-op si le profil public existe déjà).
--
-- Contexte :
--   - is_admin() ne reconnaissait que role='admin'. Les comptes avec
--     role='administrator' (droits étendus, mais ne peuvent pas supprimer
--     le superadmin) ne passaient pas les policies, ce qui les empêchait
--     d'administrer le catalogue, les commandes, etc.
--   - handle_new_user crée un profil public.users avec role='client' à
--     chaque signup auth (y compris auth.admin.createUser). Quand
--     createStaffUserAction essaie ensuite d'insérer le profil avec le
--     bon rôle, le INSERT bute sur users_pkey → 'duplicate key value'.
--
-- Cette migration :
--   1. Rend handle_new_user idempotent (ON CONFLICT no-op).
--   2. Élargit is_admin() pour reconnaître 'admin' ET 'administrator'.
--      On gardera la distinction ailleurs (en TypeScript) pour interdire
--      aux administrators de supprimer un superadmin.

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid()),
    'client'
  );
$$;

-- is_admin() : admin OU administrator ont les pleins pouvoirs côté DB RLS.
-- La restriction "administrator ne peut pas supprimer superadmin" est gérée
-- dans la Server Action deleteStaffUserAction (TypeScript), pas ici.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.current_role() IN ('admin', 'administrator');
$$;

-- is_super_admin() : vrai seulement pour le superadministrateur (admin).
-- Les RLS policies restrictives peuvent s'en servir si besoin.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.current_role() = 'admin';
$$;

-- handle_new_user : si un profil existe déjà (cas d'un auth.admin.createUser
-- suivi d'un INSERT côté Server Action), on ne fait rien.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_existing_role TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_city TEXT;
  v_address TEXT;
  v_referred_by TEXT;
  v_referral_code TEXT;
BEGIN
  -- Si l'app Server Action a déjà créé un profil (par ex. pour un staff
  -- dont le rôle est 'administrator'), on n'écrase pas ce profil : ON CONFLICT
  -- no-op + RETURN NEW. On évite ainsi le conflit users_pkey et la perte
  -- du rôle attribué par l'admin.
  SELECT role INTO v_existing_role
    FROM public.users
   WHERE id = NEW.id;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  v_phone := NULLIF(NEW.raw_user_metadata ->> 'phone', '');
  v_city := NULLIF(NEW.raw_user_meta_data ->> 'city', 'Casablanca');
  v_address := NULLIF(NEW.raw_user_meta_data ->> 'address', '');
  v_referred_by := NULLIF(UPPER(NEW.raw_user_meta_data ->> 'referred_by'), '');

  v_referral_code := upper(substr(replace(md5(random()::text), '-', ''), 1, 8));

  INSERT INTO public.users (
    id, email, full_name, phone, city, address,
    role, referral_code, referred_by, cashback_balance, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email, v_full_name, v_phone, v_city, v_address,
    'client', v_referral_code, v_referred_by, 0, now(), now()
  );

  -- Cashback parrainage (si code parrainage valide).
  IF v_referred_by IS NOT NULL THEN
    UPDATE public.users
       SET cashback_balance = COALESCE(cashback_balance, 0) + 150
     WHERE referral_code = v_referred_by
       AND id <> NEW.id;
    UPDATE public.users
       SET cashback_balance = COALESCE(cashback_balance, 0) + 50
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
