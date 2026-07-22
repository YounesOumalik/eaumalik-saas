-- EauMalik — correctifs de sécurité applicatifs (22/07/2026)
-- À appliquer sur l'instance Supabase EauMalik après sauvegarde vérifiée.

SET search_path TO public, eaumalik, auth;

-- ---------------------------------------------------------------------------
-- 1) Profil : aucune donnée d'identité ne doit être lisible anonymement.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.user_profile_complete CASCADE;
CREATE VIEW public.user_profile_complete AS
  SELECT
    id,
    (phone IS NOT NULL AND phone <> '' AND city IS NOT NULL AND city <> '') AS is_complete
  FROM eaumalik.users;
ALTER VIEW public.user_profile_complete OWNER TO postgres;
ALTER VIEW public.user_profile_complete SET (security_invoker = true);
REVOKE ALL ON public.user_profile_complete FROM anon;
GRANT SELECT ON public.user_profile_complete TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Profil utilisateur : les champs métier privilégiés sont immuables pour
--    l'utilisateur connecté. Les changements de rôle/permissions/cashback,
--    de parrainage et d'identité email restent réservés au backend admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_iu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public, auth
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_trusted boolean :=
    COALESCE(auth.role(), '') = 'service_role'
    OR current_user IN ('postgres', 'service_role');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_trusted THEN
      RAISE EXCEPTION 'création de profil réservée au backend';
    END IF;
    INSERT INTO eaumalik.users SELECT NEW.*;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT v_trusted AND v_caller IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'accès refusé (users update)';
    END IF;

    IF NOT v_trusted AND (
      NEW.id IS DISTINCT FROM OLD.id OR
      NEW.email IS DISTINCT FROM OLD.email OR
      NEW.google_id IS DISTINCT FROM OLD.google_id OR
      NEW.role IS DISTINCT FROM OLD.role OR
      NEW.permissions IS DISTINCT FROM OLD.permissions OR
      NEW.managed_location_ids IS DISTINCT FROM OLD.managed_location_ids OR
      NEW.referral_code IS DISTINCT FROM OLD.referral_code OR
      NEW.referred_by IS DISTINCT FROM OLD.referred_by OR
      NEW.cashback_balance IS DISTINCT FROM OLD.cashback_balance OR
      NEW.nps_score IS DISTINCT FROM OLD.nps_score
    ) THEN
      RAISE EXCEPTION 'champs de profil protégés';
    END IF;

    UPDATE eaumalik.users SET
      email = CASE WHEN v_trusted THEN NEW.email ELSE OLD.email END,
      full_name = NEW.full_name,
      avatar_url = NEW.avatar_url,
      phone = NEW.phone,
      address = NEW.address,
      city = NEW.city,
      google_id = CASE WHEN v_trusted THEN NEW.google_id ELSE OLD.google_id END,
      role = CASE WHEN v_trusted THEN NEW.role ELSE OLD.role END,
      permissions = CASE WHEN v_trusted THEN NEW.permissions ELSE OLD.permissions END,
      managed_location_ids = CASE WHEN v_trusted THEN NEW.managed_location_ids ELSE OLD.managed_location_ids END,
      referral_code = CASE WHEN v_trusted THEN NEW.referral_code ELSE OLD.referral_code END,
      referred_by = CASE WHEN v_trusted THEN NEW.referred_by ELSE OLD.referred_by END,
      cashback_balance = CASE WHEN v_trusted THEN NEW.cashback_balance ELSE OLD.cashback_balance END,
      nps_score = CASE WHEN v_trusted THEN NEW.nps_score ELSE OLD.nps_score END,
      updated_at = now()
    WHERE id = OLD.id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS users_insert ON public.users;
CREATE TRIGGER users_insert INSTEAD OF INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_iu();
DROP TRIGGER IF EXISTS users_update ON public.users;
CREATE TRIGGER users_update INSTEAD OF UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_iu();

