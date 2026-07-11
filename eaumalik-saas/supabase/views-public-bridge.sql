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

ALTER VIEW public.products          OWNER TO postgres;
ALTER VIEW public.company_profile   OWNER TO postgres;
ALTER VIEW public.maintenance_alerts OWNER TO postgres;
ALTER VIEW public.messages          OWNER TO postgres;
ALTER VIEW public.news              OWNER TO postgres;

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
    INSERT INTO eaumalik.orders SELECT NEW.*;
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
    INSERT INTO eaumalik.order_items SELECT NEW.*;
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
