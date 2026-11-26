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
    SET coins = coins + 25, updated_at = now()
    WHERE key_id = v_key.id;

    UPDATE public.panel_feedbacks
    SET reward_coins = 25, rewarded_at = now(), reward_day = current_date
    WHERE id = v_row.id;

    v_reward := 25;
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

GRANT EXECUTE ON FUNCTION public.submit_panel_feedback(text, integer, text, text) TO anon, authenticated, service_role;