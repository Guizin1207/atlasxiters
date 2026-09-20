create or replace function public.admin_update_key_access(
  _id uuid,
  _plan text,
  _duration_days int,
  _key text,
  _password text
) returns public.access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
  new_plan text := lower(trim(coalesce(_plan, 'basic')));
  new_key text := upper(trim(coalesce(_key, '')));
  days int := greatest(0, coalesce(_duration_days, 30));
begin
  perform public._require_admin(_password);

  if new_plan not in ('demo', 'basic', 'pro', 'master') then
    raise exception 'invalid_plan';
  end if;

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
    duration_days = case
      when new_plan in ('master', 'demo') then 0
      else days
    end,
    is_master = (new_plan = 'master'),
    activated_at = now(),
    expires_at = case
      when new_plan in ('master', 'demo') then null
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
$$;

grant execute on function public.admin_update_key_access(
  uuid,
  text,
  int,
  text,
  text
) to anon, authenticated;