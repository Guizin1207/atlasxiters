create or replace function public.auto_confirm_atlas_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and lower(new.email) like '%@atlasvip.app' then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmed_at = coalesce(confirmed_at, now())
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_confirm_atlas_users on auth.users;
create trigger auto_confirm_atlas_users
after insert on auth.users
for each row
execute function public.auto_confirm_atlas_users();
