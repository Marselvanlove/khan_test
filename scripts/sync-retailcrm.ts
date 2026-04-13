import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  buildNotificationEventKey,
  formatWorkingWindow,
  getAlertTypesForOrder,
  getEnabledAlertTypes,
  isMissingSupabaseTableError,
  isNotificationWindowOpen,
  normalizeAdminSettings,
} from "../src/shared/admin-settings";
import {
  extractOrderNumber,
  formatTelegramMessage,
  getStatusMeta,
  normalizeRetailCrmOrder,
} from "../src/shared/orders";
import { createRetailCrmClient } from "../src/shared/retailcrm";
import type { AdminSettings, NotificationAlertType, OrderRecordInput } from "../src/shared/types";

const TELEGRAM_DELAY_MS = 450;
const TELEGRAM_MAX_ATTEMPTS = 5;
let notificationLogAvailable = true;

function isMissingNotificationLogColumn(
  error: { message?: string | null; code?: string | null } | null | undefined,
) {
  return (
    error?.message?.includes("event_type") === true ||
    error?.message?.includes("Could not find the 'event_type' column") === true ||
    error?.code === "PGRST204"
  );
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value.trim();
}

function createSupabaseAdmin() {
  return createClient(
    readRequiredEnv("SUPABASE_URL"),
    readRequiredEnv("SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordNotificationLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  entry: {
    event_types: NotificationAlertType[];
    order_retailcrm_id: number;
    order_number: string;
    channel: string;
    recipient: string;
    status: string;
    attempt: number;
    rate_limited: boolean;
    error_message: string | null;
    payload_preview: string;
    delivered_at?: string | null;
  },
) {
  if (!notificationLogAvailable) {
    return;
  }

  const rows = entry.event_types.map((eventType) => ({
    order_retailcrm_id: entry.order_retailcrm_id,
    order_number: entry.order_number,
    event_type: eventType,
    channel: entry.channel,
    recipient: entry.recipient,
    status: entry.status,
    attempt: entry.attempt,
    rate_limited: entry.rate_limited,
    error_message: entry.error_message,
    payload_preview: entry.payload_preview,
    delivered_at: entry.delivered_at ?? null,
  }));

  const { error } = await supabase.from("notification_logs").insert(rows);

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      notificationLogAvailable = false;
      return;
    }

    if (isMissingNotificationLogColumn(error)) {
      const legacyRows = rows.map(({ event_type: _eventType, ...row }) => row);
      const legacyResult = await supabase.from("notification_logs").insert(legacyRows);

      if (!legacyResult.error) {
        return;
      }
    }

    console.error("Notification audit log failed:", error.message);
  }
}

async function sendTelegramMessageWithRetry(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  botToken: string,
  chatId: string,
  payload: {
    alert_types: NotificationAlertType[];
    retailcrm_id: number;
    external_id: string | null;
    customer_name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    total_amount: number;
    created_at: string;
    utm_source: string | null;
    retailcrm_base_url?: string | null;
    raw_payload: OrderRecordInput["raw_payload"];
  },
) {
  const orderNumber = extractOrderNumber(payload.raw_payload, payload.external_id);
  const messageText = formatTelegramMessage(payload);

  for (let attempt = 1; attempt <= TELEGRAM_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (response.ok) {
      await recordNotificationLog(supabase, {
        event_types: payload.alert_types,
        order_retailcrm_id: payload.retailcrm_id,
        order_number: orderNumber,
        channel: "telegram",
        recipient: chatId,
        status: "sent",
        attempt,
        rate_limited: false,
        error_message: null,
        payload_preview: messageText,
        delivered_at: new Date().toISOString(),
      });
      return;
    }

    const errorPayload = await response.json().catch(() => null);
    const retryAfter = Number(errorPayload?.parameters?.retry_after ?? 1);

    if (response.status === 429 && attempt < TELEGRAM_MAX_ATTEMPTS) {
      await recordNotificationLog(supabase, {
        event_types: payload.alert_types,
        order_retailcrm_id: payload.retailcrm_id,
        order_number: orderNumber,
        channel: "telegram",
        recipient: chatId,
        status: "rate_limited",
        attempt,
        rate_limited: true,
        error_message: errorPayload?.description ?? "Telegram rate limit",
        payload_preview: messageText,
        delivered_at: null,
      });
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

    await recordNotificationLog(supabase, {
      event_types: payload.alert_types,
      order_retailcrm_id: payload.retailcrm_id,
      order_number: orderNumber,
      channel: "telegram",
      recipient: chatId,
      status: "failed",
      attempt,
      rate_limited: response.status === 429,
      error_message: errorPayload?.description ?? `HTTP ${response.status}`,
      payload_preview: messageText,
      delivered_at: null,
    });

    throw new Error(
      `Telegram sendMessage failed with ${response.status}${
        errorPayload?.description ? `: ${errorPayload.description}` : ""
      }`,
    );
  }
}

async function upsertOrders(records: OrderRecordInput[]) {
  const supabase = createSupabaseAdmin();

  for (const group of chunk(records, 200)) {
    const { error } = await supabase.from("orders").upsert(group, {
      onConflict: "retailcrm_id",
    });

    if (error) {
      throw error;
    }
  }
}

async function loadAdminSettings(supabase: ReturnType<typeof createSupabaseAdmin>): Promise<AdminSettings> {
  const { data, error } = await supabase
    .from("admin_settings")
    .select(
      "singleton_key, notifications_enabled, high_value_enabled, high_value_threshold, missing_contact_enabled, unknown_source_enabled, cancelled_enabled, working_hours_enabled, workday_start_hour, workday_end_hour, timezone",
    )
    .eq("singleton_key", "default")
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      return normalizeAdminSettings(null);
    }

    throw error;
  }

  return normalizeAdminSettings(data as Record<string, unknown>);
}

