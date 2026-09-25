create or replace function public.check_user_key(_username text, _key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare rec public.access_keys%rowtype; owner_name text;
begin
  select * into rec from public.access_keys where key = upper(trim(_key));
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;
  if rec.expires_at is not null and rec.expires_at < now() then raise exception 'expired_key'; end if;
  if rec.user_id is null then raise exception 'key_not_linked'; end if;
  select full_name into owner_name from public.profiles where id = rec.user_id;
  if owner_name is null or lower(trim(owner_name)) <> lower(trim(_username)) then
    raise exception 'key_already_linked';
  end if;
  return true;
end; $$;
grant execute on function public.check_user_key(text, text) to anon, authenticated;