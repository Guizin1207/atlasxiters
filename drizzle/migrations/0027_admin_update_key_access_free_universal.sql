CREATE OR REPLACE FUNCTION public.admin_update_key_access(
  _id uuid,
  _plan text,
  _duration_days integer,
  _key text,
  _password text
)
RETURNS public.access_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  rec public.access_keys%rowtype;
  new_plan text := lower(trim(coalesce(_plan, 'basic')));
  new_key text := upper(trim(coalesce(_key, '')));
  days int := greatest(0, coalesce(_duration_days, 30));
  universal_flag boolean := false;
begin
  perform public._require_admin(_password);

  if new_plan = 'universal' then
    new_plan := 'free';
  end if;

  if new_plan not in ('free', 'demo', 'basic', 'pro', 'master') then
    raise exception 'invalid_plan';
  end if;

  universal_flag := (new_plan = 'free');

  if new_key = '' then
    raise exception 'invalid_key';
  end if;

  if exists (
    select 1
    from public.access_keys
    where key = new_key
      and id <> _id
  ) then
    raise exception 'key_already_exists';
  end if;

  update public.access_keys
  set
    key = new_key,
    plan = new_plan,
    is_universal = universal_flag,
    duration_days = case
      when new_plan in ('master', 'demo') then 0
      when universal_flag and days = 0 then 0
      else days
    end,
    is_master = (new_plan = 'master'),
    device = case when universal_flag then 'Universal' else device end,
    device_id = case when universal_flag then null else device_id end,
    user_id = case when universal_flag then null else user_id end,
    activated_at = now(),
    expires_at = case
      when new_plan in ('master', 'demo') then null
      when universal_flag and days = 0 then null
      else now() + (days || ' days')::interval
    end,
    revoked = false
  where id = _id
  returning * into rec;

  if not found then
    raise exception 'not_found';
  end if;

  return rec;
exception
  when unique_violation then
    raise exception 'key_already_exists';
end;
$function$;