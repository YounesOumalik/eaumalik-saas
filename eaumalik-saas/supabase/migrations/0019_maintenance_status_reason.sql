-- Conserve le motif de suspension ou de résiliation d'une maintenance.

ALTER TABLE eaumalik.maintenance_records
  ADD COLUMN IF NOT EXISTS status_reason text;

COMMENT ON COLUMN eaumalik.maintenance_records.status_reason IS
  'Motif choisi lors de la suspension ou de la résiliation du programme.';

NOTIFY pgrst, 'reload schema';
