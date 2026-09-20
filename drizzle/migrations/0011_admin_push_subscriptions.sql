CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_save_push_subscription(_password text, _endpoint text, _p256dh text, _auth text, _device text DEFAULT NULL)
RETURNS public.push_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rec public.push_subscriptions%rowtype;
BEGIN
  PERFORM public._require_admin(_password);
  IF coalesce(trim(_endpoint),'') = '' OR coalesce(trim(_p256dh),'') = '' OR coalesce(trim(_auth),'') = '' THEN
    RAISE EXCEPTION 'invalid_subscription';
  END IF;
  INSERT INTO public.push_subscriptions(endpoint, p256dh, auth, device)
  VALUES (trim(_endpoint), trim(_p256dh), trim(_auth), nullif(trim(coalesce(_device,'')),''))
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = excluded.p256dh,
        auth = excluded.auth,
        device = coalesce(excluded.device, public.push_subscriptions.device),
        last_seen_at = now()
  RETURNING * INTO rec;
  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_push_subscriptions(_password text)
RETURNS SETOF public.push_subscriptions
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_admin(_password);
  RETURN QUERY SELECT * FROM public.push_subscriptions ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_push_subscription(_password text, _id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt int;
BEGIN
  PERFORM public._require_admin(_password);
  DELETE FROM public.push_subscriptions WHERE id = _id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt > 0;
END;
$$;