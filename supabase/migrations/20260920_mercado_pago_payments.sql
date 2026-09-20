create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  key_id uuid references public.access_keys(id) on delete set null,
  key text not null,
  plan text not null check (plan in ('basic', 'pro', 'master')),
  preference_id text,
  payment_id text unique,
  amount numeric(10,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders enable row level security;