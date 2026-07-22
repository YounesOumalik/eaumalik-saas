-- Les demandes du formulaire public deviennent des conversations CRM
-- identifiables, sans créer artificiellement un compte client.

SET search_path TO public, eaumalik, auth;

ALTER TABLE eaumalik.messages
  ADD COLUMN IF NOT EXISTS sender_kind text;

UPDATE eaumalik.messages
SET sender_kind = CASE
  WHEN sender_id IS NOT NULL THEN 'client'
  WHEN recipient_id IS NOT NULL OR sender_name = 'Administrateur EAUMALIK' THEN 'admin'
  ELSE 'public'
END
WHERE sender_kind IS NULL;

ALTER TABLE eaumalik.messages
  ALTER COLUMN sender_kind SET DEFAULT 'client',
  ALTER COLUMN sender_kind SET NOT NULL;

ALTER TABLE eaumalik.messages
  DROP CONSTRAINT IF EXISTS messages_sender_kind_check;

ALTER TABLE eaumalik.messages
  ADD CONSTRAINT messages_sender_kind_check
  CHECK (sender_kind IN ('client', 'admin', 'public'));

CREATE OR REPLACE VIEW public.messages
WITH (security_invoker = true)
AS SELECT * FROM eaumalik.messages;

ALTER VIEW public.messages OWNER TO postgres;
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT ON public.messages TO service_role;

NOTIFY pgrst, 'reload schema';
