-- ============================================================================
-- EAUMALIK — Script de durcissement sécurité (à exécuter sur db-prod)
-- Corrige :
--   F-01  Escalade de privilèges à l'inscription (rôle forcé à 'client')
--   F-02  RLS réellement active sur les tables eaumalik.* + vues SECURITY INVOKER
--         + ownership checks dans les triggers INSTEAD OF (sinon contournement RLS)
--   F-05  Fuite des commandes invitées (user_id IS NULL retiré des lectures)
--   F-06  Usurpation d'identité dans les messages (sender_id = auth.uid() requis)
--
-- Idempotent (DROP POLICY / FUNCTION IF EXISTS + CREATE OR REPLACE).
-- À exécuter avec un rôle disposant de droits suffisants (postgres / service role).
-- ============================================================================

SET search_path TO eaumalik, public, auth;

-- ----------------------------------------------------------------------------
-- 1) F-01 : trigger d'inscription — rôle TOUJOURS 'client'
-- ----------------------------------------------------------------------------
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
BEGIN
  -- CRITIQUE : rôle forcé à 'client'. Jamais depuis raw_user_meta_data (client-contrôlable).
  v_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  v_phone := NULLIF(NEW.raw_user_meta_data ->> 'phone', '');
  v_city := NULLIF(NEW.raw_user_meta_data ->> 'city', 'Casablanca');
  v_address := NULLIF(NEW.raw_user_meta_data ->> 'address', '');
  v_referred_by := NULLIF(UPPER(NEW.raw_user_meta_data ->> 'referred_by'), '');

  v_referral_code := upper(substr(replace(md5(random()::text), '-', ''), 1, 8));

  INSERT INTO eaumalik.users (
    id, email, full_name, phone, city, address,
    role, referral_code, referred_by, cashback_balance, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email, v_full_name, v_phone, v_city, v_address,
    'client', v_referral_code, v_referred_by, 0, now(), now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
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

-- ----------------------------------------------------------------------------
-- 2) F-02 : activer RLS sur les tables de base eaumalik.*
-- ----------------------------------------------------------------------------
ALTER TABLE eaumalik.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.company_profile   ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.maintenance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.news             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.carts            ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3) Politiques sur les tables de base eaumalik.* (miroir 0001, corrigées)
-- ----------------------------------------------------------------------------

-- PRODUCTS
DROP POLICY IF EXISTS "Products public select" ON eaumalik.products;
CREATE POLICY "Products public select" ON eaumalik.products
  FOR SELECT USING (is_archived IS DISTINCT FROM TRUE OR is_archived IS NULL);
DROP POLICY IF EXISTS "Products admin all" ON eaumalik.products;
CREATE POLICY "Products admin all" ON eaumalik.products
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- COMPANY PROFILE
DROP POLICY IF EXISTS "Company public read" ON eaumalik.company_profile;
CREATE POLICY "Company public read" ON eaumalik.company_profile FOR SELECT USING (true);
DROP POLICY IF EXISTS "Company admin write" ON eaumalik.company_profile;
CREATE POLICY "Company admin write" ON eaumalik.company_profile FOR INSERT WITH CHECK (eaumalik.is_admin());
DROP POLICY IF EXISTS "Company admin update" ON eaumalik.company_profile;
CREATE POLICY "Company admin update" ON eaumalik.company_profile
  FOR UPDATE USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- USERS
DROP POLICY IF EXISTS "Users self-read" ON eaumalik.users;
CREATE POLICY "Users self-read" ON eaumalik.users
  FOR SELECT USING (id = auth.uid() OR eaumalik.is_admin());
DROP POLICY IF EXISTS "Users self-update" ON eaumalik.users;
CREATE POLICY "Users self-update" ON eaumalik.users
  FOR UPDATE USING (id = auth.uid() OR eaumalik.is_admin()) WITH CHECK (id = auth.uid() OR eaumalik.is_admin());

-- ORDERS (F-05 : user_id IS NULL retiré de la lecture)
DROP POLICY IF EXISTS "Orders self-read" ON eaumalik.orders;
CREATE POLICY "Orders self-read" ON eaumalik.orders
  FOR SELECT USING (user_id = auth.uid() OR eaumalik.is_admin());
