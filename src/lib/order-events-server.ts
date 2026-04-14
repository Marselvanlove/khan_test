import { createSupabaseServerClient } from "./supabase-server";
import { loadOrderEvents, upsertOrderEvents } from "@/shared/order-event-store";
import type { OrderEventItem } from "@/shared/types";

export async function recordServerOrderEvents(
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
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return {
      available: false,
    };
  }

  return upsertOrderEvents(supabase as never, events);
}

export async function loadServerOrderEvents(options: {
  orderIds?: number[];
  limit?: number;
} = {}) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return {
      available: false,
      rows: [] as OrderEventItem[],
    };
  }

  return loadOrderEvents(supabase as never, options);
}
