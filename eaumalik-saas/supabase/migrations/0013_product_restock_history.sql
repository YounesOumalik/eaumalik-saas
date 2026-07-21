-- ============================================================================
-- Migration 0013 — Table product_restock_history (historique des mouvements de stock)
-- ============================================================================
-- Permet de tracer chaque variation de stock (entrée, sortie, correction) depuis
-- le catalogue admin. Champs clés :
--   - quantity (signée) : > 0 = entrée, < 0 = sortie
--   - reason             : motif du mouvement
--   - note               : contexte libre (fournisseur, lot, n° commande…)
--
-- La mise à jour du stock (UPDATE products SET stock = stock + ?) reste faite
-- côté application (Server Action) avec rollback best-effort en cas d'erreur
-- d'insertion dans l'historique (cf. adjustProductStock() dans repositories.ts).
-- ============================================================================

SET search_path TO eaumalik, public;

-- Suppression d'une éventuelle version antérieure de la table (sécurité
-- en cas de redéploiement manuel de cette migration).
DROP TABLE IF EXISTS eaumalik.product_restock_history CASCADE;

CREATE TABLE eaumalik.product_restock_history (
  id           TEXT PRIMARY KEY,
  product_id   UUID NOT NULL REFERENCES eaumalik.products(id) ON DELETE CASCADE,
  -- Variation de stock signée : > 0 entrée, < 0 sortie, != 0 correction.
  quantity     INTEGER NOT NULL CHECK (quantity <> 0),
  restock_date DATE NOT NULL,
  -- Motif du mouvement (cf. StockMovementReason côté TS).
  reason       TEXT NOT NULL DEFAULT 'restock'
                 CHECK (reason IN ('restock','return','direct_sale','correction','loss','other')),
  note         TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_restock_product_id
  ON eaumalik.product_restock_history (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_restock_date
  ON eaumalik.product_restock_history (restock_date DESC);

CREATE INDEX IF NOT EXISTS idx_product_restock_reason
  ON eaumalik.product_restock_history (reason);

COMMENT ON TABLE  eaumalik.product_restock_history IS
  'Historique des mouvements de stock (entrées, sorties, corrections) — un événement par mouvement.';
COMMENT ON COLUMN eaumalik.product_restock_history.quantity IS
  'Variation de stock signée : > 0 = entrée, < 0 = sortie.';
COMMENT ON COLUMN eaumalik.product_restock_history.restock_date IS
  'Date effective du mouvement (saisie par l''admin). Distincte de created_at (timestamp serveur).';
COMMENT ON COLUMN eaumalik.product_restock_history.reason IS
  'Motif du mouvement : restock, return, direct_sale, correction, loss, other.';
COMMENT ON COLUMN eaumalik.product_restock_history.note IS
  'Note libre : fournisseur, référence de lot, commentaire, etc.';

-- RLS : seuls les admins lisent / écrivent dans cet historique.
-- En mode mock (data-store JSON) la table n'est pas utilisée.
ALTER TABLE eaumalik.product_restock_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gèrent l'historique d'approvisionnement" ON eaumalik.product_restock_history;
CREATE POLICY "Admins gèrent l'historique d'approvisionnement" ON eaumalik.product_restock_history
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');