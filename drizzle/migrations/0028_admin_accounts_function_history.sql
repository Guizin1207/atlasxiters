CREATE TABLE public.account_blocks (user_id uuid PRIMARY KEY, blocked boolean NOT NULL DEFAULT false, restore_key_ids uuid[] NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.account_blocks TO service_role;
ALTER TABLE public.account_blocks ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.function_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key_id uuid REFERENCES public.access_keys(id) ON DELETE CASCADE, user_id uuid, function_id text NOT NULL, function_name text NOT NULL, enabled boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.function_history TO service_role;
ALTER TABLE public.function_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX function_history_user_date ON public.function_history(user_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.admin_set_account_block(_password text,_user_id uuid,_blocked boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[];
BEGIN
 PERFORM public._require_admin(_password);
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=_user_id) THEN RAISE EXCEPTION 'user_not_found'; END IF;
 IF EXISTS (SELECT 1 FROM public.access_keys WHERE user_id=_user_id AND is_master) THEN RAISE EXCEPTION 'protected_account'; END IF;
 INSERT INTO public.account_blocks(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.account_blocks WHERE user_id=_user_id FOR UPDATE;
 IF (SELECT blocked FROM public.account_blocks WHERE user_id=_user_id)=_blocked THEN RETURN true; END IF;
 IF _blocked THEN
 SELECT coalesce(array_agg(id),'{}') INTO ids FROM public.access_keys WHERE user_id=_user_id AND NOT revoked;
 UPDATE public.account_blocks SET blocked=true,restore_key_ids=ids,updated_at=now() WHERE user_id=_user_id;
 UPDATE public.access_keys SET revoked=true WHERE user_id=_user_id AND NOT is_master;
 ELSE
 SELECT restore_key_ids INTO ids FROM public.account_blocks WHERE user_id=_user_id;
 UPDATE public.access_keys SET revoked=false WHERE user_id=_user_id AND id=ANY(ids) AND NOT is_master;
 UPDATE public.account_blocks SET blocked=false,restore_key_ids='{}',updated_at=now() WHERE user_id=_user_id;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_account_block(text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_block(text,uuid,boolean) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.admin_list_users(_password text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public._require_admin(_password);
 RETURN coalesce((SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC) FROM (
 SELECT u.id AS user_id,coalesce(nullif(p.full_name,''),u.raw_user_meta_data->>'full_name') AS username,u.email,u.created_at,u.last_sign_in_at,(p.id IS NOT NULL) AS has_profile,k.id AS key_id,k.key,k.plan,k.device,k.device_id,k.is_master,k.activated_at AS key_activated_at,k.expires_at AS key_expires_at,coalesce(b.blocked,false) AS blocked,
 CASE WHEN coalesce(b.blocked,false) THEN 'blocked' WHEN k.id IS NULL THEN 'no_key' WHEN k.revoked THEN 'revoked' WHEN k.expires_at IS NOT NULL AND k.expires_at<now() THEN 'expired' ELSE 'active' END AS status
 FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id LEFT JOIN public.account_blocks b ON b.user_id=u.id LEFT JOIN LATERAL (SELECT * FROM public.access_keys a WHERE a.user_id=u.id ORDER BY a.created_at DESC LIMIT 1) k ON true WHERE coalesce(u.is_anonymous,false)=false
 )t),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.capture_function_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry record; before_functions jsonb; after_functions jsonb; owner_id uuid;
BEGIN
 before_functions := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE coalesce(OLD.settings->'functions','{}'::jsonb) END;
 after_functions := coalesce(NEW.settings->'functions','{}'::jsonb);
 IF jsonb_typeof(before_functions)<>'object' OR jsonb_typeof(after_functions)<>'object' THEN RETURN NEW; END IF;
 SELECT user_id INTO owner_id FROM public.access_keys WHERE id=NEW.key_id;
 FOR entry IN SELECT f.id,f.name,coalesce(after_functions->f.id,'false'::jsonb)='true'::jsonb AS enabled FROM public.panel_functions f WHERE (coalesce(before_functions->f.id,'false'::jsonb)='true'::jsonb) IS DISTINCT FROM (coalesce(after_functions->f.id,'false'::jsonb)='true'::jsonb)
 LOOP INSERT INTO public.function_history(key_id,user_id,function_id,function_name,enabled) VALUES(NEW.key_id,owner_id,entry.id,entry.name,entry.enabled); END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER key_function_history AFTER INSERT OR UPDATE OF settings ON public.key_settings FOR EACH ROW EXECUTE FUNCTION public.capture_function_history();
CREATE OR REPLACE FUNCTION public.admin_client_history(_password text,_user_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public._require_admin(_password); RETURN coalesce((SELECT jsonb_agg(row_to_json(h) ORDER BY h.created_at DESC) FROM (SELECT id,function_name,enabled,created_at FROM public.function_history WHERE user_id=_user_id ORDER BY created_at DESC LIMIT 100)h),'[]'::jsonb); END $$;
REVOKE ALL ON FUNCTION public.admin_client_history(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_client_history(text,uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.save_settings(_key text,_settings jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE kid uuid; BEGIN
 IF NOT public._valid_access_key(_key) THEN RAISE EXCEPTION 'invalid_key'; END IF;
 SELECT id INTO kid FROM public.access_keys WHERE key=upper(trim(_key));
 INSERT INTO public.key_settings(key_id,settings,updated_at) VALUES(kid,coalesce(_settings,'{}'::jsonb),now()) ON CONFLICT(key_id) DO UPDATE SET settings=excluded.settings,updated_at=now();
 RETURN coalesce(_settings,'{}'::jsonb); END $$;