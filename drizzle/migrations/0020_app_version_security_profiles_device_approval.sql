-- 1) Versão do app
INSERT INTO public.app_config (key, value, updated_at)
VALUES ('app_version', to_jsonb('1.0'::text), now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_app_version()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public._cfg_text('app_version'), '1.0')
$$;
GRANT EXECUTE ON FUNCTION public.get_app_version() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_app_version(_password text, _version text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE normalized text;
BEGIN
  PERFORM public._require_admin(_password);
  normalized := btrim(coalesce(_version, ''));
  IF normalized !~ '^[0-9]+\.[0-9]+$' THEN
    RAISE EXCEPTION 'invalid_version';
  END IF;
  INSERT INTO public.app_config (key, value, updated_at)
  VALUES ('app_version', to_jsonb(normalized), now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  RETURN normalized;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_app_version(text, text) TO anon, authenticated;

-- 2) Edição de avisos do ADM
ALTER TABLE public.admin_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_edit_message(_password text, _id uuid, _title text, _body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec public.admin_messages%rowtype;
BEGIN
  PERFORM public._require_admin(_password);
  IF coalesce(trim(_title), '') = '' THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF coalesce(trim(_body), '') = '' THEN RAISE EXCEPTION 'invalid_body'; END IF;
  UPDATE public.admin_messages SET title = trim(_title), body = trim(_body), edited_at = now()
  WHERE id = _id RETURNING * INTO rec;
  IF rec.id IS NULL THEN RAISE EXCEPTION 'message_not_found'; END IF;
  RETURN to_jsonb(rec);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_edit_message(text, uuid, text, text) TO anon, authenticated;

-- 3) Registro de segurança (anti-burla)
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,
  key_hint text,
  key_hash text,
  device_id text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON public.security_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.record_security_event(_key text, _device_id text, _device text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  event_id uuid;
  normalized_key text := upper(btrim(coalesce(_key, '')));
  recent_count integer;
BEGIN
  IF _reason NOT IN ('invalid_key', 'revoked_key', 'device_mismatch', 'account_mismatch') THEN
    RAISE EXCEPTION 'invalid_security_reason';
  END IF;
  SELECT count(*) INTO recent_count FROM public.security_events
  WHERE coalesce(device_id, '') = coalesce(_device_id, '') AND created_at > now() - interval '10 minutes';
  IF recent_count >= 20 THEN RETURN NULL; END IF;
  INSERT INTO public.security_events (reason, key_hint, key_hash, device_id, device)
  VALUES (
    _reason,
    CASE WHEN length(normalized_key) >= 4 THEN right(normalized_key, 4) ELSE normalized_key END,
    CASE WHEN normalized_key <> '' THEN md5(normalized_key) ELSE NULL END,
    nullif(_device_id, ''), nullif(_device, '')
  ) RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_security_event(text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_security_events(_password text)
RETURNS TABLE (id uuid, reason text, key_hint text, device_id text, device text, created_at timestamptz, notified_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin(_password);
  RETURN QUERY SELECT e.id, e.reason, e.key_hint, e.device_id, e.device, e.created_at, e.notified_at
  FROM public.security_events e ORDER BY e.created_at DESC LIMIT 100;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_security_events(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_security_event_notified(_event_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.security_events SET notified_at = coalesce(notified_at, now())
  WHERE id = _event_id AND notified_at IS NULL AND created_at > now() - interval '24 hours';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_security_event_notified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_security_event_notified(uuid) TO service_role;

-- 4) Perfis de conta
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(coalesce(new.email, ''), '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- 5) Aprovação de dispositivos ADM (aditivo)
ALTER TABLE atlas_private.admin_access_sessions
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','denied')),
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_device_id uuid;

CREATE OR REPLACE FUNCTION public.admin_set_device_approval(_password text, _current_device_id uuid, _device_id uuid, _approved boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._require_admin(_password);
  IF _device_id IS NULL OR _device_id = _current_device_id THEN
    RAISE EXCEPTION 'invalid_device';
  END IF;
  UPDATE atlas_private.admin_access_sessions
  SET approval_status = CASE WHEN _approved THEN 'approved' ELSE 'denied' END,
      approved_at = CASE WHEN _approved THEN now() ELSE NULL END,
      approved_by_device_id = _current_device_id
  WHERE device_id = _device_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_device_approval(text, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_device_approval(text, uuid, uuid, boolean) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_access_sessions(_password text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.last_seen_at DESC), '[]'::jsonb)
  INTO result FROM (
    SELECT DISTINCT ON (coalesce(device_id::text, session_id::text))
      session_id, device_id, device_label, created_at, last_seen_at, ended_at,
      approval_status, is_primary, approved_at, approved_by_device_id
    FROM atlas_private.admin_access_sessions
    ORDER BY coalesce(device_id::text, session_id::text), last_seen_at DESC
    LIMIT 100
  ) s;
  RETURN result;
END;
$$;
