-- Atlas VIP: controle administrativo completo de recompensas
-- Depende das tabelas/RPCs de recompensas e de public._require_admin.

create table if not exists public.atlas_reward_config (
  id boolean primary key default true,
  daily_amount integer not null default 10 check (daily_amount > 0),
  max_coins integer not null default 100 check (max_coins >= daily_amount),
  redeem_cost integer not null default 100 check (redeem_cost > 0),
  redeem_days integer not null default 30 check (redeem_days > 0),
  updated_at timestamptz not null default now()
);

insert into public.atlas_reward_config(id) values (true) on conflict (id) do nothing;
alter table public.atlas_reward_config enable row level security;

create or replace function public.admin_reward_config(_password text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin perform public._require_admin(_password); return to_jsonb((select c from public.atlas_reward_config c where id=true)); end; $$;

create or replace function public.admin_reward_list(_password text)
returns table(key_id uuid,key text,coins integer,last_daily_claim date,total_claims integer,current_streak integer,best_streak integer,claimed_today boolean,expires_at timestamptz,revoked boolean)
language plpgsql stable security definer set search_path=public as $$
declare today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 perform public._require_admin(_password);
 return query select k.id,k.key,coalesce(r.coins,0),r.last_daily_claim,coalesce(r.total_claims,0),coalesce(r.current_streak,0),coalesce(r.best_streak,0),coalesce(r.last_daily_claim=today,false),k.expires_at,k.revoked
 from public.access_keys k left join public.atlas_rewards r on r.key_id=k.id where k.is_master=false order by coalesce(r.coins,0) desc,k.created_at desc;
end; $$;

create or replace function public.admin_reward_set_config(_daily_amount integer,_max_coins integer,_redeem_cost integer,_redeem_days integer,_password text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d int:=greatest(1,coalesce(_daily_amount,10)); m int:=greatest(d,coalesce(_max_coins,100)); c int:=greatest(1,coalesce(_redeem_cost,100)); days int:=greatest(1,coalesce(_redeem_days,30));
begin
 perform public._require_admin(_password);
 update public.atlas_reward_config set daily_amount=d,max_coins=m,redeem_cost=c,redeem_days=days,updated_at=now() where id=true;
 return public.admin_reward_config(_password);
end; $$;

create or replace function public.admin_reward_add_coins(_key_id uuid,_amount integer,_password text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.atlas_rewards%rowtype; maxc int;
begin
 perform public._require_admin(_password); select max_coins into maxc from public.atlas_reward_config where id=true;
 insert into public.atlas_rewards(key_id) values(_key_id) on conflict(key_id) do nothing;
 select * into r from public.atlas_rewards where key_id=_key_id for update;
 if not found then raise exception 'key_not_found'; end if;
 update public.atlas_rewards set coins=greatest(0,least(coalesce(r.coins,0)+coalesce(_amount,0),maxc)),updated_at=now() where key_id=_key_id returning * into r;
 return jsonb_build_object('ok',true,'coins',r.coins);
end; $$;

create or replace function public.admin_reward_set_coins(_key_id uuid,_coins integer,_password text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.atlas_rewards%rowtype; maxc int;
begin
 perform public._require_admin(_password); select max_coins into maxc from public.atlas_reward_config where id=true;
 insert into public.atlas_rewards(key_id) values(_key_id) on conflict(key_id) do nothing;
 update public.atlas_rewards set coins=greatest(0,least(coalesce(_coins,0),maxc)),updated_at=now() where key_id=_key_id returning * into r;
 if not found then raise exception 'key_not_found'; end if;
 return jsonb_build_object('ok',true,'coins',r.coins);
end; $$;

create or replace function public.admin_reward_reset(_key_id uuid,_clear_history boolean,_password text) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 perform public._require_admin(_password);
 if _clear_history then delete from public.atlas_reward_claims where key_id=_key_id; end if;
 update public.atlas_rewards set coins=0,last_daily_claim=null,total_claims=0,current_streak=0,best_streak=0,updated_at=now() where key_id=_key_id;
 return jsonb_build_object('ok',true);
end; $$;

create or replace function public.admin_reward_set_streak(_key_id uuid,_current integer,_best integer,_password text) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 perform public._require_admin(_password); insert into public.atlas_rewards(key_id) values(_key_id) on conflict(key_id) do nothing;
 update public.atlas_rewards set current_streak=greatest(0,coalesce(_current,0)),best_streak=greatest(greatest(0,coalesce(_current,0)),greatest(0,coalesce(_best,0))),updated_at=now() where key_id=_key_id;
 return jsonb_build_object('ok',true);
end; $$;

create or replace function public.admin_reward_clear_claims(_key_id uuid,_password text) returns jsonb
language plpgsql security definer set search_path=public as $$
begin perform public._require_admin(_password); delete from public.atlas_reward_claims where key_id=_key_id; return jsonb_build_object('ok',true); end; $$;

grant execute on function public.admin_reward_config(text) to anon,authenticated;
grant execute on function public.admin_reward_list(text) to anon,authenticated;
grant execute on function public.admin_reward_set_config(integer,integer,integer,integer,text) to anon,authenticated;
grant execute on function public.admin_reward_add_coins(uuid,integer,text) to anon,authenticated;
grant execute on function public.admin_reward_set_coins(uuid,integer,text) to anon,authenticated;
grant execute on function public.admin_reward_reset(uuid,boolean,text) to anon,authenticated;
grant execute on function public.admin_reward_set_streak(uuid,integer,integer,text) to anon,authenticated;
grant execute on function public.admin_reward_clear_claims(uuid,text) to anon,authenticated;

-- As funções de usuário passam a usar a configuração do ADM.
create or replace function public.get_daily_reward(_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare k public.access_keys%rowtype; r public.atlas_rewards%rowtype; c public.atlas_reward_config%rowtype; today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 select * into k from public.access_keys where upper(trim(key))=upper(trim(_key)) limit 1;
 if not found then return jsonb_build_object('ok',false,'reason','invalid_key'); end if;
 if k.revoked then return jsonb_build_object('ok',false,'reason','revoked_key'); end if;
 if k.expires_at is not null and k.expires_at<=now() and not k.is_master then return jsonb_build_object('ok',false,'reason','expired_key'); end if;
 select * into r from public.atlas_rewards where key_id=k.id; select * into c from public.atlas_reward_config where id=true;
 return jsonb_build_object('ok',true,'coins',coalesce(r.coins,0),'daily_amount',coalesce(c.daily_amount,10),'goal',coalesce(c.max_coins,100),'claimed_today',coalesce(r.last_daily_claim=today,false),'last_claim',r.last_daily_claim,'total_claims',coalesce(r.total_claims,0),'current_streak',coalesce(r.current_streak,0),'best_streak',coalesce(r.best_streak,0),'claims',coalesce((select jsonb_agg(jsonb_build_object('day',extract(day from arc.claim_date)::int,'date',arc.claim_date,'coins',arc.coins) order by arc.claim_date) from public.atlas_reward_claims arc where arc.key_id=k.id and arc.claim_date>=date_trunc('month',today)::date and arc.claim_date<(date_trunc('month',today)+interval '1 month')::date),'[]'::jsonb));
end; $$;

create or replace function public.claim_daily_reward(_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare k public.access_keys%rowtype; r public.atlas_rewards%rowtype; c public.atlas_reward_config%rowtype; today date := (now() at time zone 'America/Sao_Paulo')::date; new_streak int; new_coins int;
begin
 select * into k from public.access_keys where upper(trim(key))=upper(trim(_key)) and revoked=false and is_master=false and (expires_at is null or expires_at>now()) limit 1;
 if not found then return jsonb_build_object('ok',false,'reason','invalid_key'); end if;
 select * into c from public.atlas_reward_config where id=true; insert into public.atlas_rewards(key_id) values(k.id) on conflict(key_id) do nothing; select * into r from public.atlas_rewards where key_id=k.id for update;
 if r.last_daily_claim=today then return jsonb_build_object('ok',false,'reason','already_claimed','coins',r.coins,'current_streak',r.current_streak,'best_streak',r.best_streak); end if;
 if r.last_daily_claim=today-1 then new_streak:=r.current_streak+1; else new_streak:=1; end if;
 new_coins:=least(r.coins+c.daily_amount,c.max_coins);
 insert into public.atlas_reward_claims(key_id,claim_date,coins) values(k.id,today,c.daily_amount) on conflict(key_id,claim_date) do nothing;
 update public.atlas_rewards set coins=new_coins,last_daily_claim=today,total_claims=total_claims+1,current_streak=new_streak,best_streak=greatest(best_streak,new_streak),updated_at=now() where key_id=k.id returning * into r;
 return jsonb_build_object('ok',true,'coins',r.coins,'last_daily_claim',r.last_daily_claim,'total_claims',r.total_claims,'current_streak',r.current_streak,'best_streak',r.best_streak,'claimed_today',true);
end; $$;

create or replace function public.redeem_atlas_coins(_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare k public.access_keys%rowtype; r public.atlas_rewards%rowtype; c public.atlas_reward_config%rowtype; base timestamptz; expiry timestamptz;
begin
 select * into k from public.access_keys where upper(trim(key))=upper(trim(_key)) and revoked=false and is_master=false and (expires_at is null or expires_at>now()) limit 1;
 if not found then return jsonb_build_object('ok',false,'reason','invalid_key'); end if;
 select * into c from public.atlas_reward_config where id=true; select * into r from public.atlas_rewards where key_id=k.id for update;
 if not found or r.coins<c.redeem_cost then return jsonb_build_object('ok',false,'reason','insufficient_coins','coins',coalesce(r.coins,0)); end if;
 base:=greatest(coalesce(k.expires_at,now()),now()); expiry:=base+(c.redeem_days||' days')::interval;
 update public.access_keys set expires_at=expiry where id=k.id; update public.atlas_rewards set coins=r.coins-c.redeem_cost,updated_at=now() where key_id=k.id;
 return jsonb_build_object('ok',true,'coins',r.coins-c.redeem_cost,'reward_days',c.redeem_days,'expires_at',expiry);
end; $$;