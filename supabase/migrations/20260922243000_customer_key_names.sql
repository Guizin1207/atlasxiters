-- Atlas: nome do cliente e chave legível por cliente
alter table public.access_keys
  add column if not exists customer_name text;

create index if not exists access_keys_customer_name_idx
  on public.access_keys (customer_name);

-- Gera a chave no padrão NOME-PLANO-ATLS.
-- Ex.: João da Silva + Pro -> JOAO-PRO-ATLS
create or replace function public._customer_key_prefix(_name text)
returns text
language plpgsql
immutable
as $function$
declare
  n text;
begin
  n := upper(trim(coalesce(_name, '')));
  n := translate(n,
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'AAAAAEEEEIIIIOOOOOUUUUC');
  n := regexp_replace(n, '[^A-Z0-9]+', '', 'g');
  n := left(n, 12);
  if n = '' then n := 'CLIENTE'; end if;
  return n;
end;
$function$;

create or replace function public._plan_key_label(_plan text)
returns text
language sql
immutable
as $function$
  select case lower(coalesce(_plan, 'basic'))
    when 'demo' then 'DEMO'
    when 'basic' then 'BASIC'
    when 'pro' then 'PRO'
    when 'master' then 'MASTER'
    when 'bronze' then 'BRONZE'
    when 'esmeralda' then 'ESMERALDA'
    when 'rubi' then 'RUBI'
    when 'atlas' then 'ATLAS'
    else upper(regexp_replace(coalesce(_plan, 'basic'), '[^a-zA-Z0-9]+', '', 'g'))
  end;
$function$;

create or replace function public._customer_key(_name text, _plan text)
returns text
language plpgsql
volatile
as $function$
declare
  base text;
  candidate text;
  suffix int := 1;
begin
  base := public._customer_key_prefix(_name) || '-' || public._plan_key_label(_plan) || '-ATLS';
  candidate := base;

  while exists (select 1 from public.access_keys where key = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
  end loop;

  return candidate;
end;
$function$;

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
as $function$
declare
  qtd int := greatest(1, least(coalesce(_count,1),100));
  pl text := lower(coalesce(nullif(trim(_plan),''),'basic'));
  dur int;
  i int;
  k text;
  rec public.access_keys%rowtype;
  out jsonb := '[]'::jsonb;
  client_name text := nullif(trim(coalesce(_customer_name,'')),'');
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
    k := public._customer_key(client_name, pl);
    insert into public.access_keys(key,duration_days,note,plan,is_master,customer_name)
    values(k,dur,nullif(trim(coalesce(_note,'')),''),pl,false,client_name)
    returning * into rec;
    out := out || to_jsonb(rec);
  end loop;

  return out;
end;
$function$;

grant execute on function public.admin_create_keys(integer,integer,text,text,text,text) to anon, authenticated;
