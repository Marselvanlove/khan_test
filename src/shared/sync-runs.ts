import { isMissingSupabaseTableError } from "./admin-settings";
import type { SyncRunItem } from "./types";

type SupabaseLike = {
  from: (table: string) => any;
};

function normalizeMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeSyncRun(row: Record<string, unknown>): SyncRunItem {
  return {
    id: String(row.id),
    source: String(row.source ?? "retailcrm-poll"),
    status: String(row.status ?? "running") as SyncRunItem["status"],
    started_at: String(row.started_at),
    finished_at: row.finished_at ? String(row.finished_at) : null,
    fetched_orders_count: Number(row.fetched_orders_count ?? 0),
    upserted_orders_count: Number(row.upserted_orders_count ?? 0),
    created_orders_count: Number(row.created_orders_count ?? 0),
    changed_orders_count: Number(row.changed_orders_count ?? 0),
    missing_in_retailcrm_count: Number(row.missing_in_retailcrm_count ?? 0),
    notification_events_count: Number(row.notification_events_count ?? 0),
    error_message: row.error_message ? String(row.error_message) : null,
    metadata: normalizeMetadata(row.metadata),
  };
}

export async function createSyncRun(
  supabase: SupabaseLike,
  payload: {
    source: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      source: payload.source,
      status: "running",
      metadata: payload.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create sync run");
  }

  return normalizeSyncRun(data);
}

export async function finishSyncRun(
  supabase: SupabaseLike,
  runId: string,
  payload: Partial<{
    status: SyncRunItem["status"];
    finished_at: string;
    fetched_orders_count: number;
    upserted_orders_count: number;
    created_orders_count: number;
    changed_orders_count: number;
    missing_in_retailcrm_count: number;
    notification_events_count: number;
    error_message: string | null;
    metadata: Record<string, unknown>;
  }>,
) {
  const { error } = await supabase
    .from("sync_runs")
    .update(payload)
    .eq("id", runId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadLatestSyncRun(supabase: SupabaseLike) {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      return {
        available: false,
        run: null as SyncRunItem | null,
      };
    }

    throw new Error(error.message ?? "Failed to load latest sync run");
  }

  return {
    available: true,
    run: data ? normalizeSyncRun(data as Record<string, unknown>) : null,
  };
}
