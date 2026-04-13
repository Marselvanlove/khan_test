import { createClient } from "npm:@supabase/supabase-js@2";
import {
  extractOrderNumber,
  formatTelegramMessage,
  HIGH_VALUE_THRESHOLD,
  normalizeRetailCrmOrder,
} from "../../../src/shared/orders.ts";
import { createRetailCrmClient } from "../../../src/shared/retailcrm.ts";
import type { OrderRecordInput } from "../../../src/shared/types.ts";

const TELEGRAM_DELAY_MS = 450;
const TELEGRAM_MAX_ATTEMPTS = 5;
let notificationLogAvailable = true;

function readRequiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value?.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value.trim();
}

function createSupabaseAdmin() {
  return createClient(readRequiredEnv("SUPABASE_URL"), readRequiredEnv("SUPABASE_SECRET_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

  const { error } = await supabase.from("notification_logs").insert(entry);

  if (error) {
    if (error.code === "PGRST205" || error.message.includes("Could not find the table")) {
      notificationLogAvailable = false;
      return;
    }

    console.error("Notification audit log failed:", error.message);
  }
}

async function sendTelegramMessageWithRetry(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  botToken: string,
  chatId: string,
  payload: {
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

  for (let attempt = 1; attempt <= TELEGRAM_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramMessage(payload),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (response.ok) {
      await recordNotificationLog(supabase, {
        order_retailcrm_id: payload.retailcrm_id,
        order_number: orderNumber,
        channel: "telegram",
        recipient: chatId,
        status: "sent",
        attempt,
        rate_limited: false,
        error_message: null,
        payload_preview: formatTelegramMessage(payload),
        delivered_at: new Date().toISOString(),
      });
      return;
    }

    const errorPayload = await response.json().catch(() => null);
    const retryAfter = Number(errorPayload?.parameters?.retry_after ?? 1);

    if (response.status === 429 && attempt < TELEGRAM_MAX_ATTEMPTS) {
      await recordNotificationLog(supabase, {
        order_retailcrm_id: payload.retailcrm_id,
        order_number: orderNumber,
        channel: "telegram",
        recipient: chatId,
        status: "rate_limited",
        attempt,
        rate_limited: true,
        error_message: errorPayload?.description ?? "Telegram rate limit",
        payload_preview: formatTelegramMessage(payload),
        delivered_at: null,
      });
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

    await recordNotificationLog(supabase, {
      order_retailcrm_id: payload.retailcrm_id,
      order_number: orderNumber,
      channel: "telegram",
      recipient: chatId,
      status: "failed",
      attempt,
      rate_limited: response.status === 429,
      error_message: errorPayload?.description ?? `HTTP ${response.status}`,
      payload_preview: formatTelegramMessage(payload),
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

async function sendTelegramNotifications() {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID")?.trim();

  if (!botToken || !chatId) {
    return 0;
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select("retailcrm_id, external_id, customer_name, phone, email, city, total_amount, created_at, utm_source, raw_payload")
    .gt("total_amount", HIGH_VALUE_THRESHOLD)
    .is("telegram_notified_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  let sentCount = 0;

  for (const row of data ?? []) {
    await sendTelegramMessageWithRetry(supabase, botToken, chatId, {
      retailcrm_id: Number(row.retailcrm_id),
      external_id: row.external_id ? String(row.external_id) : null,
      customer_name: String(row.customer_name),
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      city: row.city ? String(row.city) : null,
      total_amount: Number(row.total_amount),
      created_at: String(row.created_at),
      utm_source: row.utm_source ? String(row.utm_source) : null,
      retailcrm_base_url: Deno.env.get("RETAILCRM_BASE_URL")?.trim() ?? null,
      raw_payload: row.raw_payload as OrderRecordInput["raw_payload"],
    });

    const { error: updateError } = await supabase
      .from("orders")
      .update({ telegram_notified_at: new Date().toISOString() })
      .eq("retailcrm_id", row.retailcrm_id);

    if (updateError) {
      throw updateError;
    }

    sentCount += 1;
    await sleep(TELEGRAM_DELAY_MS);
  }

  return sentCount;
}

Deno.serve(async (request) => {
  try {
    const expectedSecret = readRequiredEnv("SYNC_ENDPOINT_SECRET");
    const actualSecret = request.headers.get("x-sync-secret");

    if (actualSecret !== expectedSecret) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const retailCrm = createRetailCrmClient({
      baseUrl: readRequiredEnv("RETAILCRM_BASE_URL"),
      apiKey: readRequiredEnv("RETAILCRM_API_KEY"),
      defaultSite: Deno.env.get("RETAILCRM_SITE_CODE")?.trim(),
    });

    const orders = await retailCrm.listAllOrders({
      siteCode: Deno.env.get("RETAILCRM_SITE_CODE")?.trim(),
      limit: 100,
    });

    const records = orders.map((order) =>
      normalizeRetailCrmOrder(order, { utmFieldCode: Deno.env.get("RETAILCRM_UTM_FIELD_CODE")?.trim() }),
    );

    await upsertOrders(records);
    const notified = await sendTelegramNotifications();

    return new Response(
      JSON.stringify({
        ok: true,
        syncedOrders: records.length,
        telegramNotificationsSent: notified,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
