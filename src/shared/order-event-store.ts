import { isMissingSupabaseTableError } from "./admin-settings";
import { normalizeOrderEvent } from "./order-events";
import type { OrderEventItem } from "./types";

type SupabaseLike = {
  from: (table: string) => any;
};

export async function upsertOrderEvents(
  supabase: SupabaseLike,
  events: Array<{
    event_key: string;
    order_retailcrm_id: number;
    event_type: string;
    event_source: string;
    event_at: string;
    actor_label: string | null;
    payload: Record<string, unknown>;
  }>,
) {
  if (!events.length) {
    return {
      available: true,
    };
  }

  const { error } = await supabase.from("order_events").upsert(events, {
    onConflict: "event_key",
    ignoreDuplicates: true,
  });

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      return {
        available: false,
      };
    }

    throw new Error(error.message ?? "Failed to persist order events");
  }

  return {
    available: true,
  };
}

export async function loadOrderEvents(
  supabase: SupabaseLike,
  options: {
    orderIds?: number[];
    limit?: number;
  } = {},
) {
  if (options.orderIds && options.orderIds.length === 0) {
    return {
      available: true,
      rows: [] as OrderEventItem[],
    };
  }

  let query = supabase
    .from("order_events")
    .select("id, event_key, order_retailcrm_id, event_type, event_source, event_at, actor_label, payload, created_at")
    .order("event_at", { ascending: false });

  if (options.orderIds?.length) {
    query = query.in("order_retailcrm_id", options.orderIds);
  }

  if (options.limit != null) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      return {
        available: false,
        rows: [] as OrderEventItem[],
      };
    }

    throw new Error(error.message ?? "Failed to load order events");
  }

  return {
    available: true,
    rows: (data ?? []).map((row: Record<string, unknown>) => normalizeOrderEvent(row)),
  };
}
