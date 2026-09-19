-- 1) Plano na chave
ALTER TABLE public.access_keys
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic';

UPDATE public.access_keys SET plan = 'master' WHERE is_master = true;

-- 2) Pedidos de upgrade
CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.access_keys(id) ON DELETE CASCADE,
  requested_plan text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT ALL ON public.upgrade_requests TO service_role;
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;
-- acesso apenas via funções SECURITY DEFINER (nenhuma policy pública, intencional)

CREATE INDEX IF NOT EXISTS upgrade_requests_status_idx ON public.upgrade_requests (status, created_at DESC);

-- 3) Dias padrão por plano
CREATE OR REPLACE FUNCTION public._plan_days(_plan text)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  select case lower(coalesce(_plan, 'basic'))
    when 'pro' then 90
    when 'master' then 36500
    else 30
  end
$$;

-- 4) Gerador de chaves com plano
DROP FUNCTION IF EXISTS public.admin_create_keys(integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_keys(
  _count integer,
  _duration_days integer,
  _note text,
  _password text,
  _plan text DEFAULT 'basic'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
declare
  qtd int := greatest(1, least(coalesce(_count, 1), 100));
  pl text := lower(coalesce(nullif(trim(_plan), ''), 'basic'));
  dur int;
  i int;
  k text;
  attempts int;
  created jsonb := '[]'::jsonb;
  rec public.access_keys%rowtype;
begin
  perform public._require_admin(_password);
  if pl not in ('basic', 'pro', 'master') then pl := 'basic'; end if;
  dur := greatest(1, coalesce(nullif(_duration_days, 0), public._plan_days(pl)));

  for i in 1..qtd loop
    attempts := 0;
    loop
      k := public._gen_key();
      attempts := attempts + 1;
      begin
        insert into public.access_keys (key, duration_days, note, plan)
        values (k, dur, nullif(_note, ''), pl)
        returning * into rec;
        exit;
      exception when unique_violation then
        if attempts > 5 then raise; end if;
      end;
    end loop;
    created := created || to_jsonb(rec);
  end loop;

  return created;
end;
$$;

-- 5) Admin altera plano de uma chave
CREATE OR REPLACE FUNCTION public.admin_set_plan(_password text, _id uuid, _plan text, _apply_duration boolean DEFAULT true)
RETURNS access_keys
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
declare
  rec public.access_keys%rowtype;
  pl text := lower(coalesce(_plan, 'basic'));
  d int;
begin
  perform public._require_admin(_password);
  if pl not in ('basic', 'pro', 'master') then raise exception 'invalid_plan'; end if;
  d := public._plan_days(pl);

  update public.access_keys
     set plan = pl,
         duration_days = case when _apply_duration then d else duration_days end,
         expires_at = case
           when not _apply_duration then expires_at
           when pl = 'master' then null
           when activated_at is not null then now() + (d || ' days')::interval
           else null
         end
   where id = _id
   returning * into rec;

  if not found then raise exception 'not_found'; end if;
  return rec;
end;
$$;

-- 6) Usuário pede upgrade
CREATE OR REPLACE FUNCTION public.request_upgrade(_key text, _plan text, _message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
declare
  rec public.access_keys%rowtype;
  pl text := lower(coalesce(_plan, ''));
  req public.upgrade_requests%rowtype;
begin
  if pl not in ('basic', 'pro', 'master') then raise exception 'invalid_plan'; end if;

  select * into rec from public.access_keys
   where key = upper(trim(_key)) and revoked = false;
  if not found then raise exception 'invalid_key'; end if;

  if exists (
    select 1 from public.upgrade_requests
     where key_id = rec.id and status = 'pending' and requested_plan = pl
  ) then
    raise exception 'already_pending';
  end if;

  insert into public.upgrade_requests (key_id, requested_plan, message)
  values (rec.id, pl, nullif(trim(coalesce(_message, '')), ''))
  returning * into req;

  return to_jsonb(req);
end;
$$;

CREATE OR REPLACE FUNCTION public.list_my_upgrade_requests(_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
declare
  kid uuid;
  result jsonb;
begin
  select id into kid from public.access_keys where key = upper(trim(_key));
  if kid is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  into result
  from (
    select id, requested_plan, message, status, created_at, resolved_at
    from public.upgrade_requests where key_id = kid
  ) t;

  return result;
end;
$$;

-- 7) Admin lista/resolve pedidos
CREATE OR REPLACE FUNCTION public.admin_list_upgrade_requests(_password text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
declare
  result jsonb;
begin
  perform public._require_admin(_password);

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  into result
  from (
    select r.id, r.requested_plan, r.message, r.status, r.created_at, r.resolved_at,
           r.key_id, ak.key, ak.plan as current_plan, ak.device, ak.expires_at
    from public.upgrade_requests r
    join public.access_keys ak on ak.id = r.key_id
  ) t;

  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_upgrade_request(_password text, _id uuid, _approve boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
declare
  req public.upgrade_requests%rowtype;
begin
  perform public._require_admin(_password);

  update public.upgrade_requests
     set status = case when _approve then 'approved' else 'rejected' end,
         resolved_at = now()
   where id = _id and status = 'pending'
   returning * into req;
  if not found then raise exception 'not_found'; end if;

  if _approve then
    perform public.admin_set_plan(_password, req.key_id, req.requested_plan, true);
  end if;

  return to_jsonb(req);
end;
$$;