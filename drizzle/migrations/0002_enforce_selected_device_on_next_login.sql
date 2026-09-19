CREATE OR REPLACE FUNCTION public.redeem_key(_key text, _device text, _device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.access_keys%rowtype;
  k text := upper(trim(_key));
BEGIN
  IF k IS NULL OR k = '' THEN RAISE EXCEPTION 'invalid_key'; END IF;
  SELECT * INTO rec FROM public.access_keys WHERE key = k;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_key'; END IF;
  IF rec.revoked THEN RAISE EXCEPTION 'revoked_key'; END IF;

  IF rec.is_master THEN
    UPDATE public.access_keys
       SET device = COALESCE(_device, device),
           device_id = COALESCE(_device_id, device_id),
           activated_at = COALESCE(activated_at, now())
     WHERE id = rec.id RETURNING * INTO rec;
    RETURN to_jsonb(rec);
  END IF;

  -- When the administrator selected a system and released the device ID,
  -- the next login must come from that selected system.
  IF rec.device_id IS NULL
     AND rec.device IS NOT NULL
     AND lower(rec.device) <> lower(COALESCE(_device, '')) THEN
    RAISE EXCEPTION 'device_mismatch';
  END IF;

  IF rec.activated_at IS NOT NULL THEN
    IF rec.device_id IS NOT NULL AND rec.device_id <> _device_id THEN
      RAISE EXCEPTION 'device_mismatch';
    END IF;
    IF rec.expires_at IS NOT NULL AND rec.expires_at < now() THEN
      RAISE EXCEPTION 'expired_key';
    END IF;
    UPDATE public.access_keys
       SET device = COALESCE(_device, device),
           device_id = COALESCE(rec.device_id, _device_id)
     WHERE id = rec.id RETURNING * INTO rec;
    RETURN to_jsonb(rec);
  END IF;

  UPDATE public.access_keys
     SET device = _device,
         device_id = _device_id,
         activated_at = now(),
         expires_at = now() + (rec.duration_days || ' days')::interval
   WHERE id = rec.id RETURNING * INTO rec;
  RETURN to_jsonb(rec);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_key(text, text, text) TO anon, authenticated;