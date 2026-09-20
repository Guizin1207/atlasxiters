-- ====================================================================
-- ATLAS VIP — Acesso DEMO de verdade
-- O gerador do admin tinha o modo "Demo", mas o banco convertia
-- silenciosamente para Basic. Aqui o plano demo passa a existir de
-- ponta a ponta: criação, troca de plano, ativação e liberação de
-- funções (demo equivale ao Basic, sem expiração).
-- ====================================================================

-- Duração por plano: demo não expira (0 = sem prazo).
create or replace function public._plan_days(_plan text)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select case lower(coalesce(_plan, 'basic'))
    when 'pro' then 90
    when 'master' then 36500
    when 'demo' then 0
    else 30
  end
$$;

-- Gerador de chaves: aceita demo e não dá prazo de validade para ele.
create or replace function public.admin_create_keys(
  _count int, _duration_days int, _note text, _password text, _plan text default 'basic'
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
  if pl not in ('demo', 'basic', 'pro', 'master') then pl := 'basic'; end if;
  dur := case
    when pl = 'demo' then 0
    else greatest(1, coalesce(nullif(_duration_days, 0), public._plan_days(pl)))
  end;

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

-- Troca de plano: demo também pode ser aplicado pelo admin.
create or replace function public.admin_set_plan(
  _password text, _id uuid, _plan text, _apply_duration boolean default true
) returns access_keys
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec public.access_keys%rowtype;
  pl text := lower(coalesce(_plan, 'basic'));
  d int;
begin
  perform public._require_admin(_password);
  if pl not in ('demo', 'basic', 'pro', 'master') then raise exception 'invalid_plan'; end if;
  d := public._plan_days(pl);

  update public.access_keys
     set plan = pl,
         duration_days = case when _apply_duration then d else duration_days end,
         expires_at = case
           when not _apply_duration then expires_at
           when pl in ('master', 'demo') then null
           when activated_at is not null then now() + (d || ' days')::interval
           else null
         end
   where id = _id
   returning * into rec;

  if not found then raise exception 'not_found'; end if;
  return rec;
end;
$$;

-- Primeiro uso: chave demo ativa, prende ao dispositivo e não ganha prazo.
create or replace function public.redeem_key(_key text, _device text, _device_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec public.access_keys%rowtype;
  k text := upper(trim(_key));
begin
  if k is null or k = '' then raise exception 'invalid_key'; end if;
  select * into rec from public.access_keys where key = k;
  if not found then raise exception 'invalid_key'; end if;
  if rec.revoked then raise exception 'revoked_key'; end if;

  if rec.is_master then
    update public.access_keys
       set device = coalesce(_device, device),
           device_id = coalesce(_device_id, device_id),
           activated_at = coalesce(activated_at, now())
     where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  -- Quando o admin escolheu um sistema e liberou o dispositivo,
  -- o próximo login precisa vir desse sistema.
  if rec.device_id is null
     and rec.device is not null
     and lower(rec.device) <> lower(coalesce(_device, '')) then
    raise exception 'device_mismatch';
  end if;

  if rec.activated_at is not null then
    if rec.device_id is not null and rec.device_id <> _device_id then
      raise exception 'device_mismatch';
    end if;
    if rec.expires_at is not null and rec.expires_at < now() then
      raise exception 'expired_key';
    end if;
    update public.access_keys
       set device = coalesce(_device, device),
           device_id = coalesce(rec.device_id, _device_id)
     where id = rec.id returning * into rec;
    return to_jsonb(rec);
  end if;

  update public.access_keys
     set device = _device,
         device_id = _device_id,
         activated_at = now(),
         expires_at = case
           when lower(rec.plan) = 'demo' then null
           else now() + (rec.duration_days || ' days')::interval
         end
   where id = rec.id returning * into rec;
  return to_jsonb(rec);
end;
$$;

grant execute on function public._plan_days(text)                             to anon, authenticated;
grant execute on function public.admin_create_keys(int, int, text, text, text) to anon, authenticated;
grant execute on function public.admin_set_plan(text, uuid, text, boolean)     to anon, authenticated;
grant execute on function public.redeem_key(text, text, text)                  to anon, authenticated;