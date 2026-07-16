SET search_path TO eaumalik, public, auth;

-- Mise à jour du trigger handle_new_user pour capturer google_id + avatar_url
CREATE OR REPLACE FUNCTION eaumalik.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public, auth
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_city TEXT;
  v_address TEXT;
  v_referred_by TEXT;
  v_referral_code TEXT;
  v_google_id TEXT;
  v_avatar_url TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  v_phone := NULLIF(NEW.raw_user_meta_data ->> 'phone', '');
  v_city := NULLIF(NEW.raw_user_meta_data ->> 'city', 'Casablanca');
  v_address := NULLIF(NEW.raw_user_meta_data ->> 'address', '');
  v_referred_by := NULLIF(UPPER(NEW.raw_user_meta_data ->> 'referred_by'), '');
  v_google_id := NULLIF(NEW.raw_user_meta_data ->> 'google_id', '');
  v_avatar_url := NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', '');

  v_referral_code := upper(substr(replace(md5(random()::text), '-', ''), 1, 8));

  INSERT INTO eaumalik.users (
    id, email, full_name, phone, city, address, google_id, avatar_url,
    role, referral_code, referred_by, cashback_balance, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email, v_full_name, v_phone, v_city, v_address, v_google_id, v_avatar_url,
    'client', v_referral_code, v_referred_by, 0, now(), now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        google_id = COALESCE(EXCLUDED.google_id, eaumalik.users.google_id),
        avatar_url = COALESCE(EXCLUDED.avatar_url, eaumalik.users.avatar_url),
        updated_at = now();

  IF v_referred_by IS NOT NULL THEN
    UPDATE eaumalik.users
       SET cashback_balance = COALESCE(cashback_balance, 0) + 150
     WHERE referral_code = v_referred_by AND id <> NEW.id;
    UPDATE eaumalik.users
       SET cashback_balance = COALESCE(cashback_balance, 0) + 50
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION eaumalik.handle_new_user();

-- Vue pour vérifier rapidement si un profil est complet (téléphone + ville)
CREATE OR REPLACE VIEW eaumalik.user_profile_complete AS
  SELECT
    id,
    email,
    google_id,
    phone IS NOT NULL AND phone <> '' AS has_phone,
    city IS NOT NULL AND city <> '' AS has_city,
    (phone IS NOT NULL AND phone <> '' AND city IS NOT NULL AND city <> '') AS is_complete
  FROM eaumalik.users;
