-- ============================================================================
-- EAUMALIK SARL — Schéma isolé dans le schéma Postgres "eaumalik"
-- Cible : db-prod existant sur le SmartServeur
-- À exécuter UNE FOIS :
--   docker exec -i db-prod psql -U postgres < schema-eaumalik.sql
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS eaumalik;
SET search_path TO eaumalik, public;

-- Profil entreprise
CREATE TABLE IF NOT EXISTS eaumalik.company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'EAUMALIK SARL',
  legal_name TEXT NOT NULL DEFAULT 'EAUMALIK S.A.R.L.',
  capital NUMERIC(10,2) DEFAULT 100000.00,
  address TEXT NOT NULL DEFAULT '23 Rue Boured Eig 3, N5 Roches Noires, Casablanca',
  phone TEXT NOT NULL DEFAULT '+212 661 463 194',
  email TEXT NOT NULL DEFAULT 'eaumaliksarl@gmail.com',
  fax TEXT DEFAULT '0520927192',
  if_number TEXT,
  tax_id TEXT,
  rc_number TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Utilisateurs (référence auth.users qui reste dans le schéma auth Supabase)
CREATE TABLE IF NOT EXISTS eaumalik.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  city TEXT DEFAULT 'Casablanca',
  google_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin','sales')),
  permissions JSONB DEFAULT '{}'::jsonb,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  cashback_balance NUMERIC(10,2) DEFAULT 0,
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eaumalik.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL CHECK (category IN ('purificateurs','industriel','consommables')),
  image_url TEXT,
  specs JSONB DEFAULT '[]'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_alert_threshold INTEGER DEFAULT 5,
  filter_lifespan_months INTEGER,
  is_out_of_stock BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eaumalik.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES eaumalik.users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_address TEXT NOT NULL,
  client_city TEXT NOT NULL DEFAULT 'Casablanca',
  status TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (status IN ('en_attente','traitee','en_livraison','livree','annulee')),
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  notes TEXT,
  payment_method TEXT DEFAULT 'cash_on_delivery',
  invoice_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eaumalik.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES eaumalik.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES eaumalik.products(id),
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS eaumalik.maintenance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES eaumalik.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES eaumalik.orders(id),
  product_id UUID REFERENCES eaumalik.products(id),
  product_name TEXT NOT NULL,
  install_date DATE NOT NULL,
  next_filter_change DATE NOT NULL,
  filter_types TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'a_jour'
    CHECK (status IN ('a_jour','a_renouveler','expire','rappel_envoye','commande creee')),
  last_reminder_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eaumalik.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES eaumalik.users(id) ON DELETE SET NULL,
  sender_name TEXT,
  recipient_id UUID REFERENCES eaumalik.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eaumalik.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eaumalik.carts (
  user_id UUID PRIMARY KEY REFERENCES eaumalik.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_orders_status      ON eaumalik.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user        ON eaumalik.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON eaumalik.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON eaumalik.maintenance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_products_category  ON eaumalik.products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock     ON eaumalik.products(stock);
CREATE INDEX IF NOT EXISTS idx_messages_sender_ts ON eaumalik.messages(sender_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_news_created       ON eaumalik.news(created_at DESC);

-- ============================================================================
-- Helpers de rôle (lit depuis eaumalik.users)
-- ============================================================================
CREATE OR REPLACE FUNCTION eaumalik.current_role()
RETURNS TEXT
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = eaumalik, public, auth
AS $$
  SELECT COALESCE(
    (SELECT role FROM eaumalik.users WHERE id = auth.uid()),
    'client'
  );
$$;

CREATE OR REPLACE FUNCTION eaumalik.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = eaumalik, public, auth
AS $$
  SELECT eaumalik.current_role() = 'admin';
$$;

-- Trigger : crée automatiquement un profil eaumalik.users à l'inscription auth
CREATE OR REPLACE FUNCTION eaumalik.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public, auth
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

  INSERT INTO eaumalik.users (
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

  IF v_referred_by IS NOT NULL THEN
    UPDATE eaumalik.users
       SET cashback_balance = COALESCE(cashback_balance, 0) + 150
     WHERE referral_code = v_referred_by
       AND id <> NEW.id;
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

-- ============================================================================
-- Row Level Security (sur les tables eaumalik.*)
-- ============================================================================
ALTER TABLE eaumalik.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.maintenance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.company_profile  ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.news             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.carts            ENABLE ROW LEVEL SECURITY;

-- PRODUCTS : SELECT public, écriture admin
DROP POLICY IF EXISTS "eaum_public_products_select" ON eaumalik.products;
CREATE POLICY "eaum_public_products_select" ON eaumalik.products
  FOR SELECT USING (is_archived IS DISTINCT FROM TRUE OR is_archived IS NULL);
DROP POLICY IF EXISTS "eaum_admin_products_all" ON eaumalik.products;
CREATE POLICY "eaum_admin_products_all" ON eaumalik.products
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- COMPANY_PROFILE
DROP POLICY IF EXISTS "eaum_public_company_read" ON eaumalik.company_profile;
CREATE POLICY "eaum_public_company_read" ON eaumalik.company_profile FOR SELECT USING (true);
DROP POLICY IF EXISTS "eaum_admin_company_write" ON eaumalik.company_profile;
CREATE POLICY "eaum_admin_company_write" ON eaumalik.company_profile
  FOR INSERT WITH CHECK (eaumalik.is_admin());
DROP POLICY IF EXISTS "eaum_admin_company_update" ON eaumalik.company_profile;
CREATE POLICY "eaum_admin_company_update" ON eaumalik.company_profile
  FOR UPDATE USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- USERS
DROP POLICY IF EXISTS "eaum_users_self_read" ON eaumalik.users;
CREATE POLICY "eaum_users_self_read" ON eaumalik.users
  FOR SELECT USING (id = auth.uid() OR eaumalik.is_admin());
DROP POLICY IF EXISTS "eaum_users_self_update" ON eaumalik.users;
CREATE POLICY "eaum_users_self_update" ON eaumalik.users
  FOR UPDATE USING (id = auth.uid() OR eaumalik.is_admin())
               WITH CHECK (id = auth.uid() OR eaumalik.is_admin());
-- INSERT : via trigger SECURITY DEFINER (bypass RLS)

-- ORDERS
DROP POLICY IF EXISTS "eaum_orders_self_read" ON eaumalik.orders;
CREATE POLICY "eaum_orders_self_read" ON eaumalik.orders
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL OR eaumalik.is_admin());
DROP POLICY IF EXISTS "eaum_orders_anon_insert" ON eaumalik.orders;
CREATE POLICY "eaum_orders_anon_insert" ON eaumalik.orders
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "eaum_orders_admin_all" ON eaumalik.orders;
CREATE POLICY "eaum_orders_admin_all" ON eaumalik.orders
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- ORDER_ITEMS
DROP POLICY IF EXISTS "eaum_order_items_self_read" ON eaumalik.order_items;
CREATE POLICY "eaum_order_items_self_read" ON eaumalik.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM eaumalik.orders o WHERE o.id = order_items.order_id
            AND (o.user_id = auth.uid() OR o.user_id IS NULL OR eaumalik.is_admin()))
  );
