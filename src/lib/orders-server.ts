import { createSupabaseServerClient } from "./supabase-server";
import { DEFAULT_ADMIN_SETTINGS, isMissingSupabaseTableError, normalizeAdminSettings } from "@/shared/admin-settings";
import { buildOperationalTouchIndex } from "@/shared/order-events";
import { loadOrderEvents } from "@/shared/order-event-store";
import { buildSignedManagerLink } from "@/shared/order-links";
import { isMissingSupabaseColumnError } from "@/shared/supabase-compat";
import {
  buildOperationalOrderRowFromRecord,
  normalizeRetailCrmOrder,
} from "@/shared/orders";
import { createRetailCrmClient } from "@/shared/retailcrm";
import type {
  AdminSettings,
  OperationalOrderRow,
  OrderRecordInput,
  RetailCrmOrderResponse,
} from "@/shared/types";

type OrderRowRecord = Record<string, unknown> & {
  raw_payload: RetailCrmOrderResponse;
};

function isLoopbackBaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function resolveAppBaseUrl(headerValues?: Headers) {
  const envValue = process.env.APP_BASE_URL?.trim();

  if (envValue && !isLoopbackBaseUrl(envValue)) {
    return envValue.replace(/\/+$/, "");
  }

  if (headerValues) {
    const host = headerValues.get("x-forwarded-host") ?? headerValues.get("host");

    if (host) {
      const protocol = headerValues.get("x-forwarded-proto") ?? "https";

      return `${protocol}://${host}`;
    }
  }

  return envValue ? envValue.replace(/\/+$/, "") : null;
}

export async function loadServerAdminSettings(): Promise<AdminSettings> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return DEFAULT_ADMIN_SETTINGS;
  }

  const { data, error } = await supabase
    .from("admin_settings")
    .select(
      "singleton_key, notifications_enabled, high_value_enabled, high_value_threshold, missing_contact_enabled, unknown_source_enabled, cancelled_enabled, working_hours_enabled, workday_start_hour, workday_end_hour, timezone",
    )
    .eq("singleton_key", "default")
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      return DEFAULT_ADMIN_SETTINGS;
    }

    throw error;
  }

  return data ? normalizeAdminSettings(data as Record<string, unknown>) : DEFAULT_ADMIN_SETTINGS;
}

export async function loadOrderSnapshotByRetailCrmId(retailcrmId: number) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    throw new Error("SUPABASE_URL и SUPABASE_SECRET_KEY нужны для чтения заказа.");
  }

  let result = await supabase
    .from("orders")
    .select("retailcrm_id, external_id, customer_name, phone, email, city, total_amount, created_at, updated_at, synced_at, last_seen_in_retailcrm_at, sync_state, status, utm_source, telegram_notified_at, raw_payload")
    .eq("retailcrm_id", retailcrmId)
    .maybeSingle();

  if (
    result.error &&
    (isMissingSupabaseColumnError(result.error, "synced_at") ||
      isMissingSupabaseColumnError(result.error, "last_seen_in_retailcrm_at") ||
      isMissingSupabaseColumnError(result.error, "sync_state"))
  ) {
    result = await supabase
      .from("orders")
      .select("retailcrm_id, external_id, customer_name, phone, email, city, total_amount, created_at, updated_at, status, utm_source, telegram_notified_at, raw_payload")
      .eq("retailcrm_id", retailcrmId)
      .maybeSingle();
  }

  const { data, error } = result;

  if (error) {
    throw error;
  }

  return (data as OrderRowRecord | null) ?? null;
}

async function loadLiveRetailCrmOrder(retailcrmId: number) {
  const baseUrl = process.env.RETAILCRM_BASE_URL?.trim();
  const apiKey = process.env.RETAILCRM_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return null;
  }

  const retailCrm = createRetailCrmClient({
    baseUrl,
    apiKey,
    defaultSite: process.env.RETAILCRM_SITE_CODE?.trim(),
  });

  try {
    return await retailCrm.getOrder(retailcrmId, { by: "id" });
  } catch {
    return null;
  }
}

