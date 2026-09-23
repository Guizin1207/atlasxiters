create or replace function public.get_login_email_by_username(_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result_email text;
begin
  select u.email
    into result_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(trim(p.full_name)) = lower(trim(_username))
    and u.email is not null
  group by p.full_name, u.email
  having count(*) = 1
  limit 1;

  if result_email is null then
    raise exception 'invalid_username';
  end if;

  return result_email;
end;
$$;

revoke all on function public.get_login_email_by_username(text) from public;
grant execute on function public.get_login_email_by_username(text) to anon, authenticated;
