-- Atlas: vincula automaticamente a key usada no cadastro à nova conta.
create or replace function public.bind_signup_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  rec public.access_keys%rowtype;
begin
  k := upper(trim(coalesce(new.raw_user_meta_data->>'atlas_signup_key', '')));
  if k = '' then return new; end if;

  select * into rec from public.access_keys where key = k limit 1;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;
  if rec.is_master then raise exception 'invalid_signup_key'; end if;
  if rec.user_id is not null and rec.user_id <> new.id then raise exception 'key_already_linked'; end if;
  if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;

  update public.access_keys
  set user_id = new.id
  where id = rec.id and (user_id is null or user_id = new.id);

  return new;
end;
$$;

revoke all on function public.bind_signup_key() from public;

drop trigger if exists bind_atlas_signup_key on auth.users;
create trigger bind_atlas_signup_key
after insert on auth.users
for each row execute function public.bind_signup_key();
