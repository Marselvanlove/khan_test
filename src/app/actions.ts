"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DEFAULT_ADMIN_SETTINGS, normalizeAdminSettings } from "@/shared/admin-settings";

function isChecked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function readValue(formData: FormData, key: string, fallback: string | number): string | number {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

export async function updateAdminSettings(formData: FormData) {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    throw new Error("SUPABASE_URL и SUPABASE_SECRET_KEY нужны для сохранения настроек.");
  }

  const payload = normalizeAdminSettings({
    singleton_key: DEFAULT_ADMIN_SETTINGS.singleton_key,
    notifications_enabled: isChecked(formData, "notifications_enabled"),
    high_value_enabled: isChecked(formData, "high_value_enabled"),
    high_value_threshold: readValue(
      formData,
      "high_value_threshold",
      DEFAULT_ADMIN_SETTINGS.high_value_threshold,
    ),
    missing_contact_enabled: isChecked(formData, "missing_contact_enabled"),
    unknown_source_enabled: isChecked(formData, "unknown_source_enabled"),
    cancelled_enabled: isChecked(formData, "cancelled_enabled"),
    working_hours_enabled: isChecked(formData, "working_hours_enabled"),
    workday_start_hour: readValue(
      formData,
      "workday_start_hour",
      DEFAULT_ADMIN_SETTINGS.workday_start_hour,
    ),
    workday_end_hour: readValue(
      formData,
      "workday_end_hour",
      DEFAULT_ADMIN_SETTINGS.workday_end_hour,
    ),
    timezone: readValue(formData, "timezone", DEFAULT_ADMIN_SETTINGS.timezone),
  });

  const { error } = await supabase.from("admin_settings").upsert(payload, {
    onConflict: "singleton_key",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}