export async function loadOrderPresentation(
  retailcrmId: number,
  options: {
    baseUrl?: string | null;
  } = {},
): Promise<{
  adminSettings: AdminSettings;
  order: OperationalOrderRow;
  rawOrder: RetailCrmOrderResponse;
  snapshotRow: OrderRowRecord;
  source: "retailcrm" | "snapshot";
}> {
  const snapshotRow = await loadOrderSnapshotByRetailCrmId(retailcrmId);

  if (!snapshotRow) {
    throw new Error("Заказ не найден в Supabase.");
  }

  const [adminSettings, liveOrder] = await Promise.all([
    loadServerAdminSettings(),
    loadLiveRetailCrmOrder(retailcrmId),
  ]);
  const supabase = createSupabaseServerClient();
  const eventsResult = supabase
    ? await loadOrderEvents(supabase as never, {
        orderIds: [retailcrmId],
      }).catch(() => ({
        available: false,
        rows: [],
      }))
    : { available: false, rows: [] };
  const touchState = buildOperationalTouchIndex(
    [
      {
        retailcrm_id: retailcrmId,
        created_at: String(snapshotRow.created_at),
      },
    ],
    eventsResult.rows,
  ).get(retailcrmId);
  const linkSigningSecret = process.env.LINK_SIGNING_SECRET?.trim();
  const retailCrmBaseUrl = process.env.RETAILCRM_BASE_URL?.trim() ?? null;
  const managerUrl = linkSigningSecret
    ? (
        await buildSignedManagerLink({
          retailcrmId,
          secret: linkSigningSecret,
          baseUrl: options.baseUrl ?? null,
        })
      ).path
    : null;

  if (!liveOrder) {
    return {
      adminSettings,
      order: buildOperationalOrderRowFromRecord(snapshotRow, {
        retailCrmBaseUrl,
        managerUrl,
        firstTouchAt: touchState?.first_touch_at ?? null,
        firstTouchSource: touchState?.first_touch_source ?? null,
        firstTouchMinutes: touchState?.first_touch_minutes ?? null,
      }),
      rawOrder: snapshotRow.raw_payload,
      snapshotRow,
      source: "snapshot",
    };
  }

  const normalizedLive = normalizeRetailCrmOrder(liveOrder, {
    utmFieldCode: process.env.RETAILCRM_UTM_FIELD_CODE?.trim(),
  });
  const mergedRow: Record<string, unknown> = {
    ...normalizedLive,
    telegram_notified_at: snapshotRow.telegram_notified_at ?? null,
    synced_at: new Date().toISOString(),
    last_seen_in_retailcrm_at: new Date().toISOString(),
    sync_state: "synced",
    raw_payload: liveOrder,
  };

  return {
    adminSettings,
    order: buildOperationalOrderRowFromRecord(mergedRow, {
      retailCrmBaseUrl,
      managerUrl,
      firstTouchAt: touchState?.first_touch_at ?? null,
      firstTouchSource: touchState?.first_touch_source ?? null,
      firstTouchMinutes: touchState?.first_touch_minutes ?? null,
    }),
    rawOrder: liveOrder,
    snapshotRow,
    source: "retailcrm",
  };
}

export async function updateOrderSnapshotAfterCompletion(params: {
  retailcrmId: number;
  rawOrder: RetailCrmOrderResponse;
}) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    throw new Error("SUPABASE_URL и SUPABASE_SECRET_KEY нужны для обновления заказа.");
  }

  const normalized = normalizeRetailCrmOrder(params.rawOrder, {
    utmFieldCode: process.env.RETAILCRM_UTM_FIELD_CODE?.trim(),
    syncedAt: new Date().toISOString(),
  });
  let result = await supabase
    .from("orders")
    .update({
      customer_name: normalized.customer_name,
      phone: normalized.phone,
      email: normalized.email,
      city: normalized.city,
      utm_source: normalized.utm_source,
      status: normalized.status,
      item_count: normalized.item_count,
      total_amount: normalized.total_amount,
      created_at: normalized.created_at,
      updated_at: normalized.updated_at,
      synced_at: normalized.synced_at,
      last_seen_in_retailcrm_at: normalized.last_seen_in_retailcrm_at,
      sync_state: "synced",
      raw_payload: params.rawOrder,
    })
    .eq("retailcrm_id", params.retailcrmId);

  if (
    result.error &&
    (isMissingSupabaseColumnError(result.error, "synced_at") ||
      isMissingSupabaseColumnError(result.error, "last_seen_in_retailcrm_at") ||
      isMissingSupabaseColumnError(result.error, "sync_state"))
  ) {
    result = await supabase
      .from("orders")
      .update({
        customer_name: normalized.customer_name,
        phone: normalized.phone,
        email: normalized.email,
        city: normalized.city,
        utm_source: normalized.utm_source,
        status: normalized.status,
        item_count: normalized.item_count,
        total_amount: normalized.total_amount,
        created_at: normalized.created_at,
        updated_at: normalized.updated_at,
        raw_payload: params.rawOrder,
      })
      .eq("retailcrm_id", params.retailcrmId);
  }

  const { error } = result;

  if (error) {
    throw error;
  }
}

export async function updateOrderSnapshotFromRetailCrm(params: {
  retailcrmId: number;
  rawOrder: RetailCrmOrderResponse;
}) {
  await updateOrderSnapshotAfterCompletion(params);
}
