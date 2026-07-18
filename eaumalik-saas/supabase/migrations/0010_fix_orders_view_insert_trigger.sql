-- Fix checkout: public.orders contains the computed `items` column while
-- eaumalik.orders does not. Never copy NEW.* into the base table because it
-- makes PostgreSQL reject the insert with 42601.

CREATE OR REPLACE FUNCTION public.orders_iud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = eaumalik, public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean := eaumalik.is_admin();
  v_is_trusted_server boolean :=
    COALESCE(auth.role(), '') = 'service_role'
    OR current_setting('role', true) IN ('service_role', 'postgres')
    OR session_user IN ('service_role', 'postgres');
  v_owner uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL
       AND v_caller IS DISTINCT FROM NEW.user_id
       AND NOT v_is_admin
       AND NOT v_is_trusted_server THEN
      RAISE EXCEPTION 'accès refusé (orders insert)';
    END IF;

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
    SELECT user_id INTO v_owner FROM eaumalik.orders WHERE id = OLD.id;
    IF v_caller IS DISTINCT FROM v_owner
       AND NOT v_is_admin
       AND NOT v_is_trusted_server THEN
      RAISE EXCEPTION 'accès refusé (orders update)';
    END IF;
    UPDATE eaumalik.orders SET
      order_number = NEW.order_number,
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
    SELECT user_id INTO v_owner FROM eaumalik.orders WHERE id = OLD.id;
    IF v_caller IS DISTINCT FROM v_owner
       AND NOT v_is_admin
       AND NOT v_is_trusted_server THEN
      RAISE EXCEPTION 'accès refusé (orders delete)';
    END IF;
    DELETE FROM eaumalik.orders WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
