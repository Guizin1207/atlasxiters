-- Controle de aprovação dos dispositivos ADM.
ALTER TABLE atlas_private.admin_access_sessions
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','denied')),
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_device_id uuid;

CREATE INDEX IF NOT EXISTS admin_access_sessions_approval_status
  ON atlas_private.admin_access_sessions (approval_status);

-- Garante no máximo um ADM principal.
CREATE UNIQUE INDEX IF NOT EXISTS admin_access_sessions_one_primary
  ON atlas_private.admin_access_sessions (is_primary)
  WHERE is_primary = true AND approval_status = 'approved';

CREATE OR REPLACE FUNCTION public.admin_check_device_access(
  _password text, _device_id uuid, _device_label text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_status text;
  has_primary boolean;
BEGIN
  PERFORM public._require_admin(_password);

  IF _device_id IS NULL OR nullif(trim(_device_label), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_device';
  END IF;

  SELECT approval_status INTO current_status
  FROM atlas_private.admin_access_sessions
  WHERE device_id = _device_id
  ORDER BY last_seen_at DESC NULLS LAST
  LIMIT 1;

  IF current_status = 'approved' THEN
    IF NOT EXISTS (SELECT 1 FROM atlas_private.admin_access_sessions WHERE is_primary = true AND approval_status = 'approved') THEN
      UPDATE atlas_private.admin_access_sessions SET is_primary = true, approved_at = coalesce(approved_at, now()) WHERE device_id = _device_id;
    END IF;
    RETURN 'approved';
  END IF;

  IF current_status = 'denied' THEN
    RETURN 'denied';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM atlas_private.admin_access_sessions
    WHERE is_primary = true AND approval_status = 'approved'
  ) INTO has_primary;

  IF NOT has_primary THEN
    INSERT INTO atlas_private.admin_access_sessions
      (session_id, device_id, device_label, approval_status, is_primary, approved_at)
    VALUES
      (gen_random_uuid(), _device_id, left(trim(_device_label), 120), 'approved', true, now())
    ON CONFLICT DO NOTHING;
    RETURN 'approved';
  END IF;

  INSERT INTO atlas_private.admin_access_sessions
    (session_id, device_id, device_label, approval_status)
  VALUES
    (gen_random_uuid(), _device_id, left(trim(_device_label), 120), 'pending')
  ON CONFLICT DO NOTHING;

  RETURN 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_device_approval(
  _password text, _current_device_id uuid, _device_id uuid, _approved boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_main boolean;
BEGIN
  PERFORM public._require_admin(_password);

  SELECT EXISTS (
    SELECT 1 FROM atlas_private.admin_access_sessions
    WHERE device_id = _current_device_id
      AND is_primary = true
      AND approval_status = 'approved'
  ) INTO is_main;

  IF NOT is_main THEN
    RAISE EXCEPTION 'primary_admin_required';
  END IF;

  UPDATE atlas_private.admin_access_sessions
  SET approval_status = CASE WHEN _approved THEN 'approved' ELSE 'denied' END,
      is_primary = false,
      approved_at = CASE WHEN _approved THEN now() ELSE NULL END,
      approved_by_device_id = _current_device_id
  WHERE device_id = _device_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_access_sessions(_password text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.last_seen_at DESC), '[]'::jsonb)
  INTO result FROM (
    SELECT session_id, device_id, device_label, created_at, last_seen_at, ended_at,
           approval_status, is_primary, approved_at, approved_by_device_id
    FROM atlas_private.admin_access_sessions
    ORDER BY last_seen_at DESC LIMIT 100
  ) s;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_touch_access_session(
  _password text, _session_id uuid, _device_id uuid, _device_label text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE status text;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT approval_status INTO status
  FROM atlas_private.admin_access_sessions
  WHERE device_id = _device_id
  ORDER BY last_seen_at DESC NULLS LAST LIMIT 1;

  IF status IS NULL THEN
    RAISE EXCEPTION 'device_not_registered';
  END IF;
  IF status <> 'approved' THEN
    RAISE EXCEPTION 'admin_device_not_approved';
  END IF;

  INSERT INTO atlas_private.admin_access_sessions AS current_session
    (session_id, device_id, device_label, approval_status, is_primary)
  SELECT _session_id, _device_id, left(trim(_device_label), 120),
         approval_status, is_primary
  FROM atlas_private.admin_access_sessions
  WHERE device_id = _device_id
  ORDER BY last_seen_at DESC NULLS LAST LIMIT 1
  ON CONFLICT (device_id) WHERE device_id IS NOT NULL DO UPDATE SET
    session_id = excluded.session_id,
    device_label = excluded.device_label,
    approval_status = excluded.approval_status,
    is_primary = excluded.is_primary,
    last_seen_at = now(),
    ended_at = NULL;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_check_device_access(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_device_approval(text, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_check_device_access(text, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_device_approval(text, uuid, uuid, boolean) TO anon, authenticated, service_role;

-- Recuperação do ADM principal: se não existir um principal, o próximo dispositivo autenticado vira principal.
-- O RPC abaixo também permite ao próprio dono da senha mestra recuperar o principal sem liberar outros dispositivos.
CREATE OR REPLACE FUNCTION public.admin_recover_primary_device(
  _password text, _device_id uuid, _device_label text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._require_admin(_password);
  IF _device_id IS NULL OR nullif(trim(_device_label), '') IS NULL THEN RAISE EXCEPTION 'invalid_device'; END IF;
  IF EXISTS (SELECT 1 FROM atlas_private.admin_access_sessions WHERE is_primary = true AND approval_status = 'approved') THEN
    RETURN EXISTS (SELECT 1 FROM atlas_private.admin_access_sessions WHERE device_id = _device_id AND is_primary = true AND approval_status = 'approved');
  END IF;
  INSERT INTO atlas_private.admin_access_sessions
    (session_id, device_id, device_label, approval_status, is_primary, approved_at, last_seen_at)
  VALUES (gen_random_uuid(), _device_id, left(trim(_device_label),120), 'approved', true, now(), now())
  ON CONFLICT (device_id) WHERE device_id IS NOT NULL DO UPDATE SET
    approval_status='approved', is_primary=true, approved_at=now(), last_seen_at=now(), ended_at=NULL;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_recover_primary_device(text, uuid, text) TO anon, authenticated, service_role;
