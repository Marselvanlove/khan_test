export const RETAILCRM_SYNC_LOCK_KEY = 2026041401;

interface RpcCapableClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
}

export async function acquireRetailCrmSyncLock(
  supabase: RpcCapableClient,
  lockKey = RETAILCRM_SYNC_LOCK_KEY,
) {
  const { data, error } = await supabase.rpc("acquire_sync_lock", {
    lock_key: lockKey,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to acquire sync lock");
  }

  return data === true;
}

export async function releaseRetailCrmSyncLock(
  supabase: RpcCapableClient,
  lockKey = RETAILCRM_SYNC_LOCK_KEY,
) {
  const { error } = await supabase.rpc("release_sync_lock", {
    lock_key: lockKey,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to release sync lock");
  }
}
