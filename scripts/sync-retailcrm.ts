import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  formatTelegramMessage,
  HIGH_VALUE_THRESHOLD,
  normalizeRetailCrmOrder,
} from "../src/shared/orders";
import { createRetailCrmClient } from "../src/shared/retailcrm";
import type { OrderRecordInput } from "../src/shared/types";

const TELEGRAM_DELAY_MS = 450;
const TELEGRAM_MAX_ATTEMPTS = 5;

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

async function sendTelegramMessageWithRetry(
  botToken: string,
  chatId: string,
  payload: {
    retailcrm_id: number;
    external_id: string | null;
    customer_name: string;
    city: string | null;
    total_amount: number;
    created_at: string;
    utm_source: string | null;
  },
) {
  for (let attempt = 1; attempt <= TELEGRAM_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramMessage(payload),
      }),
    });

    if (response.ok) {
      return;
    }

    const errorPayload = await response.json().catch(() => null);
    const retryAfter = Number(errorPayload?.parameters?.retry_after ?? 1);

    if (response.status === 429 && attempt < TELEGRAM_MAX_ATTEMPTS) {
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

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
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    console.log("Telegram credentials are missing, skip notifications.");
    return;
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select("retailcrm_id, external_id, customer_name, city, total_amount, created_at, utm_source")
    .gt("total_amount", HIGH_VALUE_THRESHOLD)
    .is("telegram_notified_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    await sendTelegramMessageWithRetry(botToken, chatId, {
      retailcrm_id: Number(row.retailcrm_id),
      external_id: row.external_id ? String(row.external_id) : null,
      customer_name: String(row.customer_name),
      city: row.city ? String(row.city) : null,
      total_amount: Number(row.total_amount),
      created_at: String(row.created_at),
      utm_source: row.utm_source ? String(row.utm_source) : null,
    });

    const { error: updateError } = await supabase
      .from("orders")
      .update({ telegram_notified_at: new Date().toISOString() })
      .eq("retailcrm_id", row.retailcrm_id);

    if (updateError) {
      throw updateError;
    }

    await sleep(TELEGRAM_DELAY_MS);
  }

  console.log(`Telegram notifications sent: ${(data ?? []).length}`);
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
