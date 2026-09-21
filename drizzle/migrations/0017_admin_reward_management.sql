-- Configuração global da recompensa (armazenada em app_config, sem tabela nova)
CREATE OR REPLACE FUNCTION public._reward_cfg()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'daily_amount', coalesce((select (value #>> '{}')::int from public.app_config where key = 'reward_daily_amount'), 10),
    'max_coins',    coalesce((select (value #>> '{}')::int from public.app_config where key = 'reward_max_coins'), 100),
    'redeem_cost',  coalesce((select (value #>> '{}')::int from public.app_config where key = 'reward_redeem_cost'), 100),
    'redeem_days',  coalesce((select (value #>> '{}')::int from public.app_config where key = 'reward_redeem_days'), 30)
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_reward_config(_password text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin(_password);
  RETURN public._reward_cfg();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reward_set_config(_password text, _daily_amount integer, _max_coins integer, _redeem_cost integer, _redeem_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d int; m int; c int; r int;
BEGIN
  PERFORM public._require_admin(_password);
  d := greatest(1, least(coalesce(_daily_amount, 10), 10000));
  m := greatest(1, least(coalesce(_max_coins, 100), 1000000));
  c := greatest(1, least(coalesce(_redeem_cost, 100), 1000000));
  r := greatest(1, least(coalesce(_redeem_days, 30), 3650));
  INSERT INTO public.app_config(key, value, updated_at) VALUES
    ('reward_daily_amount', to_jsonb(d), now()),
    ('reward_max_coins', to_jsonb(m), now()),
    ('reward_redeem_cost', to_jsonb(c), now()),
    ('reward_redeem_days', to_jsonb(r), now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  RETURN public._reward_cfg();
END;
$$;

-- Estado da recompensa passa a respeitar a configuração
CREATE OR REPLACE FUNCTION public._reward_state(_key_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.key_rewards%rowtype; _claims jsonb; cfg jsonb;
BEGIN
  cfg := public._reward_cfg();
  INSERT INTO public.key_rewards (key_id) VALUES (_key_id) ON CONFLICT (key_id) DO NOTHING;
  SELECT * INTO r FROM public.key_rewards WHERE key_id = _key_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'day', extract(day FROM c.claimed_on)::int,
    'date', c.claimed_on,
    'coins', c.coins
  ) ORDER BY c.claimed_on), '[]'::jsonb)
  INTO _claims
  FROM public.reward_claims c
  WHERE c.key_id = _key_id
    AND date_trunc('month', c.claimed_on) = date_trunc('month', current_date);

  RETURN jsonb_build_object(
    'ok', true,
    'coins', r.coins,
    'daily_amount', (cfg->>'daily_amount')::int,
    'goal', (cfg->>'redeem_cost')::int,
    'max_coins', (cfg->>'max_coins')::int,
    'redeem_days', (cfg->>'redeem_days')::int,
    'last_daily_claim', r.last_daily_claim,
    'last_claim', r.last_daily_claim,
    'total_claims', r.total_claims,
    'current_streak', r.current_streak,
    'best_streak', r.best_streak,
    'claimed_today', r.last_daily_claim = current_date,
    'claims', _claims
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_reward(_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; r public.key_rewards%rowtype; _streak integer; cfg jsonb; amount int; cap int;
BEGIN
  _id := public._reward_key_id(_key);
  IF _id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key'); END IF;
  cfg := public._reward_cfg();
  amount := (cfg->>'daily_amount')::int;
  cap := (cfg->>'max_coins')::int;

  INSERT INTO public.key_rewards (key_id) VALUES (_id) ON CONFLICT (key_id) DO NOTHING;
  SELECT * INTO r FROM public.key_rewards WHERE key_id = _id FOR UPDATE;

  IF r.last_daily_claim = current_date THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  _streak := CASE WHEN r.last_daily_claim = current_date - 1 THEN r.current_streak + 1 ELSE 1 END;

  UPDATE public.key_rewards SET
    coins = least(coins + amount, cap),
    last_daily_claim = current_date,
    total_claims = total_claims + 1,
    current_streak = _streak,
    best_streak = greatest(best_streak, _streak),
    updated_at = now()
  WHERE key_id = _id;

  INSERT INTO public.reward_claims (key_id, claimed_on, coins)
  VALUES (_id, current_date, amount)
  ON CONFLICT (key_id, claimed_on) DO NOTHING;

  RETURN public._reward_state(_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_atlas_coins(_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; r public.key_rewards%rowtype; _expires timestamptz; cfg jsonb; cost int; days int;
BEGIN
  _id := public._reward_key_id(_key);
  IF _id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key'); END IF;
  cfg := public._reward_cfg();
  cost := (cfg->>'redeem_cost')::int;
  days := (cfg->>'redeem_days')::int;

  INSERT INTO public.key_rewards (key_id) VALUES (_id) ON CONFLICT (key_id) DO NOTHING;
  SELECT * INTO r FROM public.key_rewards WHERE key_id = _id FOR UPDATE;

  IF r.coins < cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_coins', 'coins', r.coins);
  END IF;

  UPDATE public.access_keys SET
    expires_at = greatest(coalesce(expires_at, now()), now()) + (days || ' days')::interval
  WHERE id = _id
  RETURNING expires_at INTO _expires;

  UPDATE public.key_rewards SET coins = coins - cost, updated_at = now() WHERE key_id = _id;
  DELETE FROM public.key_expiry_notices WHERE key_id = _id;

  RETURN jsonb_build_object('ok', true, 'reward_days', days, 'expires_at', _expires, 'reward', public._reward_state(_id));
END;
$$;

-- Controle por key no painel ADM
CREATE OR REPLACE FUNCTION public.admin_reward_list(_password text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._require_admin(_password);
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.key), '[]'::jsonb) INTO result
  FROM (
    SELECT k.id AS key_id, k.key, coalesce(r.coins, 0) AS coins,
           r.last_daily_claim, coalesce(r.total_claims, 0) AS total_claims,
           coalesce(r.current_streak, 0) AS current_streak,
           coalesce(r.best_streak, 0) AS best_streak,
           (r.last_daily_claim = current_date) AS claimed_today,
           k.expires_at, k.revoked
    FROM public.access_keys k
    LEFT JOIN public.key_rewards r ON r.key_id = k.id
    WHERE k.is_master = false
  ) t;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reward_set_coins(_password text, _key_id uuid, _coins integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin(_password);
  INSERT INTO public.key_rewards (key_id) VALUES (_key_id) ON CONFLICT (key_id) DO NOTHING;
  UPDATE public.key_rewards SET coins = greatest(0, coalesce(_coins, 0)), updated_at = now() WHERE key_id = _key_id;
  RETURN public._reward_state(_key_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reward_add_coins(_password text, _key_id uuid, _amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin(_password);
  INSERT INTO public.key_rewards (key_id) VALUES (_key_id) ON CONFLICT (key_id) DO NOTHING;
  UPDATE public.key_rewards SET coins = greatest(0, coins + coalesce(_amount, 0)), updated_at = now() WHERE key_id = _key_id;
  RETURN public._reward_state(_key_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reward_set_streak(_password text, _key_id uuid, _streak integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s int;
BEGIN
  PERFORM public._require_admin(_password);
  s := greatest(0, coalesce(_streak, 0));
  INSERT INTO public.key_rewards (key_id) VALUES (_key_id) ON CONFLICT (key_id) DO NOTHING;
  UPDATE public.key_rewards SET current_streak = s, best_streak = greatest(best_streak, s), updated_at = now() WHERE key_id = _key_id;
  RETURN public._reward_state(_key_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reward_clear_claims(_password text, _key_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin(_password);
  DELETE FROM public.reward_claims WHERE key_id = _key_id;
  UPDATE public.key_rewards SET total_claims = 0, current_streak = 0, updated_at = now() WHERE key_id = _key_id;
  RETURN public._reward_state(_key_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reward_reset(_password text, _key_id uuid, _clear_history boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin(_password);
  INSERT INTO public.key_rewards (key_id) VALUES (_key_id) ON CONFLICT (key_id) DO NOTHING;
  UPDATE public.key_rewards SET last_daily_claim = NULL, current_streak = 0, updated_at = now() WHERE key_id = _key_id;
  IF coalesce(_clear_history, false) THEN
    DELETE FROM public.reward_claims WHERE key_id = _key_id;
    UPDATE public.key_rewards SET total_claims = 0, coins = 0, best_streak = 0, updated_at = now() WHERE key_id = _key_id;
  END IF;
  RETURN public._reward_state(_key_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reward_config(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reward_set_config(text, integer, integer, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reward_list(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reward_set_coins(text, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reward_add_coins(text, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reward_set_streak(text, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reward_clear_claims(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reward_reset(text, uuid, boolean) TO anon, authenticated;