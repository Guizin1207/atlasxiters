CREATE OR REPLACE FUNCTION public.admin_clear_access_devices(_password text, _current_device_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE removed integer;
BEGIN
  PERFORM public._require_admin(_password);
  WITH gone AS (
    DELETE FROM atlas_private.admin_access_sessions
    WHERE _current_device_id IS NULL
       OR device_id IS NULL
       OR device_id <> _current_device_id
    RETURNING 1
  )
  SELECT count(*)::int INTO removed FROM gone;
  RETURN coalesce(removed, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_clear_access_devices(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_access_devices(text, uuid) TO anon, authenticated, service_role;

-- Um registro por dispositivo na listagem, reutilizando a tabela existente.
CREATE OR REPLACE FUNCTION public.admin_list_access_sessions(_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.last_seen_at DESC), '[]'::jsonb)
  INTO result FROM (
    SELECT DISTINCT ON (coalesce(device_id::text, session_id::text))
      session_id, device_id, device_label,
      created_at, last_seen_at, ended_at
    FROM atlas_private.admin_access_sessions
    ORDER BY coalesce(device_id::text, session_id::text), last_seen_at DESC
    LIMIT 100
  ) s;
  RETURN result;
END;
$function$;