REVOKE INSERT, DELETE ON public.users FROM anon, authenticated;
GRANT UPDATE ON public.users TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Commandes : pas de lecture publique des commandes invitées et pas de
--    création directe par PostgREST. Le checkout passe par l'API serveur qui
--    relit prix/stock côté backend.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "eaum_orders_self_read" ON eaumalik.orders;
CREATE POLICY "eaum_orders_self_read" ON eaumalik.orders
  FOR SELECT USING (user_id = auth.uid() OR eaumalik.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items FROM anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.orders, public.order_items TO service_role;

-- Les paniers restent privés et sont écrits par le backend authentifié.
REVOKE INSERT, UPDATE, DELETE ON public.carts FROM anon;
GRANT INSERT, UPDATE ON public.carts TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Messages : un expéditeur ne peut plus être usurpé via NULL.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "eaum_msg_self_insert" ON eaumalik.messages;
CREATE POLICY "eaum_msg_self_insert" ON eaumalik.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid() OR eaumalik.is_admin());

-- ---------------------------------------------------------------------------
-- 5) Checkout transactionnel : prix relu en base, stock verrouillé et
--    commande + lignes créées dans une seule transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_user_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_city text,
  p_client_address text,
  p_notes text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public
AS $$
DECLARE
  v_item jsonb;
  v_product eaumalik.products%ROWTYPE;
  v_product_id uuid;
  v_quantity integer;
  v_subtotal numeric(10,2) := 0;
  v_delivery numeric(10,2);
  v_total numeric(10,2);
  v_order_id uuid;
  v_order_number text;
  v_items jsonb := '[]'::jsonb;
  v_updated integer;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'checkout backend uniquement';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'articles de commande invalides';
  END IF;

  -- Verrouille chaque produit avant de calculer le total : deux checkouts
  -- concurrents ne peuvent donc pas réserver le même stock.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000 THEN
      RAISE EXCEPTION 'quantité invalide';
    END IF;

    SELECT * INTO v_product
      FROM eaumalik.products
     WHERE id = v_product_id
       AND COALESCE(is_archived, false) = false
       AND COALESCE(price_on_request, false) = false
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'produit indisponible';
    END IF;
    IF v_product.stock < v_quantity THEN
      RAISE EXCEPTION 'stock insuffisant pour %', v_product.name;
    END IF;

    UPDATE eaumalik.products
       SET stock = stock - v_quantity,
           is_out_of_stock = (stock - v_quantity) <= 0,
           updated_at = now()
     WHERE id = v_product.id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN RAISE EXCEPTION 'réservation de stock impossible'; END IF;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'unit_price', v_product.price,
      'quantity', v_quantity,
      'line_total', v_product.price * v_quantity
    ));
  END LOOP;

  v_delivery := CASE WHEN v_subtotal >= 2000 THEN 0 ELSE 50 END;
  v_total := v_subtotal + v_delivery;
  v_order_number := 'CMD-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO eaumalik.orders (
    order_number, user_id, client_name, client_phone, client_address,
    client_city, status, subtotal, delivery_fee, total, notes, payment_method
  ) VALUES (
    v_order_number, p_user_id, p_client_name, p_client_phone, p_client_address,
    p_client_city, 'en_attente', v_subtotal, v_delivery, v_total, p_notes,
    'cash_on_delivery'
  ) RETURNING id INTO v_order_id;

  INSERT INTO eaumalik.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
  SELECT v_order_id,
         (item ->> 'product_id')::uuid,
         item ->> 'product_name',
         (item ->> 'unit_price')::numeric,
         (item ->> 'quantity')::integer,
         (item ->> 'line_total')::numeric
    FROM jsonb_array_elements(v_items) AS item;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'user_id', p_user_id,
    'client_name', p_client_name,
    'client_phone', p_client_phone,
    'client_address', p_client_address,
    'client_city', p_client_city,
    'status', 'en_attente',
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery,
    'total', v_total,
    'notes', p_notes,
    'payment_method', 'cash_on_delivery',
    'invoice_generated', false,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, text, text, text, text, jsonb) TO service_role;

-- Vérifications utiles après application :
--   SELECT has_table_privilege('anon', 'public.user_profile_complete', 'SELECT');
--   SELECT has_table_privilege('anon', 'public.orders', 'INSERT');
--   SELECT has_table_privilege('authenticated', 'public.orders', 'INSERT');
