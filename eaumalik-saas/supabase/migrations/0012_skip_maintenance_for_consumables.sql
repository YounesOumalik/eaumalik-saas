-- ============================================================================
-- Skip auto-maintenance for "consommables" (pieces detachees / filtres seuls)
--
-- Contexte
--   Le trigger `ensure_maintenance_on_delivery` (migration 0004) cree une
--   fiche maintenance par ligne de produit d'une commande passee a 'livree'.
--   C'est correct pour les produits installes (purificateurs, osmoseurs,
--   industriels), mais INUTILE pour les pieces de rechange vendues separement
--   (filtres a sediments, charbon actif, etc.) : un filtre seul ne se
--   'maintient' pas, il se remplace quand le client en achete un nouveau.
--
-- Cette migration :
--   1. Modifie le trigger pour JOIN avec `eaumalik.products` et SKIP toute
--      ligne dont la categorie vaut 'consommables'. On utilise une sous-
--      requete dans le LOOP plutot qu'un nouveau WHERE global, pour rester
--      compatible avec la structure existante.
--   2. Supprime les fiches deja creees pour des consommables, avec leurs
--      interventions associees (CASCADE).
-- ============================================================================

SET search_path TO eaumalik, public;

-- ----------------------------------------------------------------------------
-- 1) Mise a jour de la fonction trigger : skip category = 'consommables'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eaumalik.ensure_maintenance_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_filter_months INTEGER;
  v_install DATE;
  v_next DATE;
  v_existing RECORD;
BEGIN
  -- Seulement sur transition vers 'livree'
  IF NEW.status IS DISTINCT FROM 'livree' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'livree' THEN
    RETURN NEW;
  END IF;

  NEW.delivered_at := COALESCE(NEW.delivered_at, now());
  NEW.tracking_number := COALESCE(NEW.tracking_number, NEW.order_number);

  FOR v_item IN
    SELECT oi.product_id, oi.product_name, oi.quantity, p.category
      FROM eaumalik.order_items oi
      LEFT JOIN eaumalik.products p ON p.id = oi.product_id
     WHERE oi.order_id = NEW.id
       -- Les pieces de rechange ne genèrent pas de maintenance : un filtre
       -- seul ne s'installe pas et ne se maintient pas, il se remplace
       -- a l'achat d'un nouveau.
       AND COALESCE(p.category, 'purificateurs') <> 'consommables'
  LOOP
    SELECT COALESCE(filter_lifespan_months, 6) INTO v_filter_months
      FROM eaumalik.products
     WHERE id = v_item.product_id;
    IF v_filter_months IS NULL OR v_filter_months <= 0 THEN
      v_filter_months := 6;
    END IF;

    v_install := CURRENT_DATE;
    v_next    := CURRENT_DATE + (v_filter_months || ' months')::interval;

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

-- Le trigger existe deja depuis la 0004, on ne le recree pas.
DROP TRIGGER IF EXISTS trg_orders_auto_maintenance ON eaumalik.orders;
CREATE TRIGGER trg_orders_auto_maintenance
  AFTER UPDATE OF status ON eaumalik.orders
  FOR EACH ROW
  EXECUTE FUNCTION eaumalik.ensure_maintenance_on_delivery();

-- ----------------------------------------------------------------------------
-- 2) Nettoyage des fiches existantes qui pointent sur un consommable.
--    ON DELETE CASCADE sur maintenance_interventions.record_id propage la
--    suppression aux interventions liees.
-- ----------------------------------------------------------------------------
DELETE FROM eaumalik.maintenance_records r
USING eaumalik.products p
 WHERE p.id = r.product_id
   AND p.category = 'consommables';