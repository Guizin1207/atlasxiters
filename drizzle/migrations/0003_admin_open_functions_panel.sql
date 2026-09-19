CREATE OR REPLACE FUNCTION public.admin_open_panel(_password text)
RETURNS public.access_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec public.access_keys%rowtype;
BEGIN
  PERFORM public._require_admin(_password);

  SELECT * INTO rec
  FROM public.access_keys
  WHERE is_master = true AND revoked = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'master_key_not_found';
  END IF;

  RETURN rec;
END;
$$;