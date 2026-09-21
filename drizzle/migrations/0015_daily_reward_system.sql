CREATE TABLE IF NOT EXISTS public.key_rewards (
  key_id uuid PRIMARY KEY REFERENCES public.access_keys(id) ON DELETE CASCADE,
  coins integer NOT NULL DEFAULT 0,
  last_daily_claim date,
  total_claims integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_claims (
  key_id uuid NOT NULL REFERENCES public.access_keys(id) ON DELETE CASCADE,
  claimed_on date NOT NULL,
  coins integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key_id, claimed_on)
);

GRANT ALL ON public.key_rewards TO service_role;
GRANT ALL ON public.reward_claims TO service_role;

ALTER TABLE public.key_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._reward_key_id(_key text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM public.access_keys
  WHERE key = upper(trim(coalesce(_key, '')))
    AND revoked = false
    AND is_master = false
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public._reward_state(_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.key_rewards%rowtype; _claims jsonb;
BEGIN
  INSERT INTO public.key_rewards (key_id) VALUES (_key_id)
  ON CONFLICT (key_id) DO NOTHING;
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
    'daily_amount', 10,
    'goal', 100,
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

CREATE OR REPLACE FUNCTION public.get_daily_reward(_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  _id := public._reward_key_id(_key);
  IF _id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key');
  END IF;
  RETURN public._reward_state(_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_reward(_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid; r public.key_rewards%rowtype; _streak integer;
BEGIN
  _id := public._reward_key_id(_key);
  IF _id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key');
  END IF;

  INSERT INTO public.key_rewards (key_id) VALUES (_id) ON CONFLICT (key_id) DO NOTHING;
  SELECT * INTO r FROM public.key_rewards WHERE key_id = _id FOR UPDATE;

  IF r.last_daily_claim = current_date THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  _streak := CASE WHEN r.last_daily_claim = current_date - 1 THEN r.current_streak + 1 ELSE 1 END;

  UPDATE public.key_rewards SET
    coins = coins + 10,
    last_daily_claim = current_date,
    total_claims = total_claims + 1,
    current_streak = _streak,
    best_streak = greatest(best_streak, _streak),
    updated_at = now()
  WHERE key_id = _id;

  INSERT INTO public.reward_claims (key_id, claimed_on, coins)
  VALUES (_id, current_date, 10)
  ON CONFLICT (key_id, claimed_on) DO NOTHING;

  RETURN public._reward_state(_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_atlas_coins(_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid; r public.key_rewards%rowtype; _expires timestamptz;
BEGIN
  _id := public._reward_key_id(_key);
  IF _id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_key');
  END IF;

  INSERT INTO public.key_rewards (key_id) VALUES (_id) ON CONFLICT (key_id) DO NOTHING;
  SELECT * INTO r FROM public.key_rewards WHERE key_id = _id FOR UPDATE;

  IF r.coins < 100 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_coins', 'coins', r.coins);
  END IF;

  UPDATE public.access_keys SET
    expires_at = greatest(coalesce(expires_at, now()), now()) + interval '30 days'
  WHERE id = _id
  RETURNING expires_at INTO _expires;

  UPDATE public.key_rewards SET coins = coins - 100, updated_at = now() WHERE key_id = _id;

  DELETE FROM public.key_expiry_notices WHERE key_id = _id;

  RETURN jsonb_build_object(
    'ok', true,
    'reward_days', 30,
    'expires_at', _expires,
    'reward', public._reward_state(_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_reward(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_atlas_coins(text) TO anon, authenticated;