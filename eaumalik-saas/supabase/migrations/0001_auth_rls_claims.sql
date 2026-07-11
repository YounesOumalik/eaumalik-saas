-- ============================================================================
-- EAUMALIK SARL — Migration 0001 : Auth + RLS avec custom claim `role`
-- À exécuter APRÈS schema.sql dans l'éditeur SQL Supabase.
-- ============================================================================

-- 1) Helper de lecture du claim `role` exposé via auth.users.raw_user_meta_data
--    On encapsule dans une fonction STABLE pour cache-friendly.
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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.current_role() = 'admin';
$$;

-- 2) Trigger d'auto-création du profil public.users à l'inscription.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_city TEXT;
  v_address TEXT;
  v_referred_by TEXT;
  v_referral_code TEXT;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data ->> 'role'), 'client');
  v_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  v_phone := NULLIF(NEW.raw_user_meta_data ->> 'phone', '');
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
    v_role, v_referral_code, v_referred_by, 0, now(), now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Policies : remplace `auth.jwt() ->> 'role'` qui ne marche pas sans custom claims.
--    `is_admin()` lit depuis public.users (source de vérité).

-- PRODUCTS : SELECT public ; modification admin uniquement.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Produits lisibles par tous"      ON products;
DROP POLICY IF EXISTS "Admin gère produits"             ON products;
DROP POLICY IF EXISTS "Public products select"          ON products;
DROP POLICY IF EXISTS "Admin products all"              ON products;
CREATE POLICY "Public products select" ON products
  FOR SELECT USING (is_archived IS DISTINCT FROM TRUE OR is_archived IS NULL);
CREATE POLICY "Admin products all" ON products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- COMPANY PROFILE
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profil société lisible" ON company_profile;
DROP POLICY IF EXISTS "Public company read"   ON company_profile;
DROP POLICY IF EXISTS "Admin company write"   ON company_profile;
CREATE POLICY "Public company read" ON company_profile FOR SELECT USING (true);
CREATE POLICY "Admin company write" ON company_profile
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin company update" ON company_profile
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- USERS : un user lit/met à jour son propre profil ; admin lit tout.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users self-read"  ON public.users;
DROP POLICY IF EXISTS "Users self-update" ON public.users;
DROP POLICY IF EXISTS "Users admin all"   ON public.users;
CREATE POLICY "Users self-read" ON public.users FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Users self-update" ON public.users
  FOR UPDATE USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
-- INSERT public.users se fait via le trigger handle_new_user (SECURITY DEFINER bypass RLS).

-- ORDERS : clients voient leurs commandes ; admin voit tout.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients voient leurs commandes"   ON orders;
DROP POLICY IF EXISTS "Clients créent commandes"        ON orders;
DROP POLICY IF EXISTS "Admin voit tout (orders)"        ON orders;
DROP POLICY IF EXISTS "Orders self-read"                 ON orders;
DROP POLICY IF EXISTS "Orders anonymous insert"          ON orders;
DROP POLICY IF EXISTS "Orders admin all"                 ON orders;
CREATE POLICY "Orders self-read" ON orders
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL OR public.is_admin());
CREATE POLICY "Orders anonymous insert" ON orders
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Orders admin all" ON orders
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ORDER_ITEMS : visible si l'order est lisible.
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order items visibility" ON order_items;
DROP POLICY IF EXISTS "Admin order_items"      ON order_items;
DROP POLICY IF EXISTS "Order items self-read"  ON order_items;
DROP POLICY IF EXISTS "Order items insert"     ON order_items;
DROP POLICY IF EXISTS "Order items admin all"  ON order_items;
CREATE POLICY "Order items self-read" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id
            AND (o.user_id = auth.uid() OR o.user_id IS NULL OR public.is_admin()))
  );
CREATE POLICY "Order items insert" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id)
  );
CREATE POLICY "Order items admin all" ON order_items
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MAINTENANCE_ALERTS
ALTER TABLE maintenance_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients voient leurs alertes" ON maintenance_alerts;
DROP POLICY IF EXISTS "Admin maintenance"            ON maintenance_alerts;
DROP POLICY IF EXISTS "Maintenance self-read"        ON maintenance_alerts;
DROP POLICY IF EXISTS "Maintenance admin all"        ON maintenance_alerts;
CREATE POLICY "Maintenance self-read" ON maintenance_alerts
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Maintenance admin all" ON maintenance_alerts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MESSAGES (table ajoutée)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_name TEXT,
  recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_sender_ts ON messages(sender_id, timestamp DESC);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages self-read" ON messages;
DROP POLICY IF EXISTS "Messages self-insert" ON messages;
DROP POLICY IF EXISTS "Messages admin all" ON messages;
CREATE POLICY "Messages self-read" ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin()
  );
CREATE POLICY "Messages self-insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() OR sender_id IS NULL  -- sender_id NULL = admin via service role
  );
CREATE POLICY "Messages admin all" ON messages
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- NEWS
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at DESC);
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public news read"   ON news;
DROP POLICY IF EXISTS "News admin manage" ON news;
CREATE POLICY "Public news read"   ON news FOR SELECT USING (true);
CREATE POLICY "News admin manage"  ON news
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
