ALTER TABLE public.panel_feedbacks
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS admin_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS reward_coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reward_day date;

CREATE UNIQUE INDEX IF NOT EXISTS panel_feedbacks_daily_reward_idx
  ON public.panel_feedbacks (key_id, reward_day)
  WHERE reward_day IS NOT NULL;

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
          'admin_reply', f.admin_reply,
          'admin_reply_at', f.admin_reply_at,
          'reward_coins', f.reward_coins,
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
    SELECT id, author_name, rating, comment, admin_reply, admin_reply_at, reward_coins, created_at
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
  v_reward integer := 0;
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

  BEGIN
    INSERT INTO public.key_rewards (key_id) VALUES (v_key.id)
    ON CONFLICT (key_id) DO NOTHING;

    UPDATE public.key_rewards
    SET coins = coins + 10, updated_at = now()
    WHERE key_id = v_key.id;

    UPDATE public.panel_feedbacks
    SET reward_coins = 10, rewarded_at = now(), reward_day = current_date
    WHERE id = v_row.id;

    v_reward := 10;
  EXCEPTION WHEN unique_violation THEN
    v_reward := 0;
  END;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'author_name', v_row.author_name,
    'rating', v_row.rating,
    'comment', v_row.comment,
    'reward_coins', v_reward,
    'rewarded', v_reward > 0,
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
          'admin_reply', f.admin_reply,
          'admin_reply_at', f.admin_reply_at,
          'reward_coins', f.reward_coins,
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

CREATE OR REPLACE FUNCTION public.admin_reply_panel_feedback(
  _password text,
  _id uuid,
  _reply text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reply text := btrim(COALESCE(_reply, ''));
  v_row public.panel_feedbacks%ROWTYPE;
BEGIN
  PERFORM public._require_admin(_password);

  IF length(v_reply) < 2 OR length(v_reply) > 1000 THEN
    RAISE EXCEPTION 'A resposta deve ter entre 2 e 1000 caracteres.';
  END IF;

  UPDATE public.panel_feedbacks
  SET admin_reply = v_reply, admin_reply_at = now()
  WHERE id = _id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback não encontrado.';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'admin_reply', v_row.admin_reply,
    'admin_reply_at', v_row.admin_reply_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_panel_feedbacks(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_panel_feedback(text, integer, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_panel_feedbacks(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reply_panel_feedback(text, uuid, text) TO anon, authenticated, service_role;