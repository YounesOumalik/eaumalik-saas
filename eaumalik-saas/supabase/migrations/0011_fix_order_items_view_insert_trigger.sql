-- Fix checkout order lines: public.order_items is an updatable view. When an
-- item id is omitted by the API, NEW.id is NULL and `INSERT ... SELECT NEW.*`
-- bypasses the base-table UUID default by explicitly inserting NULL.

CREATE OR REPLACE FUNCTION public.order_items_iud()
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
  v_order_user uuid;
BEGIN
  SELECT o.user_id INTO v_order_user
  FROM eaumalik.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  IF TG_OP = 'INSERT' THEN
    IF v_order_user IS NOT NULL
       AND v_caller IS DISTINCT FROM v_order_user
       AND NOT v_is_admin
       AND NOT v_is_trusted_server THEN
      RAISE EXCEPTION 'accès refusé (order_items insert)';
    END IF;

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
    IF v_order_user IS NOT NULL
       AND v_caller IS DISTINCT FROM v_order_user
       AND NOT v_is_admin
       AND NOT v_is_trusted_server THEN
      RAISE EXCEPTION 'accès refusé (order_items delete)';
    END IF;
    DELETE FROM eaumalik.order_items WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
