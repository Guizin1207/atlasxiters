CREATE OR REPLACE FUNCTION public.get_app_appearance() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT COALESCE((SELECT value FROM public.app_config WHERE key = 'app_appearance'), '{"theme":"default","logo":""}'::jsonb) $$;
CREATE OR REPLACE FUNCTION public.admin_save_app_appearance(_password text, _theme text, _logo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
PERFORM public._require_admin(_password);
IF _theme IS NULL OR _theme NOT IN ('default','halloween','christmas','independence','new-year','children','easter','carnival') THEN RAISE EXCEPTION 'Tema inválido.'; END IF;
IF _logo IS NULL OR length(_logo) > 400000 OR (_logo <> '' AND _logo !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$') THEN RAISE EXCEPTION 'Logo inválida.'; END IF;
v := jsonb_build_object('theme', _theme, 'logo', _logo);
INSERT INTO public.app_config(key,value,updated_at) VALUES('app_appearance',v,now()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = now();
RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.get_app_appearance() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_app_appearance(text,text,text) TO anon, authenticated, service_role;