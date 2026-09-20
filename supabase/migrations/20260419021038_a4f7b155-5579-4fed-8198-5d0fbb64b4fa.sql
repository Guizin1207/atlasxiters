-- ATLAS VIP — FASE 1
create table if not exists public.access_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  duration_days integer not null default 30,
  device text,
  device_id text,
  activated_at timestamptz,
  expires_at timestamptz,
  note text,
  is_master boolean not null default false,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists access_keys_key_idx on public.access_keys (key);
create index if not exists access_keys_device_id_idx on public.access_keys (device_id);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.key_settings (
  key_id uuid primary key references public.access_keys(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.access_keys  enable row level security;
alter table public.app_config   enable row level security;
alter table public.key_settings enable row level security;

insert into public.app_config (key, value) values
  -- senha real definida manualmente fora do repositorio
  ('master_password', to_jsonb('TROCAR-ME'::text)),
  ('maintenance_enabled', to_jsonb(false)),
  ('maintenance_message', to_jsonb('Estamos em manutenção. Volte em instantes.'::text))
on conflict (key) do nothing;

insert into public.access_keys (key, duration_days, note, is_master)
values ('ATLS-TROCAR-ME-0001', 36500, 'Chave mestra inicial', true)
on conflict (key) do nothing;

create or replace function public._cfg_text(_k text)
returns text language sql stable security definer set search_path = public as $$
  select value #>> '{}' from public.app_config where key = _k
$$;

create or replace function public._cfg_bool(_k text)
returns boolean language sql stable security definer set search_path = public as $$
  select (value)::text::boolean from public.app_config where key = _k
$$;

create or replace function public.get_maintenance()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', coalesce(public._cfg_bool('maintenance_enabled'), false),
    'message', coalesce(public._cfg_text('maintenance_message'), '')
  )
$$;

create or replace function public.is_master_key(_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.access_keys
    where key = upper(_key) and is_master = true and revoked = false
  )
$$;

create or replace function public.redeem_key(_key text, _device text, _device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec public.access_keys%rowtype;
  k text := upper(trim(_key));
begin
  if k is null or k = '' then raise exception 'invalid_key'; end if;
  select * into rec from public.access_keys where key = k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;

  if rec.is_master then
    update public.access_keys
       set device = coalesce(_device, device),
           device_id = coalesce(_device_id, device_id),
           activated_at = coalesce(activated_at, now())
     where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  if rec.activated_at is not null then
    if rec.device_id is not null and rec.device_id <> _device_id then
      raise exception 'device_mismatch';
    end if;
    if rec.expires_at is not null and rec.expires_at < now() then
      raise exception 'expired_key';
    end if;
    update public.access_keys
       set device = coalesce(_device, device),
           device_id = coalesce(rec.device_id, _device_id)
     where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  update public.access_keys
     set device = _device,
         device_id = _device_id,
         activated_at = now(),
         expires_at = now() + (rec.duration_days || ' days')::interval
   where id = rec.id returning * into rec;
  return to_jsonb(rec);
end;
$$;

create or replace function public.validate_key(_key text, _device_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec public.access_keys%rowtype;
  k text := upper(trim(_key));
begin
  select * into rec from public.access_keys where key = k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;
  if rec.is_master then return to_jsonb(rec); end if;
  if rec.device_id is not null and rec.device_id <> _device_id then
    raise exception 'device_mismatch';
  end if;
  if rec.expires_at is not null and rec.expires_at < now() then
    raise exception 'expired_key';
  end if;
  return to_jsonb(rec);
end;
$$;

create or replace function public.get_settings(_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  kid uuid;
  s jsonb;
begin
  select id into kid from public.access_keys where key = upper(trim(_key));
  if kid is null then return '{}'::jsonb; end if;
  select settings into s from public.key_settings where key_id = kid;
  return coalesce(s, '{}'::jsonb);
end;
$$;

create or replace function public.save_settings(_key text, _settings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  kid uuid;
begin
  select id into kid from public.access_keys where key = upper(trim(_key));
  if kid is null then raise exception 'invalid_key'; end if;
  insert into public.key_settings (key_id, settings, updated_at)
  values (kid, coalesce(_settings, '{}'::jsonb), now())
  on conflict (key_id) do update
    set settings = excluded.settings, updated_at = now();
  return coalesce(_settings, '{}'::jsonb);
end;
$$;

grant execute on function public.get_maintenance()                           to anon, authenticated;
grant execute on function public.is_master_key(text)                         to anon, authenticated;
grant execute on function public.redeem_key(text, text, text)                to anon, authenticated;
grant execute on function public.validate_key(text, text)                    to anon, authenticated;
grant execute on function public.get_settings(text)                          to anon, authenticated;
grant execute on function public.save_settings(text, jsonb)                  to anon, authenticated;