create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  key_hint text,
  key_hash text,
  device_id text,
  device text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists security_events_created_at_idx
  on public.security_events (created_at desc);

alter table public.security_events enable row level security;

create or replace function public.record_security_event(
  _key text,
  _device_id text,
  _device text,
  _reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
  normalized_key text := upper(btrim(coalesce(_key, '')));
  recent_count integer;
begin
  if _reason not in ('invalid_key', 'revoked_key', 'device_mismatch') then
    raise exception 'invalid_security_reason';
  end if;

  select count(*) into recent_count
  from public.security_events
  where coalesce(device_id, '') = coalesce(_device_id, '')
    and created_at > now() - interval '10 minutes';

  if recent_count >= 20 then
    return null;
  end if;

  insert into public.security_events (reason, key_hint, key_hash, device_id, device)
  values (
    _reason,
    case when length(normalized_key) >= 4 then right(normalized_key, 4) else normalized_key end,
    case when normalized_key <> '' then md5(normalized_key) else null end,
    nullif(_device_id, ''),
    nullif(_device, '')
  )
  returning id into event_id;

  return event_id;
end;
$$;

create or replace function public.admin_list_security_events(
  _password text
) returns table (
  id uuid,
  reason text,
  key_hint text,
  device_id text,
  device text,
  created_at timestamptz,
  notified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_admin(_password);
  return query
    select e.id, e.reason, e.key_hint, e.device_id, e.device, e.created_at, e.notified_at
    from public.security_events e
    order by e.created_at desc
    limit 100;
end;
$$;

create or replace function public.mark_security_event_notified(
  _event_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.security_events
  set notified_at = coalesce(notified_at, now())
  where id = _event_id
    and notified_at is null
    and created_at > now() - interval '24 hours';
  return found;
end;
$$;

grant execute on function public.record_security_event(text, text, text, text) to anon, authenticated;
grant execute on function public.admin_list_security_events(text) to anon, authenticated;
grant execute on function public.mark_security_event_notified(uuid) to anon, authenticated;