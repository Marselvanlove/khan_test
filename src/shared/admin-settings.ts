import type { AdminSettings, NotificationAlertType } from "./types";

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  singleton_key: "default",
  notifications_enabled: true,
  high_value_enabled: true,
  high_value_threshold: 50_000,
  missing_contact_enabled: true,
  unknown_source_enabled: false,
  cancelled_enabled: false,
  working_hours_enabled: true,
  workday_start_hour: 10,
  workday_end_hour: 19,
  timezone: "Asia/Almaty",
};

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Almaty", label: "Алматы (UTC+5)" },
  { value: "Asia/Aqtau", label: "Актау (UTC+5)" },
  { value: "Asia/Atyrau", label: "Атырау (UTC+5)" },
  { value: "Asia/Tashkent", label: "Ташкент (UTC+5)" },
  { value: "Asia/Bishkek", label: "Бишкек (UTC+6)" },
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "UTC", label: "UTC" },
] as const;

const ALERT_TYPE_LABELS: Record<NotificationAlertType, string> = {
  "high-value": "Крупный заказ",
  "missing-contact": "Нет контакта у клиента",
  "unknown-source": "Потерян источник заказа",
  cancelled: "Отменённый заказ",
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: value,
      hour: "2-digit",
    }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function readZonedHour(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  return Number.isFinite(hour) ? hour : 0;
}

function padHour(value: number): string {
  return String(value).padStart(2, "0");
}

export function isMissingSupabaseTableError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.message?.includes("Could not find the table") === true
  );
}

export function normalizeTimeZone(value: string | null | undefined): string {
  if (!value?.trim()) {
    return DEFAULT_ADMIN_SETTINGS.timezone;
  }

  const normalized = value.trim();

  return isValidTimeZone(normalized) ? normalized : DEFAULT_ADMIN_SETTINGS.timezone;
}

export function normalizeAdminSettings(
  row: Record<string, unknown> | null | undefined,
): AdminSettings {
  const startHour = clamp(
    Math.trunc(toNumber(row?.workday_start_hour, DEFAULT_ADMIN_SETTINGS.workday_start_hour)),
    0,
    23,
  );
  const rawEndHour = clamp(
    Math.trunc(toNumber(row?.workday_end_hour, DEFAULT_ADMIN_SETTINGS.workday_end_hour)),
    1,
    24,
  );
  const endHour = rawEndHour <= startHour ? Math.min(startHour + 1, 24) : rawEndHour;

  return {
    singleton_key:
      typeof row?.singleton_key === "string" && row.singleton_key.trim()
        ? row.singleton_key.trim()
        : DEFAULT_ADMIN_SETTINGS.singleton_key,
    notifications_enabled: toBoolean(
      row?.notifications_enabled,
      DEFAULT_ADMIN_SETTINGS.notifications_enabled,
    ),
    high_value_enabled: toBoolean(row?.high_value_enabled, DEFAULT_ADMIN_SETTINGS.high_value_enabled),
    high_value_threshold: Math.max(
      0,
      toNumber(row?.high_value_threshold, DEFAULT_ADMIN_SETTINGS.high_value_threshold),
    ),
    missing_contact_enabled: toBoolean(
      row?.missing_contact_enabled,
      DEFAULT_ADMIN_SETTINGS.missing_contact_enabled,
    ),
    unknown_source_enabled: toBoolean(
      row?.unknown_source_enabled,
      DEFAULT_ADMIN_SETTINGS.unknown_source_enabled,
    ),
    cancelled_enabled: toBoolean(row?.cancelled_enabled, DEFAULT_ADMIN_SETTINGS.cancelled_enabled),
    working_hours_enabled: toBoolean(
      row?.working_hours_enabled,
      DEFAULT_ADMIN_SETTINGS.working_hours_enabled,
    ),
    workday_start_hour: startHour,
    workday_end_hour: endHour,
    timezone: normalizeTimeZone(
      typeof row?.timezone === "string" ? row.timezone : DEFAULT_ADMIN_SETTINGS.timezone,
    ),
  };
}

export function getAlertTypeLabel(type: NotificationAlertType): string {
  return ALERT_TYPE_LABELS[type];
}

export function formatAlertTypeList(types: NotificationAlertType[]): string {
  return types.map((type) => getAlertTypeLabel(type)).join(", ");
}

export function getEnabledAlertTypes(settings: AdminSettings): NotificationAlertType[] {
  const result: NotificationAlertType[] = [];

  if (settings.high_value_enabled) {
    result.push("high-value");
  }

  if (settings.missing_contact_enabled) {
    result.push("missing-contact");
  }

  if (settings.unknown_source_enabled) {
    result.push("unknown-source");
  }

  if (settings.cancelled_enabled) {
    result.push("cancelled");
  }

  return result;
}

export function getAlertTypesForOrder(
  order: Pick<
    {
      total_amount: number;
      missing_contact: boolean;
      unknown_source: boolean;
      status_group: string;
    },
    "total_amount" | "missing_contact" | "unknown_source" | "status_group"
  >,
  settings: AdminSettings,
): NotificationAlertType[] {
  const result: NotificationAlertType[] = [];

  if (settings.high_value_enabled && order.total_amount > settings.high_value_threshold) {
    result.push("high-value");
  }

  if (settings.missing_contact_enabled && order.missing_contact) {
    result.push("missing-contact");
  }

  if (settings.unknown_source_enabled && order.unknown_source) {
    result.push("unknown-source");
  }

  if (settings.cancelled_enabled && order.status_group === "cancel") {
    result.push("cancelled");
  }

  return result;
}

export function isNotificationWindowOpen(
  settings: AdminSettings,
  now: Date = new Date(),
): boolean {
  if (!settings.notifications_enabled) {
    return false;
  }

  if (!settings.working_hours_enabled) {
    return true;
  }

  const hour = readZonedHour(now, normalizeTimeZone(settings.timezone));

  return hour >= settings.workday_start_hour && hour < settings.workday_end_hour;
}

export function formatWorkingWindow(settings: AdminSettings): string {
  if (!settings.working_hours_enabled) {
    return "Без ограничения по времени";
  }

  return `${padHour(settings.workday_start_hour)}:00-${padHour(settings.workday_end_hour)}:00 (${settings.timezone})`;
}

export function buildNotificationEventKey(
  orderRetailCrmId: number,
  eventType: NotificationAlertType,
): string {
  return `${orderRetailCrmId}:${eventType}`;
}
