create or replace function public._check_admin(_password text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  stored text;
begin
  select public._cfg_text('master_password') into stored;
  return stored is not null and _password is not null
    and upper(btrim(stored)) = upper(btrim(_password));
end;
$function$;