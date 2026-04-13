create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  retailcrm_id bigint not null unique,
  external_id text unique,
  customer_name text not null,
  phone text,
  email text,
  city text,
  utm_source text,
  status text,
  item_count integer not null default 0,
  total_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  telegram_notified_at timestamptz,
  raw_payload jsonb not null,
  inserted_at timestamptz not null default timezone('utc', now())
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_total_amount_idx on public.orders (total_amount desc);
create index if not exists orders_telegram_pending_idx on public.orders (telegram_notified_at, total_amount);

alter table public.orders enable row level security;

create or replace view public.daily_order_metrics as
select
  date_trunc('day', created_at)::date as order_date,
  count(*)::int as orders_count,
  sum(total_amount)::numeric(12, 2) as revenue,
  sum(case when total_amount > 50000 then 1 else 0 end)::int as high_value_orders
from public.orders
group by 1
order by 1;

comment on table public.orders is 'Orders synchronized from RetailCRM.';
comment on view public.daily_order_metrics is 'Aggregated daily metrics for the dashboard chart.';

