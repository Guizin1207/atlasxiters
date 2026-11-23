CREATE OR REPLACE FUNCTION public.notify_key_revocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE notice_id uuid;
BEGIN
  IF NEW.revoked AND NOT OLD.revoked AND NOT NEW.is_master THEN
    INSERT INTO public.admin_messages (title, body, target_key_id)
    VALUES ('Chave revogada', 'Sua chave foi revogada e sua conta foi desconectada. Fale com o suporte.', NEW.id)
    RETURNING id INTO notice_id;
    PERFORM net.http_post(
      url := 'https://soadsghfbmogayootqwl.supabase.co/functions/v1/notify-admin',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('kind', 'revoked', 'eventId', notice_id)
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_key_revocation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER access_key_revocation_notice
AFTER UPDATE OF revoked ON public.access_keys
FOR EACH ROW WHEN (NEW.revoked = true AND OLD.revoked = false)
EXECUTE FUNCTION public.notify_key_revocation();