async function sendTelegramNotifications() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    console.log("Telegram credentials are missing, skip notifications.");
    return;
  }

  const supabase = createSupabaseAdmin();
  const settings = await loadAdminSettings(supabase);
  const enabledAlertTypes = getEnabledAlertTypes(settings);

  if (!enabledAlertTypes.length || !settings.notifications_enabled) {
    console.log("Notification rules are disabled, skip notifications.");
    return;
  }

  if (!isNotificationWindowOpen(settings)) {
    console.log(`Outside notification window (${formatWorkingWindow(settings)}), skip notifications.`);
    return;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("retailcrm_id, external_id, customer_name, phone, email, city, total_amount, created_at, status, utm_source, telegram_notified_at, raw_payload")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  let sentAlertKeys = new Set<string>();

  if (notificationLogAvailable) {
    const { data: sentLogs, error: sentLogsError } = await supabase
      .from("notification_logs")
      .select("order_retailcrm_id, event_type, status")
      .eq("status", "sent")
      .in("event_type", enabledAlertTypes);

    if (sentLogsError) {
      if (isMissingSupabaseTableError(sentLogsError)) {
        notificationLogAvailable = false;
      } else {
        throw sentLogsError;
      }
    } else {
      sentAlertKeys = new Set(
        (sentLogs ?? []).map((row) =>
          buildNotificationEventKey(
            Number(row.order_retailcrm_id),
            String(row.event_type ?? "high-value") as NotificationAlertType,
          ),
        ),
      );
    }
  }

  for (const row of data ?? []) {
    const missingContact = !row.phone && !row.email;
    const statusMeta = getStatusMeta(row.status ? String(row.status) : null);
    const nextAlertTypes = getAlertTypesForOrder(
      {
        total_amount: Number(row.total_amount),
        missing_contact: missingContact,
        unknown_source: !row.utm_source,
        status_group: statusMeta.group,
      },
      settings,
    ).filter((eventType) => {
      if (!notificationLogAvailable) {
        return !row.telegram_notified_at;
      }

      return !sentAlertKeys.has(buildNotificationEventKey(Number(row.retailcrm_id), eventType));
    });

    if (!nextAlertTypes.length) {
      continue;
    }

    await sendTelegramMessageWithRetry(supabase, botToken, chatId, {
      alert_types: nextAlertTypes,
      retailcrm_id: Number(row.retailcrm_id),
      external_id: row.external_id ? String(row.external_id) : null,
      customer_name: String(row.customer_name),
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      city: row.city ? String(row.city) : null,
      total_amount: Number(row.total_amount),
      created_at: String(row.created_at),
      utm_source: row.utm_source ? String(row.utm_source) : null,
      retailcrm_base_url: process.env.RETAILCRM_BASE_URL?.trim() ?? null,
      raw_payload: row.raw_payload as OrderRecordInput["raw_payload"],
    });

    const { error: updateError } = await supabase
      .from("orders")
      .update({ telegram_notified_at: new Date().toISOString() })
      .eq("retailcrm_id", row.retailcrm_id);

    if (updateError) {
      throw updateError;
    }

    nextAlertTypes.forEach((eventType) => {
      sentAlertKeys.add(buildNotificationEventKey(Number(row.retailcrm_id), eventType));
    });

    await sleep(TELEGRAM_DELAY_MS);
  }

  console.log(`Telegram notifications checked for ${String((data ?? []).length)} orders.`);
}

async function main() {
  const retailCrm = createRetailCrmClient({
    baseUrl: readRequiredEnv("RETAILCRM_BASE_URL"),
    apiKey: readRequiredEnv("RETAILCRM_API_KEY"),
    defaultSite: process.env.RETAILCRM_SITE_CODE?.trim(),
  });

  const orders = await retailCrm.listAllOrders({
    siteCode: process.env.RETAILCRM_SITE_CODE?.trim(),
    limit: 100,
  });

  const records = orders.map((order) =>
    normalizeRetailCrmOrder(order, { utmFieldCode: process.env.RETAILCRM_UTM_FIELD_CODE }),
  );

  await upsertOrders(records);
  await sendTelegramNotifications();

  console.log(`Synced orders: ${records.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
