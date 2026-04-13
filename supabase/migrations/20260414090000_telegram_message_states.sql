create table if not exists public.telegram_message_states (
  id uuid primary key default gen_random_uuid(),
  order_retailcrm_id bigint not null,
  chat_id text not null,
  message_id bigint,
  alert_types text[] not null default '{}',
  status text not null default 'sent'
    check (status in ('sent', 'confirming', 'completed')),
  completed_at timestamptz,
  completed_by_user_id bigint,
  completed_by_username text,
  crm_status_before text,
  crm_status_after text,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists telegram_message_states_chat_message_uidx
  on public.telegram_message_states (chat_id, message_id)
  where message_id is not null;

create index if not exists telegram_message_states_order_idx
  on public.telegram_message_states (order_retailcrm_id, created_at desc);

create index if not exists telegram_message_states_status_idx
  on public.telegram_message_states (status, created_at desc);

alter table public.telegram_message_states enable row level security;

comment on table public.telegram_message_states is
  'Tracks Telegram inline-message workflow for order notifications.';
