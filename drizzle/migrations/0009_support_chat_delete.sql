create or replace function public.support_delete_chat(_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  tid uuid;
begin
  select st.id into tid
  from public.support_threads st
  join public.access_keys k on k.id = st.key_id
  where upper(k.key) = upper(trim(_key)) and k.revoked = false
  limit 1;
  if tid is null then raise exception 'thread_not_found'; end if;
  delete from public.support_messages where thread_id = tid;
  delete from public.support_threads where id = tid;
  return true;
end;
$function$;

create or replace function public.admin_support_delete_chat(_password text, _thread_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public._require_admin(_password);
  if not exists (select 1 from public.support_threads where id = _thread_id) then
    raise exception 'thread_not_found';
  end if;
  delete from public.support_messages where thread_id = _thread_id;
  delete from public.support_threads where id = _thread_id;
  return true;
end;
$function$;

grant execute on function public.support_delete_chat(text) to anon, authenticated;
grant execute on function public.admin_support_delete_chat(text, uuid) to anon, authenticated;