create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null unique default 'default',
  notifications_enabled boolean not null default true,
  high_value_enabled boolean not null default true,
  high_value_threshold numeric(12, 2) not null default 50000,
  missing_contact_enabled boolean not null default true,
  unknown_source_enabled boolean not null default false,
  cancelled_enabled boolean not null default false,
  working_hours_enabled boolean not null default true,
  workday_start_hour integer not null default 10 check (workday_start_hour between 0 and 23),
  workday_end_hour integer not null default 19 check (workday_end_hour between 1 and 24),
  timezone text not null default 'Asia/Almaty',
  inserted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (workday_end_hour > workday_start_hour)
);

insert into public.admin_settings (singleton_key)
values ('default')
on conflict (singleton_key) do nothing;

alter table public.admin_settings enable row level security;

comment on table public.admin_settings is 'Singleton table with manager bot notification rules and working hours.';

alter table if exists public.notification_logs
  add column if not exists event_type text not null default 'high-value';

create index if not exists notification_logs_event_type_idx
  on public.notification_logs (event_type, status, created_at desc);

comment on column public.notification_logs.event_type is 'Alert type: high-value, missing-contact, unknown-source, cancelled.';
