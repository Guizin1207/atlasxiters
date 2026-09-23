-- Atlas VIP: novos níveis para criação de keys.
create or replace function public.admin_create_keys(_count integer, _duration_days integer, _note text, _password text, _plan text default 'basic')
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  qtd int:=greatest(1,least(coalesce(_count,1),100));
  pl text:=lower(coalesce(nullif(trim(_plan),''),'basic'));
  dur int; i int; k text; rec public.access_keys%rowtype; out jsonb:='[]'::jsonb;
begin
  perform public._require_admin(_password);
  if pl not in ('demo','basic','pro','master','bronze','esmeralda','rubi','atlas') then raise exception 'invalid_plan'; end if;
  dur:=case when pl='demo' then 0 when coalesce(_duration_days,0)>0 then _duration_days
    when pl='pro' then 90 when pl='master' then 36500 when pl='bronze' then 30
    when pl='esmeralda' then 90 when pl='rubi' then 180 when pl='atlas' then 365 else 30 end;
  for i in 1..qtd loop
    loop
      k:=public._gen_key();
      begin
        insert into public.access_keys(key,duration_days,note,plan,is_master)
        values(k,dur,nullif(trim(coalesce(_note,'')),''),pl,pl='master')
        returning * into rec;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    out:=out||to_jsonb(rec);
  end loop;
  return out;
end;
$function$;