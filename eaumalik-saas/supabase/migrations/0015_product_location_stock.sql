-- ============================================================================
-- Migration 0015 — product_location_stock (stock par localité)
-- ============================================================================
-- Source de vérité pour la répartition du stock entre localités.
-- products.stock = SUM(product_location_stock.quantity WHERE product_id=?)
-- maintenu par trigger AFTER INSERT/UPDATE/DELETE.
--
-- Backfill : tous les produits avec stock>0 sont affectés au dépôt par
-- défaut D-CASA-DEPOT (créé en migration 0014).
-- ============================================================================

SET search_path TO eaumalik, public;

-- ============================================================================
-- 1. Table product_location_stock
-- ============================================================================
CREATE TABLE IF NOT EXISTS eaumalik.product_location_stock (
  product_id   UUID NOT NULL REFERENCES eaumalik.products(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES eaumalik.locations(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_pls_location
  ON eaumalik.product_location_stock (location_id);
CREATE INDEX IF NOT EXISTS idx_pls_quantity
  ON eaumalik.product_location_stock (quantity);

COMMENT ON TABLE eaumalik.product_location_stock IS
  'Répartition du stock par localité. products.stock = SUM(quantity) pour un product_id donné.';

-- ============================================================================
-- 2. Vue product_stock_by_location (jointure lisible)
-- ============================================================================
CREATE OR REPLACE VIEW eaumalik.product_stock_by_location AS
SELECT
  pls.product_id,
  p.name AS product_name,
  p.category AS product_category,
  pls.location_id,
  l.code AS location_code,
  l.name AS location_name,
  l.type AS location_type,
  pls.quantity,
  pls.updated_at
FROM eaumalik.product_location_stock pls
LEFT JOIN eaumalik.products  p ON p.id = pls.product_id
LEFT JOIN eaumalik.locations l ON l.id = pls.location_id;

COMMENT ON VIEW eaumalik.product_stock_by_location IS
  'Vue jointe pour l''inventaire par localité — affichage direct côté UI admin.';

-- ============================================================================
-- 3. Trigger — recalcul products.stock après chaque mutation
-- ============================================================================
CREATE OR REPLACE FUNCTION eaumalik.recompute_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total INTEGER;
  v_pid   UUID;
BEGIN
  v_pid := COALESCE(NEW.product_id, OLD.product_id);
  SELECT COALESCE(SUM(quantity), 0) INTO v_total
    FROM eaumalik.product_location_stock
    WHERE product_id = v_pid;
  UPDATE eaumalik.products
    SET stock = v_total, updated_at = now()
    WHERE id = v_pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_pls_recompute_insert ON eaumalik.product_location_stock;
CREATE TRIGGER trg_pls_recompute_insert
  AFTER INSERT ON eaumalik.product_location_stock
  FOR EACH ROW EXECUTE FUNCTION eaumalik.recompute_product_stock();

DROP TRIGGER IF EXISTS trg_pls_recompute_update ON eaumalik.product_location_stock;
CREATE TRIGGER trg_pls_recompute_update
  AFTER UPDATE ON eaumalik.product_location_stock
  FOR EACH ROW EXECUTE FUNCTION eaumalik.recompute_product_stock();

DROP TRIGGER IF EXISTS trg_pls_recompute_delete ON eaumalik.product_location_stock;
CREATE TRIGGER trg_pls_recompute_delete
  AFTER DELETE ON eaumalik.product_location_stock
  FOR EACH ROW EXECUTE FUNCTION eaumalik.recompute_product_stock();

-- ============================================================================
-- 4. Backfill initial : tous les produits avec stock>0 vont dans D-CASA-DEPOT
-- ============================================================================
INSERT INTO eaumalik.product_location_stock (product_id, location_id, quantity)
SELECT p.id, (SELECT id FROM eaumalik.locations WHERE code = 'D-CASA-DEPOT'), p.stock
FROM eaumalik.products p
WHERE p.stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM eaumalik.product_location_stock
    WHERE product_id = p.id
  )
ON CONFLICT (product_id, location_id) DO NOTHING;

COMMENT ON TABLE eaumalik.product_location_stock IS
  'Répartition du stock par localité (trigger auto-recalcul de products.stock). Backfill initial : tout dans D-CASA-DEPOT.';

-- ============================================================================
-- 5. RLS — product_location_stock
-- ============================================================================
ALTER TABLE eaumalik.product_location_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent le stock par localité" ON eaumalik.product_location_stock;
CREATE POLICY "Admins gèrent le stock par localité" ON eaumalik.product_location_stock
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Logistiques lisent leur stock" ON eaumalik.product_location_stock;
CREATE POLICY "Logistiques lisent leur stock" ON eaumalik.product_location_stock
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
    OR location_id = ANY (
      SELECT unnest(managed_location_ids)
      FROM eaumalik.users
      WHERE id = auth.uid()
    )
  );