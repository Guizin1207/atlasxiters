-- Atlas: keys comerciais voltam a ser independentes do nome do cliente
create or replace function public._standard_atlas_key()
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(
      'ATLS-' ||
      substr(md5(gen_random_uuid()::text), 1, 4) || '-' ||
      substr(md5((gen_random_uuid()::text) || clock_timestamp()::text), 1, 4)
    );
    exit when not exists (select 1 from public.access_keys where key = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.admin_create_keys(
  _count integer,
  _duration_days integer,
  _note text,
  _password text,
  _plan text default 'basic',
  _customer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  qtd int := greatest(1, least(coalesce(_count,1),100));
  pl text := lower(coalesce(nullif(trim(_plan),''),'basic'));
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
    when pl='pro' then 60
    when pl='master' then 90
    when pl='bronze' then 30
    when pl='esmeralda' then 60
    when pl='rubi' then 90
    when pl='atlas' then 180
    else 30
  end;

  for i in 1..qtd loop
    k := public._standard_atlas_key();
    insert into public.access_keys(key,duration_days,note,plan,is_master,customer_name)
    values(k,dur,nullif(trim(coalesce(_note,'')),''),pl,false,null)
    returning * into rec;
    out := out || to_jsonb(rec);
  end loop;
  return out;
end;
$$;

grant execute on function public.admin_create_keys(integer,integer,text,text,text,text) to anon, authenticated;
