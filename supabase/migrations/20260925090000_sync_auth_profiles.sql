-- Keep Atlas Auth accounts and public profiles synchronized.
create or replace function public.handle_new_user()
returns trigger
set search_path = ''
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    now()
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();
