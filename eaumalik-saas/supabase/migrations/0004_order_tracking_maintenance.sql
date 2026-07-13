-- ============================================================================
-- 0004_order_tracking_maintenance.sql
-- ------------------------------------------------------------------------
-- 1) Ajout de colonnes de tracking sur la table `orders` :
--      - carrier          (transporteur, défaut "EAUMALIK Express")
--      - tracking_number  (alias propre de order_number — déjà UNIQUE)
--      - processed_at     (date de passage en "Traitée")
--      - shipped_at       (date de passage en "En livraison")
--      - delivered_at     (date de passage en "Livrée")
--      - estimated_delivery (date prévue de livraison)
-- 2) Création d'une table de suivi historisé `maintenance_records`
--      liée à un client, un produit, et optionnellement une commande.
--      Permet de tracer chaque intervention (changement de filtre, contrôle,
--      remplacement de membrane, etc.) + notes + coût + technicien.
-- 3) La fonction `eaumalik.ensure_maintenance_on_delivery` crée
--      automatiquement une maintenance_active quand une commande passe
--      en statut 'livree' (trigger AFTER UPDATE OF status).
-- ============================================================================

SET search_path TO eaumalik, public;

-- ----------------------------------------------------------------------------
-- 1) Colonnes tracking sur orders
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE eaumalik.orders ADD COLUMN IF NOT EXISTS carrier TEXT NOT NULL DEFAULT 'EAUMALIK Express';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'orders.carrier déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'orders.tracking_number déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.orders ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'orders.processed_at déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'orders.shipped_at déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'orders.delivered_at déjà présent (%).', SQLERRM;
  END;
  BEGIN
    ALTER TABLE eaumalik.orders ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'orders.estimated_delivery déjà présent (%).', SQLERRM;
  END;
END$$;

-- Backfill : tracking_number = order_number pour les commandes existantes
UPDATE eaumalik.orders
   SET tracking_number = order_number
 WHERE tracking_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tracking ON eaumalik.orders(tracking_number);

-- ----------------------------------------------------------------------------
-- 2) Table maintenance_records — historique d'interventions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eaumalik.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_city TEXT,
  client_address TEXT,
  user_id UUID REFERENCES eaumalik.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES eaumalik.orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES eaumalik.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  -- Date d'installation (début du cycle de maintenance)
  install_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Prochaine intervention prévue
  next_service_date DATE,
  -- Période de cycle en mois (utilisée pour calculer next_service_date si vide)
  service_interval_months INTEGER DEFAULT 6,
  -- État du programme de maintenance
  status TEXT NOT NULL DEFAULT 'actif'
    CHECK (status IN ('actif','a_renouveler','suspendu','resilie')),
  -- Notes globales affichées en haut du suivi
  notes TEXT,
  -- Identifiant du filtre principal
  filter_types TEXT[] DEFAULT '{}',
  -- Date de la dernière intervention réussie
  last_service_date DATE,
  -- Date de la dernière relance envoyée
  last_reminder_sent TIMESTAMPTZ,
  -- Coût total cumulé des interventions
  total_cost NUMERIC(10,2) DEFAULT 0,
  -- Compteur d'interventions (dénormalisé pour perf lecture)
  intervention_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_records_user         ON eaumalik.maintenance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_maint_records_order        ON eaumalik.maintenance_records(order_id);
CREATE INDEX IF NOT EXISTS idx_maint_records_status       ON eaumalik.maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maint_records_next_service ON eaumalik.maintenance_records(next_service_date);

