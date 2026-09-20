-- lovable-cron-fallback-reviewed: expiração por prazo não gera evento no banco; trigger cobre a expiração manual e o cron de 5 min é o backstop para o vencimento por tempo (aviso em até 5 min)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.key_expiry_notices (
  key_id uuid primary key references public.access_keys(id) on delete cascade,
  expires_at timestamptz not null,
  notified_at timestamptz not null default now()
);

grant all on public.key_expiry_notices to service_role;
alter table public.key_expiry_notices enable row level security;

create or replace function public.notify_expired_keys()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  rec record;
  total int := 0;
begin
  for rec in
    select k.id, k.key, k.expires_at
    from public.access_keys k
    left join public.key_expiry_notices n on n.key_id = k.id
    where k.is_master = false
      and k.plan <> 'demo'
      and k.revoked = false
      and k.activated_at is not null
      and k.expires_at is not null
      and k.expires_at <= now()
      and (n.key_id is null or n.expires_at <> k.expires_at)
  loop
    insert into public.admin_messages (title, body, target_key_id)
    values (
      'Sua key foi expirada',
      'Sua key foi expirada. Fale com o suporte para renovar seu acesso.',
      rec.id
    );

    insert into public.key_expiry_notices (key_id, expires_at, notified_at)
    values (rec.id, rec.expires_at, now())
    on conflict (key_id) do update
      set expires_at = excluded.expires_at, notified_at = now();

    perform net.http_post(
      url := 'https://soadsghfbmogayootqwl.supabase.co/functions/v1/notify-admin',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('kind', 'expired', 'key', rec.key)
    );

    total := total + 1;
  end loop;

  return total;
end;
$$;

-- Expiração manual ("Expirar agora") avisa na hora
create or replace function public.tg_key_expired_notice()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.expires_at is not null
     and new.expires_at <= now()
     and new.is_master = false
     and new.plan <> 'demo'
     and new.revoked = false
     and new.activated_at is not null
     and (old.expires_at is distinct from new.expires_at or old.revoked is distinct from new.revoked)
  then
    perform public.notify_expired_keys();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_key_expired_notice on public.access_keys;
create trigger trg_key_expired_notice
after update on public.access_keys
for each row execute function public.tg_key_expired_notice();

select cron.unschedule('atlas-notify-expired-keys') where exists (
  select 1 from cron.job where jobname = 'atlas-notify-expired-keys'
);

select cron.schedule(
  'atlas-notify-expired-keys',
  '*/5 * * * *',
  $$select public.notify_expired_keys();$$
);