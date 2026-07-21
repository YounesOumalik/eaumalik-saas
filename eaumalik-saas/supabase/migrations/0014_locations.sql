-- ============================================================================
-- Migration 0014 — Module Logistique : localités + sous-rôles + transferts
-- ============================================================================
-- Ajoute :
--   1. Table eaumalik.locations  (dépôts / magasins / présentoirs)
--   2. Extension du CHECK users_role_check avec 3 sous-rôles logistiques
--   3. Colonne users.managed_location_ids (UUID[]) pour les sous-rôles
--   4. Table eaumalik.transfer_requests (workflow d'approbation 2 niveaux)
--   5. RPC eaumalik.execute_transfer_request (transactionnel + audit)
--   6. Vues eaumalik.transfer_request_details + locations par user
-- ============================================================================

SET search_path TO eaumalik, public;

-- ============================================================================
-- 1. Table eaumalik.locations
-- ============================================================================
CREATE TABLE IF NOT EXISTS eaumalik.locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  -- Type de localité : depot (entrepôt), magasin (point de vente), presentoir (showroom)
  type              TEXT NOT NULL CHECK (type IN ('depot','magasin','presentoir')),
  address           TEXT,
  city              TEXT,
  phone             TEXT,
  -- Capacités (0 = non renseigné, alerte désactivée)
  capacity_units    INTEGER NOT NULL DEFAULT 0 CHECK (capacity_units >= 0),
  capacity_area_m2  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (capacity_area_m2 >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_type
  ON eaumalik.locations (type);
CREATE INDEX IF NOT EXISTS idx_locations_active
  ON eaumalik.locations (is_archived, is_active);

COMMENT ON TABLE  eaumalik.locations IS
  'Module logistique — dépôts, magasins, présentoirs. Capacité en unités + surface.';
COMMENT ON COLUMN eaumalik.locations.capacity_units IS
  'Plafond en nombre d''articles. 0 = non renseigné.';
COMMENT ON COLUMN eaumalik.locations.capacity_area_m2 IS
  'Plafond en m² (surface). 0 = non renseigné.';

-- Seed : 3 localités initiales (idempotent via ON CONFLICT).
INSERT INTO eaumalik.locations (code, name, type, city, capacity_units, capacity_area_m2, is_active, notes)
VALUES
  ('D-CASA-DEPOT', 'Dépôt principal — Casablanca',  'depot',     'Casablanca', 0, 0, true, 'Seed initial — backfill des stocks existants.'),
  ('M-CASA-CENTRAL','Magasin central — Casablanca', 'magasin',   'Casablanca', 0, 0, true, 'Seed initial.'),
  ('P-SHOWROOM',    'Showroom / Présentoir',         'presentoir','Casablanca', 0, 0, true, 'Seed initial.')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. Extension users.role : 3 sous-rôles logistiques
-- ============================================================================
-- Migration 0006 a déjà étendu le CHECK avec les 7 rôles historiques.
-- On l'élargit pour inclure depot_manager / store_manager / presentoir_manager.
ALTER TABLE eaumalik.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE eaumalik.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'client',
    'admin',
    'administrator',
    'sales',
    'technician',
    'stock_manager',
    'admin_assistant',
    -- Nouveaux sous-rôles logistiques :
    'depot_manager',
    'store_manager',
    'presentoir_manager'
  ));

COMMENT ON CONSTRAINT users_role_check ON eaumalik.users IS
  'Whitelist des rôles — sync avec ALL_ROLES côté TypeScript (src/lib/supabase/server.ts).';

-- ============================================================================
-- 3. Colonne users.managed_location_ids (UUID[])
-- ============================================================================
-- Liste des localités que cet utilisateur peut gérer (lecture + transferts).
-- Renseigné uniquement pour les sous-rôles logistiques ; un user admin/
-- administrator a accès à TOUTES les localités (managed_location_ids ignoré).
-- Le filtrage par type (depot/magasin/presentoir) se fait côté application.
ALTER TABLE eaumalik.users
  ADD COLUMN IF NOT EXISTS managed_location_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_managed_locations_gin
  ON eaumalik.users USING GIN (managed_location_ids);

COMMENT ON COLUMN eaumalik.users.managed_location_ids IS
  'Liste des localités gérées par cet utilisateur (sous-rôles logistiques uniquement). Vide pour les autres rôles.';