DROP POLICY IF EXISTS "Orders anonymous insert" ON eaumalik.orders;
CREATE POLICY "Orders anonymous insert" ON eaumalik.orders
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "Orders admin all" ON eaumalik.orders;
CREATE POLICY "Orders admin all" ON eaumalik.orders
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- ORDER ITEMS (F-05)
DROP POLICY IF EXISTS "Order items self-read" ON eaumalik.order_items;
CREATE POLICY "Order items self-read" ON eaumalik.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM eaumalik.orders o WHERE o.id = order_items.order_id
            AND (o.user_id = auth.uid() OR eaumalik.is_admin()))
  );
DROP POLICY IF EXISTS "Order items insert" ON eaumalik.order_items;
CREATE POLICY "Order items insert" ON eaumalik.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM eaumalik.orders o WHERE o.id = order_items.order_id)
  );
DROP POLICY IF EXISTS "Order items admin all" ON eaumalik.order_items;
CREATE POLICY "Order items admin all" ON eaumalik.order_items
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- MAINTENANCE ALERTS
DROP POLICY IF EXISTS "Maintenance self-read" ON eaumalik.maintenance_alerts;
CREATE POLICY "Maintenance self-read" ON eaumalik.maintenance_alerts
  FOR SELECT USING (user_id = auth.uid() OR eaumalik.is_admin());
DROP POLICY IF EXISTS "Maintenance admin all" ON eaumalik.maintenance_alerts;
CREATE POLICY "Maintenance admin all" ON eaumalik.maintenance_alerts
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- MESSAGES (F-06 : sender_id = auth.uid() requis pour les inserts anonymes)
DROP POLICY IF EXISTS "Messages self-read" ON eaumalik.messages;
CREATE POLICY "Messages self-read" ON eaumalik.messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR eaumalik.is_admin());
DROP POLICY IF EXISTS "Messages self-insert" ON eaumalik.messages;
CREATE POLICY "Messages self-insert" ON eaumalik.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());  -- NULL réservé au service role (admin)
DROP POLICY IF EXISTS "Messages admin all" ON eaumalik.messages;
CREATE POLICY "Messages admin all" ON eaumalik.messages
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- NEWS
DROP POLICY IF EXISTS "News public read" ON eaumalik.news;
CREATE POLICY "News public read" ON eaumalik.news FOR SELECT USING (true);
DROP POLICY IF EXISTS "News admin manage" ON eaumalik.news;
CREATE POLICY "News admin manage" ON eaumalik.news
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- CARTS
DROP POLICY IF EXISTS "Carts self all" ON eaumalik.carts;
CREATE POLICY "Carts self all" ON eaumalik.carts
  FOR ALL USING (user_id = auth.uid() OR eaumalik.is_admin()) WITH CHECK (user_id = auth.uid() OR eaumalik.is_admin());

-- ----------------------------------------------------------------------------
-- 4) F-02 : vues public.* en SECURITY INVOKER (PG15+) pour appliquer la RLS
--    de la table sous-jacente. Les écritures passent par les triggers
--    INSTEAD OF ci-dessous (qui imposent le ownership).
-- ----------------------------------------------------------------------------
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['products','company_profile','users','orders','order_items','maintenance_alerts','messages','news','carts']
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true);', v);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5) F-02 : durcir les triggers INSTEAD OF (SECURITY DEFINER) avec ownership
--    Sinon un client peut modifier n'importe quelle ligne via la vue.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.users_iu()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_is_admin boolean := eaumalik.is_admin();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_caller IS DISTINCT FROM NEW.id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'accès refusé (users insert)';
    END IF;
    INSERT INTO eaumalik.users SELECT NEW.*;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF v_caller IS DISTINCT FROM OLD.id AND NOT v_is_admin THEN
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
$$;

