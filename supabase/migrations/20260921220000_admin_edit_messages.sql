-- Permite ao ADM editar mensagens já enviadas sem apagar o histórico.
alter table public.admin_messages
  add column if not exists edited_at timestamptz;

create or replace function public.admin_edit_message(
  _password text,
  _id uuid,
  _title text,
  _body text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.admin_messages%rowtype;
begin
  perform public._require_admin(_password);

  if coalesce(trim(_title), '') = '' then
    raise exception 'invalid_title';
  end if;

  if coalesce(trim(_body), '') = '' then
    raise exception 'invalid_body';
  end if;

  update public.admin_messages
  set
    title = trim(_title),
    body = trim(_body),
    edited_at = now()
  where id = _id
  returning * into rec;

  if rec.id is null then
    raise exception 'message_not_found';
  end if;

  return to_jsonb(rec);
end;
$$;

-- Inclui a marca de edição no histórico do ADM.
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
      m.edited_at,
      ak.key as target_key,
      (select count(*) from public.message_reads r where r.message_id = m.id) as read_count
    from public.admin_messages m
    left join public.access_keys ak on ak.id = m.target_key_id
  ) t;

  return result;
end;
$$;
