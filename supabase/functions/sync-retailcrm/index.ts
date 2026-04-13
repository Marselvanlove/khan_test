import { createClient } from "npm:@supabase/supabase-js@2";
import {
  formatTelegramMessage,
  HIGH_VALUE_THRESHOLD,
  normalizeRetailCrmOrder,
} from "../../../src/shared/orders.ts";
import { createRetailCrmClient } from "../../../src/shared/retailcrm.ts";
import type { OrderRecordInput } from "../../../src/shared/types.ts";

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
    .select("retailcrm_id, external_id, customer_name, city, total_amount, created_at, utm_source")
    .gt("total_amount", HIGH_VALUE_THRESHOLD)
    .is("telegram_notified_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  let sentCount = 0;

  for (const row of data ?? []) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramMessage({
          retailcrm_id: Number(row.retailcrm_id),
          external_id: row.external_id ? String(row.external_id) : null,
          customer_name: String(row.customer_name),
          city: row.city ? String(row.city) : null,
          total_amount: Number(row.total_amount),
          created_at: String(row.created_at),
          utm_source: row.utm_source ? String(row.utm_source) : null,
        }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed with ${response.status}`);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ telegram_notified_at: new Date().toISOString() })
      .eq("retailcrm_id", row.retailcrm_id);

    if (updateError) {
      throw updateError;
    }

    sentCount += 1;
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