-- ============================================================================
-- 4. Table eaumalik.transfer_requests (workflow d'approbation 2 niveaux)
-- ============================================================================
-- Un staff logistique peut demander un transfert entre 2 localités. Si la
-- localité source est hors de ses affectations, la demande passe par :
--   (a) pending  → admin OU administrator approuvent
--   (b) approved → exécution via RPC execute_transfer_request
--   (c) rejected / cancelled / executed
-- ============================================================================
CREATE TABLE IF NOT EXISTS eaumalik.transfer_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              UUID NOT NULL REFERENCES eaumalik.products(id) ON DELETE CASCADE,
  source_location_id      UUID NOT NULL REFERENCES eaumalik.locations(id) ON DELETE RESTRICT,
  destination_location_id UUID NOT NULL REFERENCES eaumalik.locations(id) ON DELETE RESTRICT,
  quantity                INTEGER NOT NULL CHECK (quantity > 0),
  -- Source du stock à transférer (alias historique). Sert à distinguer
  -- "j'ai du stock ici, demande d'envoi" (request_type='outbound') vs
  -- "j'ai besoin ici, demande de réassort" (request_type='inbound').
  request_type            TEXT NOT NULL DEFAULT 'outbound'
                            CHECK (request_type IN ('outbound','inbound')),
  requester_id            UUID NOT NULL REFERENCES eaumalik.users(id) ON DELETE RESTRICT,
  reason                  TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected','executed','cancelled')),
  validator_id            UUID REFERENCES eaumalik.users(id) ON DELETE SET NULL,
  validated_at            TIMESTAMPTZ,
  validator_comment       TEXT,
  executed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Contraintes sémantiques
  CHECK (source_location_id <> destination_location_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_status
  ON eaumalik.transfer_requests (status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_requester
  ON eaumalik.transfer_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_product
  ON eaumalik.transfer_requests (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_locations
  ON eaumalik.transfer_requests (source_location_id, destination_location_id);

COMMENT ON TABLE eaumalik.transfer_requests IS
  'Workflow d''approbation des transferts de stock entre localités. Approbation par admin OU administrator.';

-- ============================================================================
-- 5. Vue eaumalik.transfer_request_details (jointures pour l'UI)
-- ============================================================================
CREATE OR REPLACE VIEW eaumalik.transfer_request_details AS
SELECT
  tr.id,
  tr.product_id,
  p.name AS product_name,
  p.category AS product_category,
  tr.source_location_id,
  sl.code AS source_code,
  sl.name AS source_name,
  sl.type AS source_type,
  tr.destination_location_id,
  dl.code AS destination_code,
  dl.name AS destination_name,
  dl.type AS destination_type,
  tr.quantity,
  tr.request_type,
  tr.requester_id,
  req.full_name AS requester_name,
  req.role AS requester_role,
  tr.reason,
  tr.status,
  tr.validator_id,
  val.full_name AS validator_name,
  val.role AS validator_role,
  tr.validated_at,
  tr.validator_comment,
  tr.executed_at,
  tr.created_at,
  tr.updated_at
FROM eaumalik.transfer_requests tr
LEFT JOIN eaumalik.products  p   ON p.id = tr.product_id
LEFT JOIN eaumalik.locations sl  ON sl.id = tr.source_location_id
LEFT JOIN eaumalik.locations dl  ON dl.id = tr.destination_location_id
LEFT JOIN eaumalik.users     req ON req.id = tr.requester_id
LEFT JOIN eaumalik.users     val ON val.id = tr.validator_id;

COMMENT ON VIEW eaumalik.transfer_request_details IS
  'Vue jointe pour l''UI admin — toutes les infos nécessaires au workflow de transfert en une seule requête.';

-- ============================================================================
-- 6. RPC eaumalik.execute_transfer_request (transactionnel)
-- ============================================================================
-- Appelé après une approbation. Verrouille les 2 lignes de stock,
-- applique la mutation, écrit 2 lignes dans product_restock_history
-- (reason='transfer', même transfer_group_id), recalcule products.stock
-- global, marque la demande executed. Tout est dans une seule transaction.
-- ============================================================================
CREATE OR REPLACE FUNCTION eaumalik.execute_transfer_request(p_request_id UUID)
RETURNS TABLE(
  ok BOOLEAN,
  error TEXT,
  new_source_qty INTEGER,
  new_dest_qty INTEGER,
  new_global_stock INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public
AS $$
DECLARE
  v_status        TEXT;
  v_product_id    UUID;
  v_source_id     UUID;
  v_dest_id       UUID;
  v_quantity      INTEGER;
  v_transfer_grp  UUID := gen_random_uuid();
  v_source_qty    INTEGER;
  v_dest_qty      INTEGER;
  v_new_source    INTEGER;
  v_new_dest      INTEGER;
  v_global        INTEGER;
BEGIN
  -- Lock la demande pour éviter double-exécution.
  SELECT status, product_id, source_location_id, destination_location_id, quantity
    INTO v_status, v_product_id, v_source_id, v_dest_id, v_quantity
  FROM eaumalik.transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT false, 'Demande introuvable.'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;
  IF v_status <> 'approved' THEN
    RETURN QUERY SELECT false, ('Demande non approuvée (status=' || v_status || ').')::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- Lock les 2 lignes de stock dans un ordre stable pour éviter les deadlocks.
  -- Si l'une des lignes n'existe pas encore, on la crée avec qty=0.
  INSERT INTO eaumalik.product_location_stock (product_id, location_id, quantity)
    VALUES (v_product_id, v_source_id, 0)
    ON CONFLICT (product_id, location_id) DO NOTHING;
  INSERT INTO eaumalik.product_location_stock (product_id, location_id, quantity)
    VALUES (v_product_id, v_dest_id, 0)
    ON CONFLICT (product_id, location_id) DO NOTHING;

  -- Lock + lecture des quantités actuelles (ordre déterministe par location_id).
  SELECT quantity INTO v_source_qty
    FROM eaumalik.product_location_stock
    WHERE product_id = v_product_id AND location_id = v_source_id
    FOR UPDATE;
  SELECT quantity INTO v_dest_qty
    FROM eaumalik.product_location_stock
    WHERE product_id = v_product_id AND location_id = v_dest_id
    FOR UPDATE;

  IF v_source_qty < v_quantity THEN
    RETURN QUERY SELECT false,
      ('Stock insuffisant en source (dispo=' || v_source_qty || ', demandé=' || v_quantity || ').')::TEXT,
      v_source_qty, v_dest_qty, NULL::INTEGER;
    RETURN;
  END IF;

  v_new_source := v_source_qty - v_quantity;
  v_new_dest   := v_dest_qty + v_quantity;

  UPDATE eaumalik.product_location_stock SET quantity = v_new_source, updated_at = now()
    WHERE product_id = v_product_id AND location_id = v_source_id;
  UPDATE eaumalik.product_location_stock SET quantity = v_new_dest, updated_at = now()
    WHERE product_id = v_product_id AND location_id = v_dest_id;

  -- Audit : 2 lignes dans product_restock_history (sortie + entrée), liées
  -- par transfer_group_id. reason='transfer' (nouvelle valeur ajoutée au CHECK).
  INSERT INTO eaumalik.product_restock_history
    (id, product_id, quantity, restock_date, reason, note, created_by, source_location_id, destination_location_id, transfer_group_id)
  VALUES
    (gen_random_uuid()::TEXT, v_product_id, -v_quantity, CURRENT_DATE, 'transfer',
     'Transfert sortant vers ' || (SELECT code FROM eaumalik.locations WHERE id = v_dest_id),
     'transfer-request:' || p_request_id::TEXT, v_source_id, v_dest_id, v_transfer_grp),
    (gen_random_uuid()::TEXT, v_product_id,  v_quantity, CURRENT_DATE, 'transfer',
     'Transfert entrant depuis ' || (SELECT code FROM eaumalik.locations WHERE id = v_source_id),
     'transfer-request:' || p_request_id::TEXT, v_source_id, v_dest_id, v_transfer_grp);

  -- Recalcule le stock global du produit.
  SELECT COALESCE(SUM(quantity), 0) INTO v_global
    FROM eaumalik.product_location_stock
    WHERE product_id = v_product_id;
  UPDATE eaumalik.products SET stock = v_global, updated_at = now() WHERE id = v_product_id;

  -- Marque la demande executed.
  UPDATE eaumalik.transfer_requests
    SET status = 'executed', executed_at = now(), updated_at = now()
    WHERE id = p_request_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_new_source, v_new_dest, v_global;
END;
$$;

COMMENT ON FUNCTION eaumalik.execute_transfer_request IS
  'Exécute un transfert de stock approuvé (transactionnel). Retourne les nouvelles quantités + le stock global recalculé.';

-- ============================================================================
-- 7. Trigger updated_at sur transfer_requests
-- ============================================================================
CREATE OR REPLACE FUNCTION eaumalik.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_requests_touch ON eaumalik.transfer_requests;
CREATE TRIGGER trg_transfer_requests_touch
  BEFORE UPDATE ON eaumalik.transfer_requests
  FOR EACH ROW EXECUTE FUNCTION eaumalik.touch_updated_at();

DROP TRIGGER IF EXISTS trg_locations_touch ON eaumalik.locations;
CREATE TRIGGER trg_locations_touch
  BEFORE UPDATE ON eaumalik.locations
  FOR EACH ROW EXECUTE FUNCTION eaumalik.touch_updated_at();

-- ============================================================================
-- 8. Étendre le CHECK product_restock_history.reason avec 'transfer'
-- ============================================================================
ALTER TABLE eaumalik.product_restock_history
  DROP CONSTRAINT IF EXISTS product_restock_history_reason_check;
ALTER TABLE eaumalik.product_restock_history
  ADD CONSTRAINT product_restock_history_reason_check
  CHECK (reason IN ('restock','return','direct_sale','correction','loss','other','transfer'));

-- ============================================================================
-- 9. Colonnes source/destination/transfer_group_id sur product_restock_history
-- ============================================================================
ALTER TABLE eaumalik.product_restock_history
  ADD COLUMN IF NOT EXISTS source_location_id      UUID REFERENCES eaumalik.locations(id) ON DELETE SET NULL;
ALTER TABLE eaumalik.product_restock_history
  ADD COLUMN IF NOT EXISTS destination_location_id UUID REFERENCES eaumalik.locations(id) ON DELETE SET NULL;
ALTER TABLE eaumalik.product_restock_history
  ADD COLUMN IF NOT EXISTS transfer_group_id       UUID;

CREATE INDEX IF NOT EXISTS idx_product_restock_transfer_group
  ON eaumalik.product_restock_history (transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_product_restock_source_loc
  ON eaumalik.product_restock_history (source_location_id);
CREATE INDEX IF NOT EXISTS idx_product_restock_dest_loc
  ON eaumalik.product_restock_history (destination_location_id);

COMMENT ON COLUMN eaumalik.product_restock_history.source_location_id IS
  'Localité d''origine du mouvement (transferts : localité source, mouvements simples : localité impactée).';
COMMENT ON COLUMN eaumalik.product_restock_history.destination_location_id IS
  'Localité de destination (transferts uniquement).';
COMMENT ON COLUMN eaumalik.product_restock_history.transfer_group_id IS
  'UUID partagé entre les 2 lignes d''un même transfert (sortie + entrée).';

-- ============================================================================
-- 10. RLS — Locations : admin (via SECURITY DEFINER RPC ou service_role)
-- ============================================================================
ALTER TABLE eaumalik.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent les localités" ON eaumalik.locations;
CREATE POLICY "Admins gèrent les localités" ON eaumalik.locations
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Sous-rôles logistiques lisent leurs localités affectées uniquement.
DROP POLICY IF EXISTS "Logistiques lisent leurs localités" ON eaumalik.locations;
CREATE POLICY "Logistiques lisent leurs localités" ON eaumalik.locations
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
    OR id = ANY (
      SELECT unnest(managed_location_ids)
      FROM eaumalik.users
      WHERE id = auth.uid()
    )
  );

ALTER TABLE eaumalik.transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent les demandes de transfert" ON eaumalik.transfer_requests;
CREATE POLICY "Admins gèrent les demandes de transfert" ON eaumalik.transfer_requests
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Staff lit ses propres demandes" ON eaumalik.transfer_requests;
CREATE POLICY "Staff lit ses propres demandes" ON eaumalik.transfer_requests
  FOR SELECT USING (requester_id = auth.uid());