-- ----------------------------------------------------------------------------
-- 3) Table maintenance_interventions — granularité des visites
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eaumalik.maintenance_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES eaumalik.maintenance_records(id) ON DELETE CASCADE,
  -- Type d'intervention
  intervention_type TEXT NOT NULL DEFAULT 'filter_change'
    CHECK (intervention_type IN ('filter_change','inspection','repair','replacement','cleaning','diagnostic','other')),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  technician_name TEXT,
  description TEXT NOT NULL,
  -- Pièces remplacées / filtres changés
  parts_used TEXT[] DEFAULT '{}',
  -- Coût de l'intervention
  cost NUMERIC(10,2) DEFAULT 0,
  -- Prochaine intervention prévue à l'issue de celle-ci
  next_service_date DATE,
  -- Statut de l'intervention
  outcome TEXT NOT NULL DEFAULT 'completed'
    CHECK (outcome IN ('completed','pending','failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_interventions_record ON eaumalik.maintenance_interventions(record_id, performed_at DESC);

-- ----------------------------------------------------------------------------
-- 4) Trigger — création automatique d'un programme de maintenance
--    quand une commande passe en statut 'livree'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eaumalik.ensure_maintenance_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public
AS $$
DECLARE
  v_item record;
  v_filter_months INTEGER := 6;
  v_install DATE;
  v_next DATE;
  v_existing record;
BEGIN
  -- Si on n'est pas passé à 'livree' (ou qu'on ne change pas le statut), rien à faire
  IF NEW.status IS DISTINCT FROM 'livree' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'livree' THEN
    RETURN NEW;
  END IF;

  -- Stocker la date de livraison + tracking si pas déjà fait
  NEW.delivered_at := COALESCE(NEW.delivered_at, now());
  NEW.tracking_number := COALESCE(NEW.tracking_number, NEW.order_number);

  -- Pour chaque ligne de commande, créer (si absent) un programme de maintenance
  FOR v_item IN
    SELECT product_id, product_name, quantity
      FROM eaumalik.order_items
     WHERE order_id = NEW.id
  LOOP
    -- Récupérer la durée de vie du filtre produit
    SELECT COALESCE(filter_lifespan_months, 6) INTO v_filter_months
      FROM eaumalik.products
     WHERE id = v_item.product_id;
    IF v_filter_months IS NULL OR v_filter_months <= 0 THEN
      v_filter_months := 6;
    END IF;

    v_install := CURRENT_DATE;
    v_next    := CURRENT_DATE + (v_filter_months || ' months')::interval;

    -- Éviter les doublons : un même client / produit / commande => un seul record
    SELECT * INTO v_existing
      FROM eaumalik.maintenance_records
     WHERE order_id = NEW.id AND product_id = v_item.product_id
     LIMIT 1;

    IF v_existing.id IS NULL THEN
      INSERT INTO eaumalik.maintenance_records (
        client_name, client_phone, client_city, client_address,
        user_id, order_id, product_id, product_name,
        install_date, next_service_date, service_interval_months,
        status, filter_types, created_at, updated_at
      ) VALUES (
        NEW.client_name, NEW.client_phone, NEW.client_city, NEW.client_address,
        NEW.user_id, NEW.id, v_item.product_id, v_item.product_name,
        v_install, v_next, v_filter_months,
        'actif',
        CASE WHEN v_item.product_name ILIKE '%ro%' OR v_item.product_name ILIKE '%osmose%'
             THEN ARRAY['Sediment','Carbon','RO Membrane','Post-Carbon']
             ELSE ARRAY['Sediment','Carbon','Mineral']
        END,
        now(), now()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_auto_maintenance ON eaumalik.orders;
CREATE TRIGGER trg_orders_auto_maintenance
  AFTER UPDATE OF status ON eaumalik.orders
  FOR EACH ROW
  EXECUTE FUNCTION eaumalik.ensure_maintenance_on_delivery();

-- ----------------------------------------------------------------------------
-- 5) Trigger — mise à jour automatique des compteurs sur la fiche parente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eaumalik.refresh_record_after_intervention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public
AS $$
BEGIN
  UPDATE eaumalik.maintenance_records
     SET last_service_date  = NEW.performed_at::date,
         next_service_date  = COALESCE(NEW.next_service_date, next_service_date),
         total_cost         = COALESCE(total_cost, 0) + COALESCE(NEW.cost, 0),
         intervention_count = (SELECT COUNT(*) FROM eaumalik.maintenance_interventions
                                WHERE record_id = NEW.record_id
                                  AND outcome = 'completed'),
         status = CASE
           WHEN NEW.outcome = 'failed' THEN 'a_renouveler'
           WHEN (SELECT next_service_date FROM eaumalik.maintenance_records WHERE id = NEW.record_id) < CURRENT_DATE THEN 'a_renouveler'
           ELSE 'actif'
         END,
         updated_at = now()
   WHERE id = NEW.record_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intervention_refresh ON eaumalik.maintenance_interventions;
CREATE TRIGGER trg_intervention_refresh
  AFTER INSERT ON eaumalik.maintenance_interventions
  FOR EACH ROW
  EXECUTE FUNCTION eaumalik.refresh_record_after_intervention();

-- ----------------------------------------------------------------------------
-- 6) Policies RLS — accès admin pour maintenance_records / interventions
-- ----------------------------------------------------------------------------
ALTER TABLE eaumalik.maintenance_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE eaumalik.maintenance_interventions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS maint_records_admin_all ON eaumalik.maintenance_records;
CREATE POLICY maint_records_admin_all ON eaumalik.maintenance_records
  FOR ALL
  USING (eaumalik.is_admin())
  WITH CHECK (eaumalik.is_admin());

DROP POLICY IF EXISTS maint_records_owner_read ON eaumalik.maintenance_records;
CREATE POLICY maint_records_owner_read ON eaumalik.maintenance_records
  FOR SELECT
  USING (user_id = auth.uid() OR eaumalik.is_admin());

DROP POLICY IF EXISTS maint_inter_admin_all ON eaumalik.maintenance_interventions;
CREATE POLICY maint_inter_admin_all ON eaumalik.maintenance_interventions
  FOR ALL
  USING (eaumalik.is_admin())
  WITH CHECK (eaumalik.is_admin());

DROP POLICY IF EXISTS maint_inter_owner_read ON eaumalik.maintenance_interventions;
CREATE POLICY maint_inter_owner_read ON eaumalik.maintenance_interventions
  FOR SELECT
  USING (
    eaumalik.is_admin()
    OR EXISTS (
      SELECT 1 FROM eaumalik.maintenance_records r
       WHERE r.id = maintenance_interventions.record_id
         AND r.user_id = auth.uid()
    )
  );

-- Policies pour les nouvelles colonnes de orders (les colonnes ajoutées héritent par défaut)
DROP POLICY IF EXISTS orders_admin_update ON eaumalik.orders;
CREATE POLICY orders_admin_update ON eaumalik.orders
  FOR UPDATE
  USING (eaumalik.is_admin())
  WITH CHECK (eaumalik.is_admin());
