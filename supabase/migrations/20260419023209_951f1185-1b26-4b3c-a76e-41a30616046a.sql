-- ============================================
-- TABELAS
-- ============================================
create table public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_key_id uuid references public.access_keys(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_admin_messages_target on public.admin_messages(target_key_id);
create index idx_admin_messages_created on public.admin_messages(created_at desc);

create table public.message_reads (
  message_id uuid not null references public.admin_messages(id) on delete cascade,
  key_id uuid not null references public.access_keys(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, key_id)
);

create index idx_message_reads_key on public.message_reads(key_id);

-- RLS bloqueia tudo; acesso só via RPC SECURITY DEFINER
alter table public.admin_messages enable row level security;
alter table public.message_reads enable row level security;

-- Realtime
alter publication supabase_realtime add table public.admin_messages;
alter publication supabase_realtime add table public.message_reads;
alter table public.admin_messages replica identity full;
alter table public.message_reads replica identity full;

-- ============================================
-- FUNÇÕES ADMIN
-- ============================================
create or replace function public.admin_send_message(
  _password text,
  _title text,
  _body text,
  _target_key_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.admin_messages%rowtype;
begin
  perform public._require_admin(_password);
  if coalesce(trim(_title), '') = '' then raise exception 'invalid_title'; end if;
  if coalesce(trim(_body), '') = '' then raise exception 'invalid_body'; end if;

  insert into public.admin_messages (title, body, target_key_id)
  values (trim(_title), trim(_body), _target_key_id)
  returning * into rec;

  return to_jsonb(rec);
end;
$$;

create or replace function public.admin_list_messages(_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public._require_admin(_password);

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      m.id,
      m.title,
      m.body,
      m.target_key_id,
      m.created_at,
      ak.key as target_key,
      (select count(*) from public.message_reads r where r.message_id = m.id) as read_count
    from public.admin_messages m
    left join public.access_keys ak on ak.id = m.target_key_id
  ) t;

  return result;
end;
$$;

create or replace function public.admin_delete_message(_password text, _id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
begin
  perform public._require_admin(_password);
  delete from public.admin_messages where id = _id;
  get diagnostics cnt = row_count;
  return cnt > 0;
end;
$$;

-- ============================================
-- FUNÇÕES USUÁRIO (chave valida acesso)
-- ============================================
create or replace function public.list_my_messages(_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kid uuid;
  result jsonb;
begin
  select id into kid from public.access_keys
   where key = upper(trim(_key)) and revoked = false;
  if kid is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      m.id,
      m.title,
      m.body,
      m.created_at,
      m.target_key_id is not null as is_direct,
      exists (select 1 from public.message_reads r where r.message_id = m.id and r.key_id = kid) as is_read
    from public.admin_messages m
    where m.target_key_id is null or m.target_key_id = kid
  ) t;

  return result;
end;
$$;

create or replace function public.mark_messages_read(_key text, _ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  kid uuid;
  inserted int := 0;
begin
  select id into kid from public.access_keys
   where key = upper(trim(_key)) and revoked = false;
  if kid is null then return 0; end if;

  with ins as (
    insert into public.message_reads (message_id, key_id)
    select unnest(_ids), kid
    on conflict do nothing
    returning 1
  )
  select count(*) into inserted from ins;

  return inserted;
end;
$$;

create or replace function public.count_unread_messages(_key text)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kid uuid;
  cnt int;
begin
  select id into kid from public.access_keys
   where key = upper(trim(_key)) and revoked = false;
  if kid is null then return 0; end if;

  select count(*) into cnt
  from public.admin_messages m
  where (m.target_key_id is null or m.target_key_id = kid)
    and not exists (
      select 1 from public.message_reads r
      where r.message_id = m.id and r.key_id = kid
    );

  return cnt;
end;
$$;