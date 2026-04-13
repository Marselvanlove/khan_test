import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function readRequiredEnv(name: string): string {
  const value = process.env[name];

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

async function deleteAllRows() {
  const supabase = createSupabaseAdmin();
  const operations = [
    supabase.from("telegram_message_states").delete().gte("created_at", "1970-01-01T00:00:00Z"),
    supabase.from("notification_logs").delete().gte("created_at", "1970-01-01T00:00:00Z"),
    supabase.from("orders").delete().gte("inserted_at", "1970-01-01T00:00:00Z"),
  ];

  const results = await Promise.all(operations);
  const firstError = results.find((result) => result.error)?.error;

  if (firstError) {
    throw firstError;
  }

  console.log("Operational tables were cleared: orders, notification_logs, telegram_message_states");
}

deleteAllRows().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
