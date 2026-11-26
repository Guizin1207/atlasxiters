CREATE OR REPLACE FUNCTION public.get_download_file()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value jsonb;
  v_updated timestamptz;
BEGIN
  SELECT value, updated_at INTO v_value, v_updated
  FROM public.app_config
  WHERE key = 'injection_download_file';

  RETURN jsonb_build_object(
    'path', COALESCE(v_value->>'path', ''),
    'file_name', COALESCE(v_value->>'file_name', 'atlas-config-test.txt'),
    'file_size', COALESCE((v_value->>'file_size')::bigint, 0),
    'content_type', COALESCE(v_value->>'content_type', 'text/plain'),
    'updated_at', v_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_download_file(
  _password text,
  _path text,
  _file_name text,
  _file_size bigint,
  _content_type text DEFAULT 'text/plain'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_path text := btrim(COALESCE(_path, ''));
  v_name text := btrim(COALESCE(_file_name, ''));
BEGIN
  PERFORM public._require_admin(_password);

  IF v_path !~ '^injection/[a-zA-Z0-9._-]+\.txt$' OR position('..' in v_path) > 0 THEN
    RAISE EXCEPTION 'Caminho de arquivo inválido.';
  END IF;
  IF length(v_name) < 5 OR length(v_name) > 160 OR lower(right(v_name, 4)) <> '.txt' THEN
    RAISE EXCEPTION 'O arquivo deve ter nome TXT válido de até 160 caracteres.';
  END IF;
  IF _file_size IS NULL OR _file_size <= 0 OR _file_size > 10485760 THEN
    RAISE EXCEPTION 'O arquivo TXT deve ter entre 1 byte e 10 MB.';
  END IF;

  INSERT INTO public.app_config (key, value, updated_at)
  VALUES (
    'injection_download_file',
    jsonb_build_object(
      'path', v_path,
      'file_name', v_name,
      'file_size', _file_size,
      'content_type', 'text/plain'
    ),
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

  RETURN public.get_download_file();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_download_file() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_download_file(text, text, text, bigint, text) TO anon, authenticated, service_role;