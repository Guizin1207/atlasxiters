CREATE TABLE public.panel_functions (
  id text PRIMARY KEY,
  name text NOT NULL,
  tag text NOT NULL,
  min_plan text NOT NULL DEFAULT 'basic' CHECK (min_plan IN ('basic','pro','master')),
  icon text NOT NULL DEFAULT 'wand-2' CHECK (icon IN ('crosshair','eye','zap','shield','radar','gauge','wand-2','box','target','cpu','gamepad-2')),
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.panel_functions TO service_role;
ALTER TABLE public.panel_functions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.panel_functions (id,name,tag,min_plan,icon,sort_order) VALUES
('aim','Aim Assist','Combate','basic','crosshair',10),
('esp','ESP','Visão','basic','eye',20),
('speed','Velocidade','Mobilidade','basic','zap',30),
('shield','Anti-Recoil','Combate','pro','shield',40),
('radar','Radar','Visão','pro','radar',50),
('gauge','FPS Boost','Performance','pro','gauge',60),
('skin','Skin Changer','Visual','master','wand-2',70),
('magic','Auto Loot','Utilidade','master','box',80);

CREATE TABLE public.admin_ai_conversation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_ai_conversation TO service_role;
ALTER TABLE public.admin_ai_conversation ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_ai_conversation (singleton) VALUES (true);

CREATE TABLE public.admin_ai_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal jsonb NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_ai_audit TO service_role;
ALTER TABLE public.admin_ai_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._valid_access_key(_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.access_keys
    WHERE key = upper(trim(_key))
      AND revoked = false
      AND (is_master = true OR expires_at IS NULL OR expires_at >= now())
  )
$$;

CREATE OR REPLACE FUNCTION public.list_panel_functions(_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public._valid_access_key(_key) THEN RAISE EXCEPTION 'invalid_key'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.sort_order, f.created_at), '[]'::jsonb)
  INTO result FROM public.panel_functions f WHERE f.visible = true;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_panel_functions(_password text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.sort_order, f.created_at), '[]'::jsonb)
  INTO result FROM public.panel_functions f;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_ai_messages(_password text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT messages INTO result FROM public.admin_ai_conversation WHERE singleton = true;
  RETURN coalesce(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_ai_messages(_password text, _messages jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_admin(_password);
  IF jsonb_typeof(_messages) <> 'array' THEN RAISE EXCEPTION 'invalid_messages'; END IF;
  IF jsonb_array_length(_messages) > 200 THEN RAISE EXCEPTION 'history_too_large'; END IF;
  INSERT INTO public.admin_ai_conversation(singleton, messages, updated_at)
  VALUES (true, _messages, now())
  ON CONFLICT (singleton) DO UPDATE SET messages = excluded.messages, updated_at = now();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_apply_panel_proposal(_password text, _proposal jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  op text := lower(coalesce(_proposal->>'operation',''));
  fid text := lower(regexp_replace(coalesce(_proposal->>'id',''), '[^a-zA-Z0-9_-]', '', 'g'));
  fname text := trim(coalesce(_proposal->>'name',''));
  ftag text := trim(coalesce(_proposal->>'tag',''));
  fplan text := lower(coalesce(_proposal->>'minPlan','basic'));
  ficon text := lower(coalesce(_proposal->>'icon','wand-2'));
  fpos int := greatest(0, least(coalesce((_proposal->>'position')::int, 999), 999));
  before_row jsonb;
  after_row jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  IF op NOT IN ('create','update','delete','reorder') THEN RAISE EXCEPTION 'invalid_operation'; END IF;
  IF fid = '' OR length(fid) > 40 THEN RAISE EXCEPTION 'invalid_id'; END IF;
  IF fplan NOT IN ('basic','pro','master') THEN RAISE EXCEPTION 'invalid_plan'; END IF;
  IF ficon NOT IN ('crosshair','eye','zap','shield','radar','gauge','wand-2','box','target','cpu','gamepad-2') THEN RAISE EXCEPTION 'invalid_icon'; END IF;

  SELECT to_jsonb(f) INTO before_row FROM public.panel_functions f WHERE f.id = fid;

  IF op = 'create' THEN
    IF fname = '' OR ftag = '' OR length(fname) > 60 OR length(ftag) > 40 THEN RAISE EXCEPTION 'invalid_content'; END IF;
    INSERT INTO public.panel_functions(id,name,tag,min_plan,icon,sort_order)
    VALUES(fid,fname,ftag,fplan,ficon,fpos);
  ELSIF op = 'update' THEN
    UPDATE public.panel_functions SET
      name = CASE WHEN fname = '' THEN name ELSE left(fname,60) END,
      tag = CASE WHEN ftag = '' THEN tag ELSE left(ftag,40) END,
      min_plan = fplan,
      icon = ficon,
      sort_order = fpos,
      updated_at = now()
    WHERE id = fid;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  ELSIF op = 'delete' THEN
    UPDATE public.panel_functions SET visible = false, updated_at = now() WHERE id = fid;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  ELSE
    UPDATE public.panel_functions SET sort_order = fpos, updated_at = now() WHERE id = fid;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  END IF;

  SELECT to_jsonb(f) INTO after_row FROM public.panel_functions f WHERE f.id = fid;
  INSERT INTO public.admin_ai_audit(proposal,before_state,after_state)
  VALUES (_proposal,before_row,after_row);
  RETURN after_row;
END;
$$;

REVOKE ALL ON FUNCTION public._valid_access_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_panel_functions(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_panel_functions(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_ai_messages(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_ai_messages(text,jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_apply_panel_proposal(text,jsonb) TO anon, authenticated, service_role;