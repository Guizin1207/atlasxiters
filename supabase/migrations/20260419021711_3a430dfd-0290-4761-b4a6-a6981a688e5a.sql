-- ====================================================================
-- ATLAS VIP — FASE 2 (Admin RPCs)
-- ====================================================================

-- Helper: valida senha mestra (lança "unauthorized" se incorreta)
create or replace function public._require_admin(_password text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored text;
begin
  select public._cfg_text('master_password') into stored;
  if stored is null or _password is null or stored <> _password then
    raise exception 'unauthorized';
  end if;
end;
$$;

-- Public: usado pela tela de login admin
create or replace function public._check_admin(_password text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored text;
begin
  select public._cfg_text('master_password') into stored;
  return stored is not null and _password is not null and stored = _password;
end;
$$;

-- Manutenção
create or replace function public.admin_set_maintenance(
  _enabled boolean, _message text, _password text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_admin(_password);
  insert into public.app_config (key, value, updated_at)
  values ('maintenance_enabled', to_jsonb(coalesce(_enabled, false)), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.app_config (key, value, updated_at)
  values ('maintenance_message', to_jsonb(coalesce(_message, '')), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return public.get_maintenance();
end;
$$;

-- Gerador interno de chave aleatória "ATLS-XXXX-XXXX-XXXX"
create or replace function public._gen_key()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  block text;
  out text := 'ATLS';
  i int;
  j int;
begin
  for i in 1..3 loop
    block := '';
    for j in 1..4 loop
      block := block || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    out := out || '-' || block;
  end loop;
  return out;
end;
$$;

-- Gera N chaves
create or replace function public.admin_create_keys(
  _count int, _duration_days int, _note text, _password text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  qtd int := greatest(1, least(coalesce(_count, 1), 100));
  dur int := greatest(1, coalesce(_duration_days, 30));
  i int;
  k text;
  attempts int;
  created jsonb := '[]'::jsonb;
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);

  for i in 1..qtd loop
    attempts := 0;
    loop
      k := public._gen_key();
      attempts := attempts + 1;
      begin
        insert into public.access_keys (key, duration_days, note)
        values (k, dur, nullif(_note, ''))
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
$$;

-- Lista todas as chaves (para o painel admin)
create or replace function public.admin_list_keys(_password text)
returns setof public.access_keys
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._require_admin(_password);
  return query select * from public.access_keys order by created_at desc;
end;
$$;

-- Estatísticas por OS
create or replace function public.admin_device_stats(_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total int;
  android int;
  ios int;
  mac int;
  win int;
  linux int;
  unreg int;
begin
  perform public._require_admin(_password);

  select count(*) into total from public.access_keys;
  select count(*) into android from public.access_keys where lower(coalesce(device, '')) like '%android%';
  select count(*) into ios from public.access_keys where lower(coalesce(device, '')) ~ 'ios|iphone|ipad';
  select count(*) into mac from public.access_keys where lower(coalesce(device, '')) like '%mac%' and lower(coalesce(device, '')) not like '%ios%';
  select count(*) into win from public.access_keys where lower(coalesce(device, '')) like '%windows%';
  select count(*) into linux from public.access_keys where lower(coalesce(device, '')) like '%linux%';
  select count(*) into unreg from public.access_keys where device is null or device = '';

  return jsonb_build_object(
    'total', total,
    'android', android,
    'ios', ios,
    'mac', mac,
    'windows', win,
    'linux', linux,
    'unregistered', unreg
  );
end;
$$;

-- Ativar manualmente uma chave (define activated_at + expires_at)
create or replace function public.admin_activate_key(_id uuid, _password text)
returns public.access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  update public.access_keys
     set activated_at = coalesce(activated_at, now()),
         expires_at = case
           when is_master then null
           when expires_at is not null then expires_at
           else now() + (duration_days || ' days')::interval
         end,
         revoked = false
   where id = _id
   returning * into rec;
  if not found then raise exception 'not_found'; end if;
  return rec;
end;
$$;

-- Estender N dias
create or replace function public.admin_extend_key(_id uuid, _days int, _password text)
returns public.access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  update public.access_keys
     set expires_at = coalesce(expires_at, now()) + (greatest(1, _days) || ' days')::interval
   where id = _id and is_master = false
   returning * into rec;
  if not found then raise exception 'not_found_or_master'; end if;
  return rec;
end;
$$;

-- Definir expiração específica
create or replace function public.admin_set_expiration(_id uuid, _expires_at timestamptz, _password text)
returns public.access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  update public.access_keys
     set expires_at = _expires_at,
         activated_at = coalesce(activated_at, now())
   where id = _id and is_master = false
   returning * into rec;
  if not found then raise exception 'not_found_or_master'; end if;
  return rec;
end;
$$;

-- Resetar dispositivo
create or replace function public.admin_reset_device(_id uuid, _password text)
returns public.access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  update public.access_keys
     set device = null, device_id = null
   where id = _id
   returning * into rec;
  if not found then raise exception 'not_found'; end if;
  return rec;
end;
$$;

-- Revogar / desrevogar
create or replace function public.admin_revoke_key(_id uuid, _password text)
returns public.access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  update public.access_keys set revoked = true
   where id = _id and is_master = false
   returning * into rec;
  if not found then raise exception 'not_found_or_master'; end if;
  return rec;
end;
$$;

create or replace function public.admin_unrevoke_key(_id uuid, _password text)
returns public.access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  update public.access_keys set revoked = false
   where id = _id
   returning * into rec;
  if not found then raise exception 'not_found'; end if;
  return rec;
end;
$$;

-- Apagar (master nunca pode ser apagada)
create or replace function public.admin_delete_key(_id uuid, _password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
begin
  perform public._require_admin(_password);
  delete from public.access_keys where id = _id and is_master = false;
  get diagnostics cnt = row_count;
  if cnt = 0 then raise exception 'not_found_or_master'; end if;
  return true;
end;
$$;

-- Permissões
grant execute on function public._check_admin(text)                                         to anon, authenticated;
grant execute on function public.admin_set_maintenance(boolean, text, text)                 to anon, authenticated;
grant execute on function public.admin_create_keys(int, int, text, text)                    to anon, authenticated;
grant execute on function public.admin_list_keys(text)                                      to anon, authenticated;
grant execute on function public.admin_device_stats(text)                                   to anon, authenticated;
grant execute on function public.admin_activate_key(uuid, text)                             to anon, authenticated;
grant execute on function public.admin_extend_key(uuid, int, text)                          to anon, authenticated;
grant execute on function public.admin_set_expiration(uuid, timestamptz, text)              to anon, authenticated;
grant execute on function public.admin_reset_device(uuid, text)                             to anon, authenticated;
grant execute on function public.admin_revoke_key(uuid, text)                               to anon, authenticated;
grant execute on function public.admin_unrevoke_key(uuid, text)                             to anon, authenticated;
grant execute on function public.admin_delete_key(uuid, text)                               to anon, authenticated;