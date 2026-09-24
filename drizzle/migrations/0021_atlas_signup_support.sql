alter table public.access_keys add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists access_keys_user_id_idx on public.access_keys(user_id);

create or replace function public.get_login_email_by_username(_username text)
returns text language plpgsql security definer set search_path = public
as $function$
declare result_email text;
begin
  select u.email into result_email
  from auth.users u join public.profiles p on p.id=u.id
  where lower(trim(p.full_name)) = lower(trim(_username))
  order by u.created_at limit 1;
  if result_email is null then raise exception 'invalid_username'; end if;
  return result_email;
end;
$function$;
revoke all on function public.get_login_email_by_username(text) from public;
grant execute on function public.get_login_email_by_username(text) to anon, authenticated;