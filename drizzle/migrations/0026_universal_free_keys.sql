ALTER TABLE public.access_keys
  ADD COLUMN IF NOT EXISTS is_universal boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public._plan_days(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE lower(coalesce(_plan, 'basic'))
    WHEN 'pro' THEN 90
    WHEN 'master' THEN 36500
    WHEN 'demo' THEN 0
    WHEN 'free' THEN 0
    WHEN 'universal' THEN 0
    ELSE 30
  END
$$;

CREATE OR REPLACE FUNCTION public.admin_create_keys(
  _count integer,
  _duration_days integer,
  _note text,
  _password text,
  _plan text DEFAULT 'basic'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  qtd int := greatest(1, least(coalesce(_count, 1), 100));
  raw_pl text := lower(coalesce(nullif(trim(_plan), ''), 'basic'));
  is_univ boolean := raw_pl in ('free', 'universal');
  pl text := case when raw_pl in ('free', 'universal') then 'free' else raw_pl end;
  dur int;
  i int;
  k text;
  attempts int;
  created jsonb := '[]'::jsonb;
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  if pl not in ('free', 'demo', 'basic', 'pro', 'master', 'bronze', 'esmeralda', 'rubi', 'atlas') then
    pl := 'basic';
  end if;
  dur := case
    when pl in ('demo', 'free') then greatest(0, coalesce(_duration_days, 0))
    else greatest(1, coalesce(nullif(_duration_days, 0), public._plan_days(pl)))
  end;

  for i in 1..qtd loop
    attempts := 0;
    loop
      k := public._gen_key();
      attempts := attempts + 1;
      begin
        insert into public.access_keys (key, duration_days, note, plan, is_universal, expires_at)
        values (
          k,
          dur,
          nullif(_note, ''),
          pl,
          is_univ,
          case when is_univ and dur > 0 then now() + (dur || ' days')::interval else null end
        )
        returning * into rec;
        exit;
      exception when unique_violation then
        if attempts > 5 then raise; end if;
      end;
    end loop;
    created := created || to_jsonb(rec);
  end loop;

  return created;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_plan(
  _password text,
  _id uuid,
  _plan text,
  _apply_duration boolean DEFAULT true
)
RETURNS access_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  rec public.access_keys%rowtype;
  raw_pl text := lower(coalesce(_plan, 'basic'));
  is_univ boolean := raw_pl in ('free', 'universal');
  pl text := case when raw_pl in ('free', 'universal') then 'free' else raw_pl end;
  d int;
begin
  perform public._require_admin(_password);
  if pl not in ('free', 'demo', 'basic', 'pro', 'master', 'bronze', 'esmeralda', 'rubi', 'atlas') then
    raise exception 'invalid_plan';
  end if;
  d := public._plan_days(pl);

  update public.access_keys
     set plan = pl,
         is_universal = is_univ,
         device_id = case when is_univ then null else device_id end,
         user_id = case when is_univ then null else user_id end,
         duration_days = case when _apply_duration then d else duration_days end,
         expires_at = case
           when not _apply_duration then expires_at
           when pl in ('master', 'demo', 'free') then null
           when activated_at is not null then now() + (d || ' days')::interval
           else null
         end
   where id = _id
   returning * into rec;

  if not found then raise exception 'not_found'; end if;
  return rec;
end;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_key(_key text, _device text, _device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  rec public.access_keys%rowtype;
  k text := upper(trim(_key));
begin
  if k is null or k = '' then raise exception 'invalid_key'; end if;
  select * into rec from public.access_keys where key = k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;

  if rec.is_master then
    update public.access_keys set device = coalesce(_device, device), device_id = coalesce(_device_id, device_id),
           activated_at = coalesce(activated_at, now()) where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  if rec.is_universal then
    if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;
    update public.access_keys
       set activated_at = coalesce(activated_at, now()),
           device = coalesce(device, 'Universal')
     where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  if rec.user_id is not null and auth.uid() is distinct from rec.user_id then
    raise exception 'account_mismatch';
  end if;

  if rec.device_id is null and rec.device is not null and rec.activated_at is null
     and lower(rec.device) <> lower(coalesce(_device, '')) then
    raise exception 'device_mismatch';
  end if;

  if rec.activated_at is not null then
    if rec.device_id is not null and rec.device_id <> _device_id then raise exception 'device_mismatch'; end if;
    if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;
    update public.access_keys set device = coalesce(_device, device), device_id = coalesce(rec.device_id, _device_id),
           user_id = coalesce(user_id, auth.uid())
     where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  update public.access_keys
     set device = _device, device_id = _device_id, activated_at = now(), user_id = coalesce(user_id, auth.uid()),
         expires_at = case when lower(rec.plan) = 'demo' then null else now() + (rec.duration_days || ' days')::interval end
   where id = rec.id returning * into rec;
  return to_jsonb(rec);
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_key(_key text, _device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  rec public.access_keys%rowtype;
  k text := upper(trim(_key));
begin
  select * into rec from public.access_keys where key = k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;
  if rec.is_master then return to_jsonb(rec); end if;
  if rec.is_universal then
    if rec.expires_at is not null and rec.expires_at < now() then
      raise exception 'expired_key';
    end if;
    return to_jsonb(rec);
  end if;
  if rec.device_id is not null and rec.device_id <> _device_id then
    raise exception 'device_mismatch';
  end if;
  if rec.expires_at is not null and rec.expires_at < now() then
    raise exception 'expired_key';
  end if;
  return to_jsonb(rec);
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_user_key(_username text, _key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare rec public.access_keys%rowtype; owner_name text;
begin
  select * into rec from public.access_keys where key = upper(trim(_key));
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;
  if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;
  if rec.is_universal then return true; end if;
  if rec.user_id is null then raise exception 'key_not_linked'; end if;
  select full_name into owner_name from public.profiles where id = rec.user_id;
  if owner_name is null or lower(trim(owner_name)) <> lower(trim(_username)) then
    raise exception 'key_already_linked';
  end if;
  return true;
end;
$function$;

INSERT INTO public.access_keys (key, duration_days, note, plan, is_universal, device)
VALUES ('ATLAS-FREE-2026', 0, 'Key Universal Free (todos podem usar)', 'free', true, 'Universal')
ON CONFLICT (key) DO NOTHING;