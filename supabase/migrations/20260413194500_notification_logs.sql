create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  order_retailcrm_id bigint not null,
  order_number text,
  channel text not null,
  recipient text,
  status text not null,
  attempt integer not null default 1,
  rate_limited boolean not null default false,
  error_message text,
  payload_preview text,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notification_logs_order_idx on public.notification_logs (order_retailcrm_id, created_at desc);
create index if not exists notification_logs_status_idx on public.notification_logs (status, created_at desc);

alter table public.notification_logs enable row level security;

comment on table public.notification_logs is 'Audit log for outbound manager notifications.';
