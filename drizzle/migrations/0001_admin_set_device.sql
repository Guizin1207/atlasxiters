create or replace function public.admin_set_device(_password text, _id uuid, _device text)
returns access_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_keys%rowtype;
  d text := nullif(trim(coalesce(_device, '')), '');
begin
  perform public._require_admin(_password);
  if d is not null and lower(d) not in ('android','ios','mac','windows','linux') then
    raise exception 'invalid_device';
  end if;
  update public.access_keys
     set device = case when d is null then null else initcap(d) end,
         device_id = null
   where id = _id
   returning * into rec;
  if not found then raise exception 'not_found'; end if;
  return rec;
end;
$$;

grant execute on function public.admin_set_device(text, uuid, text) to anon, authenticated, service_role;