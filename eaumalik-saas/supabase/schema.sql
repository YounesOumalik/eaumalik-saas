-- ============================================================================
-- EAUMALIK SARL — Schéma SQL (Supabase / PostgreSQL)
-- À exécuter dans l'éditeur SQL de Supabase (Dashboard > SQL Editor).
-- ============================================================================

-- Profil entreprise
CREATE TABLE IF NOT EXISTS company_profile (
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

-- Utilisateurs (profil app, lié auth.users par id)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  city TEXT DEFAULT 'Casablanca',
  google_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin','administrator','sales','technician','stock_manager','admin_assistant')),
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Archive des comptes personnel supprimés (récupérables par l'admin).
-- Snapshot des métadonnées ; on ne stocke PAS le mot de passe.
-- À la restauration, l'admin doit en définir un nouveau.
CREATE TABLE IF NOT EXISTS public.users_archive (
  id UUID PRIMARY KEY,                                       -- ancien id auth
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
CREATE INDEX IF NOT EXISTS idx_users_archive_email ON public.users_archive(email);

-- Produits
CREATE TABLE IF NOT EXISTS products (
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

-- Commandes
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
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

-- Lignes de commande
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10,2) NOT NULL
);

-- Alertes maintenance filtres
CREATE TABLE IF NOT EXISTS maintenance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
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

-- Index
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user          ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status   ON maintenance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock       ON products(stock);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profile           ENABLE ROW LEVEL SECURITY;

-- Lecture publique du catalogue et du profil société
DROP POLICY IF EXISTS "Produits lisibles par tous" ON products;
CREATE POLICY "Produits lisibles par tous" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profil société lisible" ON company_profile;
CREATE POLICY "Profil société lisible" ON company_profile FOR SELECT USING (true);

-- Utilisateurs : un user lit/met à jour son propre profil
DROP POLICY IF EXISTS "Users self-read"  ON public.users;
CREATE POLICY "Users self-read"  ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users self-update" ON public.users;
CREATE POLICY "Users self-update" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Commandes : un client voit ses propres commandes ; admin voit tout
DROP POLICY IF EXISTS "Clients voient leurs commandes" ON orders;
CREATE POLICY "Clients voient leurs commandes" ON orders
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Clients créent commandes" ON orders;
CREATE POLICY "Clients créent commandes" ON orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin voit tout (orders)"     ON orders;
CREATE POLICY "Admin voit tout (orders)"     ON orders FOR ALL    USING (auth.jwt() ->> 'role' = 'admin');

-- order_items : visible si l'order est lisible
DROP POLICY IF EXISTS "Order items visibility" ON order_items;
CREATE POLICY "Order items visibility" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id)
  );

DROP POLICY IF EXISTS "Admin order_items" ON order_items;
CREATE POLICY "Admin order_items" ON order_items
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Maintenance : user voit ses alertes, admin tout
DROP POLICY IF EXISTS "Clients voient leurs alertes" ON maintenance_alerts;
CREATE POLICY "Clients voient leurs alertes" ON maintenance_alerts
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin maintenance" ON maintenance_alerts;
CREATE POLICY "Admin maintenance" ON maintenance_alerts
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Admin : gère produits
DROP POLICY IF EXISTS "Admin gère produits" ON products;
CREATE POLICY "Admin gère produits" ON products
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Note: pour que auth.jwt() ->> 'role' fonctionne,
-- ajouter une custom claim "role" dans un hook Supabase (auth.users -> user_metadata -> role)
-- Ex: CREATE OR REPLACE FUNCTION public.set_claim() ...  (voir supabase/migrations/)
