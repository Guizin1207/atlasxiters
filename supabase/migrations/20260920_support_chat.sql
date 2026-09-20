-- Chat de suporte usuário <-> ADM
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references public.access_keys(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(key_id)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','admin')),
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

revoke all on public.support_threads from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;

create or replace function public.support_list_messages(_key text)
returns setof public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare tid uuid;
begin
  select id into tid from public.support_threads t
  join public.access_keys k on k.id=t.key_id
  where upper(k.key)=upper(trim(_key)) and k.revoked=false
  limit 1;
  if tid is null then return; end if;
  return query select * from public.support_messages where thread_id=tid order by created_at;
end;
$$;

create or replace function public.support_send_message(_key text, _body text)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare tid uuid; rec public.support_messages;
begin
  select t.id into tid from public.support_threads t
  join public.access_keys k on k.id=t.key_id
  where upper(k.key)=upper(trim(_key)) and k.revoked=false
  limit 1;
  if tid is null then
    insert into public.support_threads(key_id)
    select id from public.access_keys where upper(key)=upper(trim(_key)) and revoked=false
    returning id into tid;
  end if;
  insert into public.support_messages(thread_id,sender_type,body)
  values(tid,'user',trim(_body)) returning * into rec;
  update public.support_threads set updated_at=now() where id=tid;
  return rec;
end;
$$;

create or replace function public.admin_support_list_threads(_password text)
returns table(id uuid,key_id uuid,key text,updated_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public._require_admin(_password);
  return query select t.id,t.key_id,k.key,t.updated_at
  from public.support_threads t join public.access_keys k on k.id=t.key_id
  order by t.updated_at desc;
end;
$$;

create or replace function public.admin_support_list_messages(_password text,_thread_id uuid)
returns setof public.support_messages
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public._require_admin(_password);
  return query select * from public.support_messages where thread_id=_thread_id order by created_at;
end;
$$;

create or replace function public.admin_support_send_message(_password text,_thread_id uuid,_body text)
returns public.support_messages
language plpgsql
security definer
set search_path=public
as $$
declare rec public.support_messages;
begin
  perform public._require_admin(_password);
  insert into public.support_messages(thread_id,sender_type,body)
  values(_thread_id,'admin',trim(_body)) returning * into rec;
  update public.support_threads set updated_at=now() where id=_thread_id;
  return rec;
end;
$$;

grant execute on function public.support_list_messages(text) to anon, authenticated;
grant execute on function public.support_send_message(text,text) to anon, authenticated;
grant execute on function public.admin_support_list_threads(text) to anon, authenticated;
grant execute on function public.admin_support_list_messages(text,uuid) to anon, authenticated;
grant execute on function public.admin_support_send_message(text,uuid,text) to anon, authenticated;
