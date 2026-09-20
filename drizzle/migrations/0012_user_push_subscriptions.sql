ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'admin';
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS key_id uuid REFERENCES public.access_keys(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.user_save_push_subscription(_key text, _endpoint text, _p256dh text, _auth text, _device text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kid uuid;
BEGIN
  IF NOT public._valid_access_key(_key) THEN RAISE EXCEPTION 'invalid_key'; END IF;
  SELECT id INTO kid FROM public.access_keys WHERE key = upper(trim(_key));
  IF kid IS NULL THEN RAISE EXCEPTION 'invalid_key'; END IF;
  IF coalesce(trim(_endpoint), '') = '' OR coalesce(trim(_p256dh), '') = '' OR coalesce(trim(_auth), '') = '' THEN
    RAISE EXCEPTION 'invalid_subscription';
  END IF;

  INSERT INTO public.push_subscriptions (endpoint, p256dh, auth, device, scope, key_id)
  VALUES (trim(_endpoint), trim(_p256dh), trim(_auth), nullif(trim(coalesce(_device, '')), ''), 'user', kid)
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = excluded.p256dh,
        auth = excluded.auth,
        device = excluded.device,
        scope = 'user',
        key_id = excluded.key_id,
        last_seen_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_delete_push_subscription(_key text, _endpoint text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kid uuid;
BEGIN
  SELECT id INTO kid FROM public.access_keys WHERE key = upper(trim(_key));
  IF kid IS NULL THEN RAISE EXCEPTION 'invalid_key'; END IF;
  DELETE FROM public.push_subscriptions WHERE endpoint = trim(_endpoint) AND key_id = kid AND scope = 'user';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_push_status(_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions p
    JOIN public.access_keys k ON k.id = p.key_id
    WHERE p.scope = 'user' AND upper(k.key) = upper(trim(_key))
  )
$$;