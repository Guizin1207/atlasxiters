-- Keep one ADM registry row per physical/browser device.
-- Existing audit rows are compacted before the unique device constraint.
DO $$
BEGIN
  DELETE FROM atlas_private.admin_access_sessions a
  USING atlas_private.admin_access_sessions b
  WHERE a.device_id IS NOT NULL
    AND a.device_id = b.device_id
    AND (
      a.last_seen_at < b.last_seen_at
      OR (a.last_seen_at = b.last_seen_at AND a.session_id < b.session_id)
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS admin_access_sessions_device_uidx
  ON atlas_private.admin_access_sessions (device_id)
  WHERE device_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_touch_access_session(
  _password text, _session_id uuid, _device_id uuid, _device_label text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public._require_admin(_password);

  IF _session_id IS NULL OR _device_id IS NULL OR nullif(trim(_device_label), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_device_session';
  END IF;

  INSERT INTO atlas_private.admin_access_sessions
    (session_id, device_id, device_label, created_at, last_seen_at, ended_at)
  VALUES
    (_session_id, _device_id, left(trim(_device_label), 120), now(), now(), NULL)
  ON CONFLICT (device_id) WHERE device_id IS NOT NULL
  DO UPDATE SET
    session_id = EXCLUDED.session_id,
    device_label = EXCLUDED.device_label,
    last_seen_at = now(),
    ended_at = NULL;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_end_access_session(_password text, _session_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public._require_admin(_password);

  IF _session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_device_session';
  END IF;

  UPDATE atlas_private.admin_access_sessions
  SET ended_at = now()
  WHERE session_id = _session_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_access_sessions(_password text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.last_seen_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT device_id, session_id, device_label, created_at, last_seen_at, ended_at
    FROM atlas_private.admin_access_sessions
    ORDER BY last_seen_at DESC
    LIMIT 100
  ) s;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_access_devices(
  _password text,
  _current_device_id uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE removed integer;
BEGIN
  PERFORM public._require_admin(_password);

  DELETE FROM atlas_private.admin_access_sessions
  WHERE _current_device_id IS NOT NULL
    AND device_id IS DISTINCT FROM _current_device_id;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_access_devices(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_access_devices(text, uuid) TO anon, authenticated, service_role;
