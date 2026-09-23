-- Atlas: contas de usuário + vínculo de licença
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do update set full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end, updated_at = now();
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.access_keys add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists access_keys_user_id_idx on public.access_keys(user_id);

create or replace function public.redeem_key(_key text, _device text, _device_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare rec public.access_keys%rowtype; k text := upper(trim(_key)); uid uuid := auth.uid();
begin
  if uid is null then raise exception 'login_required'; end if;
  if k is null or k = '' then raise exception 'invalid_key'; end if;
  select * into rec from public.access_keys where key = k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;
  if rec.is_master then
    update public.access_keys set device=coalesce(_device,device), device_id=coalesce(_device_id,device_id), activated_at=coalesce(activated_at,now()) where id=rec.id returning * into rec;
    return to_jsonb(rec);
  end if;
  if rec.user_id is not null and rec.user_id <> uid then raise exception 'key_already_linked'; end if;
  if rec.activated_at is not null then
    if rec.device_id is not null and rec.device_id <> _device_id then raise exception 'device_mismatch'; end if;
    if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;
    update public.access_keys set user_id=uid, device=coalesce(_device,device), device_id=coalesce(rec.device_id,_device_id) where id=rec.id returning * into rec;
    return to_jsonb(rec);
  end if;
  update public.access_keys set user_id=uid, device=_device, device_id=_device_id, activated_at=now(), expires_at=now()+(rec.duration_days || ' days')::interval where id=rec.id returning * into rec;
  return to_jsonb(rec);
end;
$$;
revoke execute on function public.redeem_key(text,text,text) from anon;
grant execute on function public.redeem_key(text,text,text) to authenticated;

create or replace function public.validate_key(_key text, _device_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare rec public.access_keys%rowtype; k text := upper(trim(_key)); uid uuid := auth.uid();
begin
  select * into rec from public.access_keys where key=k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;
  if rec.is_master then return to_jsonb(rec); end if;
  if rec.user_id is not null and (uid is null or rec.user_id <> uid) then raise exception 'account_mismatch'; end if;
  if rec.device_id is not null and rec.device_id <> _device_id then raise exception 'device_mismatch'; end if;
  if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;
  return to_jsonb(rec);
end;
$$;
grant execute on function public.validate_key(text,text) to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;


-- Login: resolve a conta existente pela key sem expor a tabela de usuários
create or replace function public.get_login_email_by_key(_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare result_email text;
begin
  select u.email into result_email
  from public.access_keys k
  join auth.users u on u.id = k.user_id
  where k.key = upper(trim(_key))
    and k.user_id is not null
    and k.revoked = false
    and (k.expires_at is null or k.expires_at >= now())
  limit 1;

  if result_email is null then
    raise exception 'invalid_key';
  end if;

  return result_email;
end;
$$;

revoke all on function public.get_login_email_by_key(text) from public;
grant execute on function public.get_login_email_by_key(text) to anon, authenticated;
