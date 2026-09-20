-- Recursos de edição e finalização do chat de suporte
alter table public.support_messages
  add column if not exists edited_at timestamptz;

alter table public.support_threads
  add column if not exists closed_at timestamptz;

create or replace function public.support_edit_message(_key text, _message_id uuid, _body text)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare rec public.support_messages%rowtype;
begin
  update public.support_messages m
     set body = trim(_body), edited_at = now()
   where m.id = _message_id
     and m.sender_type = 'user'
     and exists (
       select 1 from public.support_threads t
       join public.access_keys k on k.id = t.key_id
       where t.id = m.thread_id
         and upper(k.key) = upper(trim(_key))
         and k.revoked = false
     )
     and length(trim(_body)) between 1 and 1000
   returning m.* into rec;
  if rec.id is null then raise exception 'message_not_found_or_not_allowed'; end if;
  return rec;
end;
$$;

create or replace function public.admin_support_edit_message(_password text, _message_id uuid, _body text)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare rec public.support_messages%rowtype;
begin
  perform public._require_admin(_password);
  update public.support_messages
     set body = trim(_body), edited_at = now()
   where id = _message_id
     and sender_type = 'admin'
     and length(trim(_body)) between 1 and 1000
   returning * into rec;
  if rec.id is null then raise exception 'message_not_found_or_not_allowed'; end if;
  return rec;
end;
$$;

create or replace function public.support_close_chat(_key text)
returns public.support_threads
language plpgsql
security definer
set search_path = public
as $$
declare rec public.support_threads%rowtype;
begin
  update public.support_threads t
     set closed_at = coalesce(closed_at, now()), updated_at = now()
   where t.id = (
     select st.id
     from public.support_threads st
     join public.access_keys k on k.id = st.key_id
     where upper(k.key) = upper(trim(_key)) and k.revoked = false
     limit 1
   )
   returning t.* into rec;
  if rec.id is null then raise exception 'thread_not_found'; end if;
  return rec;
end;
$$;

create or replace function public.admin_support_close_chat(_password text, _thread_id uuid)
returns public.support_threads
language plpgsql
security definer
set search_path = public
as $$
declare rec public.support_threads%rowtype;
begin
  perform public._require_admin(_password);
  update public.support_threads
     set closed_at = coalesce(closed_at, now()), updated_at = now()
   where id = _thread_id
   returning * into rec;
  if rec.id is null then raise exception 'thread_not_found'; end if;
  return rec;
end;
$$;

grant execute on function public.support_edit_message(text,uuid,text) to anon, authenticated;
grant execute on function public.admin_support_edit_message(text,uuid,text) to anon, authenticated;
grant execute on function public.support_close_chat(text) to anon, authenticated;
grant execute on function public.admin_support_close_chat(text,uuid) to anon, authenticated;