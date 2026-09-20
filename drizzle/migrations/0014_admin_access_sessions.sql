-- Audit only: this registry does not replace the existing password validation.
CREATE SCHEMA IF NOT EXISTS atlas_private;
REVOKE ALL ON SCHEMA atlas_private FROM PUBLIC, anon, authenticated;
CREATE TABLE atlas_private.admin_access_sessions (
  session_id uuid PRIMARY KEY,
  device_id uuid,
  device_label text NOT NULL CHECK (char_length(device_label) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE atlas_private.admin_access_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON atlas_private.admin_access_sessions FROM PUBLIC, anon, authenticated;
CREATE INDEX admin_access_sessions_last_seen ON atlas_private.admin_access_sessions (last_seen_at DESC);

-- SECURITY DEFINER is restricted to these password-checked audit APIs.
CREATE OR REPLACE FUNCTION public.admin_touch_access_session(
  _password text, _session_id uuid, _device_id uuid, _device_label text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._require_admin(_password);
  IF _session_id IS NULL OR _device_id IS NULL OR nullif(trim(_device_label), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_device_session';
  END IF;
  INSERT INTO atlas_private.admin_access_sessions AS current_session (session_id, device_id, device_label)
  VALUES (_session_id, _device_id, left(trim(_device_label), 120))
  ON CONFLICT (session_id) DO UPDATE SET
    device_id = excluded.device_id,
    device_label = excluded.device_label,
    last_seen_at = CASE WHEN current_session.ended_at IS NULL THEN now() ELSE current_session.last_seen_at END;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_end_access_session(_password text, _session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._require_admin(_password);
  IF _session_id IS NULL THEN RAISE EXCEPTION 'invalid_device_session'; END IF;
  -- A tombstone also handles logout arriving before an in-flight first heartbeat.
  INSERT INTO atlas_private.admin_access_sessions (session_id, device_label, ended_at)
  VALUES (_session_id, 'Aparelho não informado', now())
  ON CONFLICT (session_id) DO UPDATE SET ended_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_access_sessions(_password text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.last_seen_at DESC), '[]'::jsonb)
  INTO result FROM (
    SELECT session_id, device_id, device_label, created_at, last_seen_at, ended_at
    FROM atlas_private.admin_access_sessions ORDER BY last_seen_at DESC LIMIT 100
  ) s;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_touch_access_session(text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_end_access_session(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_access_sessions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_touch_access_session(text, uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_end_access_session(text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_access_sessions(text) TO anon, authenticated, service_role;