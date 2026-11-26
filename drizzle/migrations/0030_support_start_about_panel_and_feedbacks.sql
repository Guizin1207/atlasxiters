-- 1. ADM iniciar conversa no suporte com qualquer key/usuário
CREATE OR REPLACE FUNCTION public.admin_support_start_chat(
  _password text,
  _key_id uuid,
  _body text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key record;
  v_thread_id uuid;
  v_msg_id uuid;
  v_clean_body text := btrim(COALESCE(_body, ''));
BEGIN
  PERFORM public._require_admin(_password);

  SELECT id, key INTO v_key
  FROM public.access_keys
  WHERE id = _key_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chave não encontrada.';
  END IF;

  SELECT id INTO v_thread_id
  FROM public.support_threads
  WHERE key_id = _key_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_thread_id IS NULL THEN
    INSERT INTO public.support_threads (key_id)
    VALUES (_key_id)
    RETURNING id INTO v_thread_id;
  ELSE
    UPDATE public.support_threads
    SET updated_at = now(), closed_at = NULL
    WHERE id = v_thread_id;
  END IF;

  IF v_clean_body <> '' THEN
    INSERT INTO public.support_messages (thread_id, sender_type, body)
    VALUES (v_thread_id, 'admin', left(v_clean_body, 1000))
    RETURNING id INTO v_msg_id;

    UPDATE public.support_threads
    SET updated_at = now()
    WHERE id = v_thread_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_thread_id,
    'key_id', v_key.id,
    'key', v_key.key,
    'updated_at', now(),
    'message_id', v_msg_id
  );
END;
$$;

-- 2. Configuração "Sobre o Painel" em app_config
CREATE OR REPLACE FUNCTION public.get_about_panel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val jsonb;
  v_updated timestamptz;
BEGIN
  SELECT value, updated_at INTO v_val, v_updated
  FROM public.app_config
  WHERE key = 'about_panel';

  RETURN jsonb_build_object(
    'bio', COALESCE(v_val->>'bio', 'Atlas VIP — Painel de desempenho e configuração para Free Fire.'),
    'description', COALESCE(v_val->>'description', ''),
    'video_type', COALESCE(v_val->>'video_type', 'none'),
    'youtube_url', COALESCE(v_val->>'youtube_url', ''),
    'gallery_video_path', COALESCE(v_val->>'gallery_video_path', ''),
    'gallery_video_name', COALESCE(v_val->>'gallery_video_name', ''),
    'updated_at', v_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_about_panel(
  _password text,
  _bio text,
  _description text,
  _video_type text,
  _youtube_url text DEFAULT '',
  _gallery_video_path text DEFAULT '',
  _gallery_video_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(btrim(COALESCE(_video_type, 'none')));
  v_payload jsonb;
BEGIN
  PERFORM public._require_admin(_password);

  IF v_type NOT IN ('none', 'youtube', 'gallery') THEN
    RAISE EXCEPTION 'Tipo de vídeo inválido.';
  END IF;

  v_payload := jsonb_build_object(
    'bio', left(btrim(COALESCE(_bio, '')), 240),
    'description', left(btrim(COALESCE(_description, '')), 3000),
    'video_type', v_type,
    'youtube_url', left(btrim(COALESCE(_youtube_url, '')), 500),
    'gallery_video_path', left(btrim(COALESCE(_gallery_video_path, '')), 500),
    'gallery_video_name', left(btrim(COALESCE(_gallery_video_name, '')), 200)
  );

  INSERT INTO public.app_config (key, value, updated_at)
  VALUES ('about_panel', v_payload, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

  RETURN public.get_about_panel();
END;
$$;

-- 3. Tabela de feedbacks do aplicativo
CREATE TABLE IF NOT EXISTS public.panel_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid REFERENCES public.access_keys(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.panel_feedbacks TO service_role;

ALTER TABLE public.panel_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS panel_feedbacks_created_at_idx
  ON public.panel_feedbacks (created_at DESC);

-- 4. RPCs de feedbacks (usuário e ADM)
CREATE OR REPLACE FUNCTION public.list_panel_feedbacks(_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_total integer;
  v_avg numeric;
BEGIN
  IF NOT public._valid_access_key(_key) THEN
    RAISE EXCEPTION 'Chave inválida ou expirada.';
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'author_name', f.author_name,
          'rating', f.rating,
          'comment', f.comment,
          'created_at', f.created_at
        )
        ORDER BY f.created_at DESC
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    COALESCE(round(avg(f.rating)::numeric, 1), 0)
  INTO v_items, v_total, v_avg
  FROM (
    SELECT id, author_name, rating, comment, created_at
    FROM public.panel_feedbacks
    ORDER BY created_at DESC
    LIMIT 60
  ) f;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'average', v_avg
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_panel_feedback(
  _key text,
  _rating integer,
  _comment text,
  _author_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key record;
  v_profile_name text;
  v_author text;
  v_comment text := btrim(COALESCE(_comment, ''));
  v_row public.panel_feedbacks%ROWTYPE;
BEGIN
  IF NOT public._valid_access_key(_key) THEN
    RAISE EXCEPTION 'Chave inválida ou expirada.';
  END IF;

  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Avaliação deve ser entre 1 e 5.';
  END IF;

  IF length(v_comment) < 3 OR length(v_comment) > 500 THEN
    RAISE EXCEPTION 'O comentário deve ter entre 3 e 500 caracteres.';
  END IF;

  SELECT id, user_id INTO v_key
  FROM public.access_keys
  WHERE upper(key) = upper(btrim(_key))
  LIMIT 1;

  IF v_key.user_id IS NOT NULL THEN
    SELECT full_name INTO v_profile_name
    FROM public.profiles
    WHERE id = v_key.user_id;
  END IF;

  v_author := left(
    COALESCE(
      NULLIF(btrim(COALESCE(_author_name, '')), ''),
      NULLIF(btrim(COALESCE(v_profile_name, '')), ''),
      'Usuário Atlas'
    ),
    40
  );

  INSERT INTO public.panel_feedbacks (key_id, author_name, rating, comment)
  VALUES (v_key.id, v_author, _rating, v_comment)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'author_name', v_row.author_name,
    'rating', v_row.rating,
    'comment', v_row.comment,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_panel_feedbacks(_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_admin(_password);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'key_id', f.key_id,
          'key', k.key,
          'author_name', f.author_name,
          'rating', f.rating,
          'comment', f.comment,
          'created_at', f.created_at
        )
        ORDER BY f.created_at DESC
      )
      FROM public.panel_feedbacks f
      LEFT JOIN public.access_keys k ON k.id = f.key_id
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_panel_feedback(_password text, _id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_admin(_password);
  DELETE FROM public.panel_feedbacks WHERE id = _id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_support_start_chat(text, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_about_panel() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_about_panel(text, text, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_panel_feedbacks(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_panel_feedback(text, integer, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_panel_feedbacks(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_panel_feedback(text, uuid) TO anon, authenticated, service_role;
