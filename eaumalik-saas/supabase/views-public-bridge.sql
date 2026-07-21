-- ============================================================================
-- Bridge : expose eaumalik.* sous les noms attendus par le code Next.js
-- (qui fait .from('users'), .from('products') etc. sans préfixe de schéma).
--
-- Crée des VUES dans le schéma public qui pointent vers eaumalik.*.
-- Le code Next.js continue de fonctionner sans modification.
--
⚠️  Les VUES sont en lecture seule. Pour les écritures (INSERT/UPDATE/DELETE),
--    le code Next.js utilise déjà la service role key côté serveur, donc
--    elle bypasse RLS et écrit directement dans les tables eaumalik.* via
--    le search_path du role postgres.
--
--    Pour les clients (anon/authenticated) qui font du write via .from('orders'),
--    il faut créer des VUES upvotables (WITH INSTEAD OF triggers) OU modifier
--    le code pour utiliser .schema('eaumalik').
--
-- Approche choisie : VUES upvotables pour orders/order_items/users/carts,
--                   VUES simples pour le reste (lecture seule via RLS existant).
-- ============================================================================

SET search_path TO public, eaumalik;

-- ============================================================================
-- Lecture simple (RLS sur les tables sous-jacentes s'applique)
-- ============================================================================
DROP VIEW IF EXISTS public.products          CASCADE;
DROP VIEW IF EXISTS public.company_profile   CASCADE;
DROP VIEW IF EXISTS public.maintenance_alerts CASCADE;
DROP VIEW IF EXISTS public.messages          CASCADE;
DROP VIEW IF EXISTS public.news              CASCADE;

CREATE VIEW public.products AS SELECT * FROM eaumalik.products;
CREATE VIEW public.company_profile AS SELECT * FROM eaumalik.company_profile;
CREATE VIEW public.maintenance_alerts AS SELECT * FROM eaumalik.maintenance_alerts;
CREATE VIEW public.messages AS SELECT * FROM eaumalik.messages;
CREATE VIEW public.news AS SELECT * FROM eaumalik.news;
-- Module logistique (migration 0014/0015)
CREATE VIEW public.locations AS SELECT * FROM eaumalik.locations;
CREATE VIEW public.product_location_stock AS SELECT * FROM eaumalik.product_location_stock;
CREATE VIEW public.transfer_requests AS SELECT * FROM eaumalik.transfer_requests;
CREATE VIEW public.product_stock_by_location AS SELECT * FROM eaumalik.product_stock_by_location;
CREATE VIEW public.transfer_request_details AS SELECT * FROM eaumalik.transfer_request_details;
-- Bridge maintenance (ajoutés en 0004 mais absents du bridge initial)
CREATE VIEW public.maintenance_records AS
  SELECT id, client_name, client_phone, client_city, client_address,
         user_id, order_id, product_id, product_name,
         install_date, next_service_date, service_interval_months,
         status, notes, filter_types, last_service_date,
         last_reminder_sent, total_cost, intervention_count,
         created_at, updated_at
  FROM eaumalik.maintenance_records;
CREATE VIEW public.maintenance_interventions AS
  SELECT id, record_id, intervention_type, performed_at,
         technician_name, description, parts_used, cost,
         next_service_date, outcome, created_at
  FROM eaumalik.maintenance_interventions;

ALTER VIEW public.products          OWNER TO postgres;
ALTER VIEW public.company_profile   OWNER TO postgres;
ALTER VIEW public.maintenance_alerts OWNER TO postgres;
ALTER VIEW public.messages          OWNER TO postgres;
ALTER VIEW public.news              OWNER TO postgres;
ALTER VIEW public.maintenance_records      OWNER TO postgres;
ALTER VIEW public.maintenance_interventions OWNER TO postgres;
ALTER VIEW public.locations                OWNER TO postgres;
ALTER VIEW public.product_location_stock   OWNER TO postgres;
ALTER VIEW public.transfer_requests        OWNER TO postgres;
ALTER VIEW public.product_stock_by_location OWNER TO postgres;
ALTER VIEW public.transfer_request_details OWNER TO postgres;

-- Le code Next.js écrit via la service_role directement dans eaumalik.* ;
-- pas besoin de triggers INSTEAD OF pour ces nouvelles vues (pas d'écriture
-- client-side sur locations / stock / transfers).

-- Vue user_profile_complete : exposée au middleware via PostgREST pour
-- décider si un user authentifié doit être forcé à compléter son profil
-- (Google OAuth sans phone/ville). Le middleware fait .from('user_profile_complete')
-- sans préfixe, donc la vue DOIT exister dans public.*. Le code applicatif
-- reste simple, et le middleware peut faire son job.
DROP VIEW IF EXISTS public.user_profile_complete CASCADE;
CREATE VIEW public.user_profile_complete AS
  SELECT * FROM eaumalik.user_profile_complete;
ALTER VIEW public.user_profile_complete OWNER TO postgres;
GRANT SELECT ON public.user_profile_complete TO anon, authenticated, service_role;

-- Table d'archive personnel (créée par migration 0002 dans public.*)
-- Cette table n'est PAS un bridge : c'est une vraie table dans public pour
-- conserver l'historique des comptes supprimés.
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
  archived_by UUID
);
CREATE INDEX IF NOT EXISTS idx_users_archive_archived_at ON public.users_archive(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_archive_email       ON public.users_archive(email);
ALTER TABLE public.users_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_archive_admin_all ON public.users_archive;
CREATE POLICY users_archive_admin_all ON public.users_archive
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_archive TO anon, authenticated;

-- ============================================================================
-- USERS : vue upvotable pour permettre UPDATE depuis le client
-- ============================================================================
DROP VIEW IF EXISTS public.users CASCADE;
CREATE VIEW public.users AS SELECT * FROM eaumalik.users;

CREATE OR REPLACE FUNCTION public.users_iu()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO eaumalik.users SELECT NEW.*;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE eaumalik.users
       SET email = NEW.email,
           full_name = NEW.full_name,
           avatar_url = NEW.avatar_url,
           phone = NEW.phone,
           address = NEW.address,
           city = NEW.city,
           google_id = NEW.google_id,
           role = NEW.role,
           permissions = NEW.permissions,
           referral_code = NEW.referral_code,
           referred_by = NEW.referred_by,
           cashback_balance = NEW.cashback_balance,
           nps_score = NEW.nps_score,
           updated_at = now()
     WHERE id = OLD.id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS users_insert ON public.users;
CREATE TRIGGER users_insert
  INSTEAD OF INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_iu();

DROP TRIGGER IF EXISTS users_update ON public.users;
CREATE TRIGGER users_update
  INSTEAD OF UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_iu();

-- ============================================================================
-- ORDERS : vue upvotable
-- ============================================================================
DROP VIEW IF EXISTS public.order_items CASCADE;
DROP VIEW IF EXISTS public.orders      CASCADE;

CREATE VIEW public.orders AS
  SELECT o.*,
         COALESCE(
           (SELECT json_agg(row_to_json(oi)) FROM eaumalik.order_items oi WHERE oi.order_id = o.id),
           '[]'::json
         ) AS items
  FROM eaumalik.orders o;

CREATE VIEW public.order_items AS SELECT * FROM eaumalik.order_items;

CREATE OR REPLACE FUNCTION public.orders_iud()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS NULL THEN
      NEW.id := gen_random_uuid();
    END IF;
    INSERT INTO eaumalik.orders (
      id, order_number, user_id, client_name, client_phone, client_address,
      client_city, status, subtotal, delivery_fee, total, notes,
      payment_method, invoice_generated, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.order_number, NEW.user_id, NEW.client_name, NEW.client_phone,
      NEW.client_address, NEW.client_city, NEW.status, NEW.subtotal,
      NEW.delivery_fee, NEW.total, NEW.notes, NEW.payment_method,
      COALESCE(NEW.invoice_generated, false), COALESCE(NEW.created_at, now()),
      COALESCE(NEW.updated_at, now())
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE eaumalik.orders
       SET order_number = NEW.order_number,
           user_id = NEW.user_id,
           client_name = NEW.client_name,
           client_phone = NEW.client_phone,
           client_address = NEW.client_address,
           client_city = NEW.client_city,
           status = NEW.status,
           subtotal = NEW.subtotal,
           delivery_fee = NEW.delivery_fee,
           total = NEW.total,
           notes = NEW.notes,
           payment_method = NEW.payment_method,
           invoice_generated = NEW.invoice_generated,
           updated_at = now()
     WHERE id = OLD.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM eaumalik.orders WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER orders_insert INSTEAD OF INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_iud();
CREATE TRIGGER orders_update INSTEAD OF UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_iud();
CREATE TRIGGER orders_delete INSTEAD OF DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_iud();

CREATE OR REPLACE FUNCTION public.order_items_iud()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS NULL THEN
      NEW.id := gen_random_uuid();
    END IF;
    INSERT INTO eaumalik.order_items (
      id, order_id, product_id, product_name, unit_price, quantity, line_total
    ) VALUES (
      NEW.id, NEW.order_id, NEW.product_id, NEW.product_name, NEW.unit_price,
      NEW.quantity, NEW.line_total
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM eaumalik.order_items WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER order_items_insert INSTEAD OF INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_iud();
CREATE TRIGGER order_items_delete INSTEAD OF DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_iud();

-- ============================================================================
-- CARTS : table de référence via vue (1 cart par user)
-- ============================================================================
DROP VIEW IF EXISTS public.carts CASCADE;
CREATE VIEW public.carts AS SELECT * FROM eaumalik.carts;

CREATE OR REPLACE FUNCTION public.carts_iu()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = eaumalik, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO eaumalik.carts SELECT NEW.*;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO eaumalik.carts (user_id, items, updated_at)
    VALUES (NEW.user_id, NEW.items, now())
    ON CONFLICT (user_id) DO UPDATE
      SET items = EXCLUDED.items, updated_at = now();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER carts_insert INSTEAD OF INSERT ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.carts_iu();
CREATE TRIGGER carts_update INSTEAD OF UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.carts_iu();

-- ============================================================================
-- Permissions (les VUES héritent des droits du owner = postgres = full access)
-- Mais il faut GRANT aux rôles Supabase.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products          TO anon, authenticated, service_role;
GRANT SELECT                          ON public.company_profile   TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE          ON public.maintenance_alerts TO anon, authenticated, service_role;
GRANT SELECT, INSERT                  ON public.messages          TO anon, authenticated, service_role;
GRANT SELECT                          ON public.news              TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE          ON public.users              TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.orders             TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE          ON public.order_items        TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE          ON public.carts              TO anon, authenticated, service_role;

-- Pour le service_role (bypass RLS), on peut écrire directement dans eaumalik.*
GRANT USAGE ON SCHEMA eaumalik TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA eaumalik TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA eaumalik TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA eaumalik TO service_role;

-- ============================================================================
-- Notes :
-- - anon et authenticated voient les VUES public.* ; les policies RLS s'appliquent
--   car PostgREST lit via la vue et les policies de la table sous-jacente
--   sont respectées (SECURITY INVOKER par défaut sur les VUES).
-- - Si tu vois "permission denied for view X" → GRANT SELECT.
-- ============================================================================
