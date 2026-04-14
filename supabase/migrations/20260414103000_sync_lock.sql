create or replace function public.acquire_sync_lock(lock_key bigint)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select pg_try_advisory_lock(lock_key);
$$;

create or replace function public.release_sync_lock(lock_key bigint)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select pg_advisory_unlock(lock_key);
$$;

revoke all on function public.acquire_sync_lock(bigint) from public;
revoke all on function public.release_sync_lock(bigint) from public;

grant execute on function public.acquire_sync_lock(bigint) to service_role;
grant execute on function public.release_sync_lock(bigint) to service_role;

comment on function public.acquire_sync_lock(bigint) is 'Prevents overlapping RetailCRM sync runs.';
comment on function public.release_sync_lock(bigint) is 'Releases advisory lock for RetailCRM sync.';
