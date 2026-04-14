alter table if exists public.orders
  add column if not exists synced_at timestamptz,
  add column if not exists last_seen_in_retailcrm_at timestamptz,
  add column if not exists sync_state text not null default 'synced';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_sync_state_check'
  ) then
    alter table public.orders
      add constraint orders_sync_state_check
      check (sync_state in ('synced', 'missing_in_retailcrm'));
  end if;
end $$;

update public.orders
set
  synced_at = coalesce(synced_at, timezone('utc', now())),
  last_seen_in_retailcrm_at = coalesce(last_seen_in_retailcrm_at, timezone('utc', now())),
  sync_state = coalesce(sync_state, 'synced');

create index if not exists orders_sync_state_idx
  on public.orders (sync_state, last_seen_in_retailcrm_at desc);

create index if not exists orders_synced_at_idx
  on public.orders (synced_at desc);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  order_retailcrm_id bigint not null,
  event_type text not null,
  event_source text not null,
  event_at timestamptz not null,
  actor_label text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists order_events_order_idx
  on public.order_events (order_retailcrm_id, event_at desc);

create index if not exists order_events_type_idx
  on public.order_events (event_type, event_at desc);

alter table public.order_events enable row level security;

comment on table public.order_events is
  'Operational and sync event stream for RetailCRM orders.';

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'retailcrm-poll',
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  fetched_orders_count integer not null default 0,
  upserted_orders_count integer not null default 0,
  created_orders_count integer not null default 0,
  changed_orders_count integer not null default 0,
  missing_in_retailcrm_count integer not null default 0,
  notification_events_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists sync_runs_started_at_idx
  on public.sync_runs (started_at desc);

alter table public.sync_runs enable row level security;

comment on table public.sync_runs is
  'Audit trail for RetailCRM synchronization runs and reconciliation health.';
