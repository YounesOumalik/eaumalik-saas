-- Expose le motif de statut dans la vue publique consommée par PostgREST.
-- Sans cette colonne, une mise à jour via le client Supabase échoue avec PGRST204
-- même si eaumalik.maintenance_records possède bien status_reason.

CREATE OR REPLACE VIEW public.maintenance_records AS
SELECT
  id,
  client_name,
  client_phone,
  client_city,
  client_address,
  user_id,
  order_id,
  product_id,
  product_name,
  install_date,
  next_service_date,
  service_interval_months,
  status,
  status_reason,
  notes,
  filter_types,
  last_service_date,
  last_reminder_sent,
  total_cost,
  intervention_count,
  created_at,
  updated_at
FROM eaumalik.maintenance_records;

COMMENT ON VIEW public.maintenance_records IS
  'Vue PostgREST de eaumalik.maintenance_records, incluant le motif de statut.';

NOTIFY pgrst, 'reload schema';
