-- Atlas account/key flow hardening
-- Keys use ATLS-XXXX-XXXX and are linked only after authenticated redeem.

create or replace function public.admin_create_keys(
  _count integer,
  _duration_days integer,
  _note text,
  _password text,
  _plan text default 'basic'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  qtd int := greatest(1, least(coalesce(_count, 1), 100));
  pl text := lower(coalesce(nullif(trim(_plan), ''), 'basic'));
  dur int;
  i int;
  k text;
  rec public.access_keys%rowtype;
  out jsonb := '[]'::jsonb;
begin
  perform public._require_admin(_password);
  if pl not in ('demo','basic','pro','master','bronze','esmeralda','rubi','atlas') then
    raise exception 'invalid_plan';
  end if;
  dur := case
    when pl='demo' then 0
    when coalesce(_duration_days,0)>0 then _duration_days
    when pl='basic' then 30
    when pl='pro' then 60
    when pl='master' then 90
    when pl='bronze' then 30
    when pl='esmeralda' then 60
    when pl='rubi' then 90
    when pl='atlas' then 180
    else 30
  end;
  for i in 1..qtd loop
    loop
      k := public._standard_atlas_key();
      begin
        insert into public.access_keys(key,duration_days,note,plan,is_master)
        values(k,dur,nullif(trim(coalesce(_note,'')),''),pl,false)
        returning * into rec;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    out := out || to_jsonb(rec);
  end loop;
  return out;
end;
$function$;

create or replace function public.get_login_email_by_username(_username text)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare result_email text;
begin
  select u.email into result_email
  from auth.users u
  left join public.profiles p on p.id=u.id
  where lower(trim(coalesce(
    p.full_name,
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    ''
  ))) = lower(trim(_username))
  limit 1;
  if result_email is null then raise exception 'invalid_username'; end if;
  return result_email;
end;
$function$;

drop trigger if exists bind_atlas_signup_key on auth.users;

create unique index if not exists profiles_full_name_lower_unique
on public.profiles (lower(trim(full_name)))
where nullif(trim(full_name), '') is not null;

grant execute on function public.get_login_email_by_username(text) to anon, authenticated;