CREATE OR REPLACE FUNCTION public.orders_iud()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_is_admin boolean := eaumalik.is_admin();
  v_owner uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL AND v_caller IS DISTINCT FROM NEW.user_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'accès refusé (orders insert)';
    END IF;
    INSERT INTO eaumalik.orders SELECT NEW.*;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT user_id INTO v_owner FROM eaumalik.orders WHERE id = OLD.id;
    IF v_caller IS DISTINCT FROM v_owner AND NOT v_is_admin THEN
      RAISE EXCEPTION 'accès refusé (orders update)';
    END IF;
    UPDATE eaumalik.orders SET
      order_number=NEW.order_number, user_id=NEW.user_id, client_name=NEW.client_name,
      client_phone=NEW.client_phone, client_address=NEW.client_address, client_city=NEW.client_city,
      status=NEW.status, subtotal=NEW.subtotal, delivery_fee=NEW.delivery_fee, total=NEW.total,
      notes=NEW.notes, payment_method=NEW.payment_method, invoice_generated=NEW.invoice_generated,
      updated_at=now()
    WHERE id = OLD.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id INTO v_owner FROM eaumalik.orders WHERE id = OLD.id;
    IF v_caller IS DISTINCT FROM v_owner AND NOT v_is_admin THEN
      RAISE EXCEPTION 'accès refusé (orders delete)';
    END IF;
    DELETE FROM eaumalik.orders WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.order_items_iud()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_is_admin boolean := eaumalik.is_admin();
  v_order_user uuid;
BEGIN
  SELECT o.user_id INTO v_order_user FROM eaumalik.orders o
   WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);
  IF TG_OP = 'INSERT' THEN
    IF v_order_user IS NOT NULL AND v_caller IS DISTINCT FROM v_order_user AND NOT v_is_admin THEN
      RAISE EXCEPTION 'accès refusé (order_items insert)';
    END IF;
    INSERT INTO eaumalik.order_items SELECT NEW.*;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF v_order_user IS NOT NULL AND v_caller IS DISTINCT FROM v_order_user AND NOT v_is_admin THEN
      RAISE EXCEPTION 'accès refusé (order_items delete)';
    END IF;
    DELETE FROM eaumalik.order_items WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.carts_iu()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_is_admin boolean := eaumalik.is_admin();
BEGIN
  IF v_caller IS DISTINCT FROM NEW.user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'accès refusé (carts)';
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO eaumalik.carts SELECT NEW.*;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO eaumalik.carts (user_id, items, updated_at)
    VALUES (NEW.user_id, NEW.items, now())
    ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items, updated_at = now();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Les triggers INSTEAD OF sont recréés par views-public-bridge.sql ; on s'assure
-- qu'ils pointent vers les fonctions durcies ci-dessus (nom identique).
DROP TRIGGER IF EXISTS users_insert ON public.users;
CREATE TRIGGER users_insert INSTEAD OF INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_iu();
DROP TRIGGER IF EXISTS users_update ON public.users;
CREATE TRIGGER users_update INSTEAD OF UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_iu();

DROP TRIGGER IF EXISTS orders_insert ON public.orders;
CREATE TRIGGER orders_insert INSTEAD OF INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_iud();
DROP TRIGGER IF EXISTS orders_update ON public.orders;
CREATE TRIGGER orders_update INSTEAD OF UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_iud();
DROP TRIGGER IF EXISTS orders_delete ON public.orders;
CREATE TRIGGER orders_delete INSTEAD OF DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_iud();

DROP TRIGGER IF EXISTS order_items_insert ON public.order_items;
CREATE TRIGGER order_items_insert INSTEAD OF INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.order_items_iud();
DROP TRIGGER IF EXISTS order_items_delete ON public.order_items;
CREATE TRIGGER order_items_delete INSTEAD OF DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.order_items_iud();

DROP TRIGGER IF EXISTS carts_insert ON public.carts;
CREATE TRIGGER carts_insert INSTEAD OF INSERT ON public.carts FOR EACH ROW EXECUTE FUNCTION public.carts_iu();
DROP TRIGGER IF EXISTS carts_update ON public.carts;
CREATE TRIGGER carts_update INSTEAD OF UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.carts_iu();

-- ----------------------------------------------------------------------------
-- Vérification rapide (à lire après exécution) :
--   SELECT n.nspname, c.relname, c.relrowsecurity
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'eaumalik' ORDER BY c.relname;
-- Toutes les lignes doivent avoir relrowsecurity = true.
-- ----------------------------------------------------------------------------
