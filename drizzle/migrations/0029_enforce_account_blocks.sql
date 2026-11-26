CREATE OR REPLACE FUNCTION public.admin_set_account_block(_password text,_user_id uuid,_blocked boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[];
BEGIN
 PERFORM public._require_admin(_password);
 IF _blocked IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
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
 UPDATE public.account_blocks SET blocked=false,restore_key_ids='{}',updated_at=now() WHERE user_id=_user_id;
 UPDATE public.access_keys SET revoked=false WHERE user_id=_user_id AND id=ANY(ids) AND NOT is_master;
 END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.enforce_account_key_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.account_blocks WHERE user_id=NEW.user_id AND blocked) THEN
 IF NEW.is_master THEN RAISE EXCEPTION 'protected_account'; END IF;
 NEW.revoked:=true;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_account_key_block() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_account_key_block BEFORE INSERT OR UPDATE OF user_id,revoked,is_master ON public.access_keys FOR EACH ROW EXECUTE FUNCTION public.enforce_account_key_block();
CREATE OR REPLACE FUNCTION public.admin_revoke_key(_id uuid,_password text) RETURNS public.access_keys LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rec public.access_keys%rowtype; BEGIN
 PERFORM public._require_admin(_password);
 UPDATE public.access_keys SET revoked=true WHERE id=_id AND is_master=false RETURNING * INTO rec;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_master'; END IF;
 UPDATE public.account_blocks SET restore_key_ids=array_remove(restore_key_ids,_id),updated_at=now() WHERE user_id=rec.user_id AND blocked;
 RETURN rec;
END $$;