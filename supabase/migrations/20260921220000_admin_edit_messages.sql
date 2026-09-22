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