DROP POLICY IF EXISTS "eaum_order_items_insert" ON eaumalik.order_items;
CREATE POLICY "eaum_order_items_insert" ON eaumalik.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM eaumalik.orders o WHERE o.id = order_items.order_id)
  );
DROP POLICY IF EXISTS "eaum_order_items_admin_all" ON eaumalik.order_items;
CREATE POLICY "eaum_order_items_admin_all" ON eaumalik.order_items
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- MAINTENANCE_ALERTS
DROP POLICY IF EXISTS "eaum_maint_self_read" ON eaumalik.maintenance_alerts;
CREATE POLICY "eaum_maint_self_read" ON eaumalik.maintenance_alerts
  FOR SELECT USING (user_id = auth.uid() OR eaumalik.is_admin());
DROP POLICY IF EXISTS "eaum_maint_admin_all" ON eaumalik.maintenance_alerts;
CREATE POLICY "eaum_maint_admin_all" ON eaumalik.maintenance_alerts
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- MESSAGES
DROP POLICY IF EXISTS "eaum_msg_self_read" ON eaumalik.messages;
CREATE POLICY "eaum_msg_self_read" ON eaumalik.messages
  FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid() OR eaumalik.is_admin()
  );
DROP POLICY IF EXISTS "eaum_msg_self_insert" ON eaumalik.messages;
CREATE POLICY "eaum_msg_self_insert" ON eaumalik.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() OR sender_id IS NULL
  );
DROP POLICY IF EXISTS "eaum_msg_admin_all" ON eaumalik.messages;
CREATE POLICY "eaum_msg_admin_all" ON eaumalik.messages
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- NEWS : lecture publique
DROP POLICY IF EXISTS "eaum_news_public_read" ON eaumalik.news;
CREATE POLICY "eaum_news_public_read" ON eaumalik.news FOR SELECT USING (true);
DROP POLICY IF EXISTS "eaum_news_admin_all" ON eaumalik.news;
CREATE POLICY "eaum_news_admin_all" ON eaumalik.news
  FOR ALL USING (eaumalik.is_admin()) WITH CHECK (eaumalik.is_admin());

-- CARTS : owner only
DROP POLICY IF EXISTS "eaum_carts_owner_all" ON eaumalik.carts;
CREATE POLICY "eaum_carts_owner_all" ON eaumalik.carts
  FOR ALL USING (user_id = auth.uid() OR eaumalik.is_admin())
          WITH CHECK (user_id = auth.uid() OR eaumalik.is_admin());

-- Service role : bypass RLS par défaut (auth.admin) — pas besoin de policies supplémentaires.

-- Données initiales
INSERT INTO eaumalik.company_profile (name) VALUES ('EAUMALIK SARL')
  ON CONFLICT DO NOTHING;

INSERT INTO eaumalik.products (name, slug, description, price, category, image_url, is_featured, stock, specs) VALUES
  ('Purificateur ECO LIFE', 'eco-life', 'Osmose inverse 7 étapes, réservoir 12L.', 4900.00, 'purificateurs', '/products/eco-life.jpg', true, 25,
   '["7 étapes de filtration","Réservoir 12L","Économie d''eau 50%"]'::jsonb),
  ('Purificateur PREMIUM', 'premium', 'UV + osmose inverse, écran tactile.', 8900.00, 'purificateurs', '/products/premium.jpg', true, 12,
   '["Stérilisation UV","Écran tactile","Minéralisation"]'::jsonb),
  ('Filtre charbon actif (x3)', 'filtre-charbon', 'Lot de 3 filtres charbon actif.', 350.00, 'consommables', '/products/filtre-charbon.jpg', false, 200,
   '["Durée de vie 6 mois","Compatible ECO LIFE & PREMIUM"]'::jsonb),
  ('Membrane osmose inverse', 'membrane-osmose', 'Membrane 50 GPD.', 280.00, 'consommables', '/products/membrane.jpg', false, 80,
   '["50 GPD","Haute réjection"]'::jsonb)
  ON CONFLICT (slug) DO NOTHING;
