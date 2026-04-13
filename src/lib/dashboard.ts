import { createSupabaseServerClient } from "./supabase-server";
import type {
  AdminSettings,
  DailyMetric,
  DashboardSummary,
  NotificationLogItem,
  NotificationOverview,
  OperationalOrderRow,
  OwnerMetrics,
  RetailCrmOrderResponse,
  SourceMetric,
  StatusSummaryItem,
  NotificationAlertType,
} from "@/shared/types";
import {
  buildRetailCrmOrderUrl,
  buildSourceMetrics,
  buildStatusSummary,
  extractOrderAddress,
  extractOrderEmail,
  extractOrderItems,
  extractOrderNumber,
  extractOrderPhone,
  formatSourceLabel,
  getSegmentMeta,
  getSlaLabel,
  getStatusMeta,
  summarizeMetrics,
  FREE_SHIPPING_THRESHOLD,
  PREMIUM_EXPRESS_THRESHOLD,
} from "@/shared/orders";
import {
  buildNotificationEventKey,
  DEFAULT_ADMIN_SETTINGS,
  formatWorkingWindow,
  getAlertTypeLabel,
  getAlertTypesForOrder,
  getEnabledAlertTypes,
  isMissingSupabaseTableError,
  isNotificationWindowOpen,
  normalizeAdminSettings,
} from "@/shared/admin-settings";

interface DashboardDataSuccess {
  ok: true;
  adminSettings: AdminSettings;
  notificationOverview: NotificationOverview;
  summary: DashboardSummary;
  ownerMetrics: OwnerMetrics;
  metrics: DailyMetric[];
  allOrders: OperationalOrderRow[];
  recentOrders: OperationalOrderRow[];
  highValueOrders: OperationalOrderRow[];
  pendingNotificationOrders: OperationalOrderRow[];
  upsellOrders: OperationalOrderRow[];
  premiumOrders: OperationalOrderRow[];
  ordersWithoutContact: OperationalOrderRow[];
  unknownSourceOrders: OperationalOrderRow[];
  sourceMetrics: SourceMetric[];
  highValueSourceMetrics: SourceMetric[];
  statusSummary: StatusSummaryItem[];
  notificationLogs: NotificationLogItem[];
}

interface DashboardDataFailure {
  ok: false;
  reason: "missing-env" | "query-failed";
  message: string;
}

export type DashboardData = DashboardDataSuccess | DashboardDataFailure;

function normalizeNotificationLog(row: Record<string, unknown>): NotificationLogItem {
  return {
    order_retailcrm_id: Number(row.order_retailcrm_id),
    order_number: row.order_number ? String(row.order_number) : null,
    event_type: String(row.event_type ?? "high-value") as NotificationAlertType,
    channel: String(row.channel ?? "telegram"),
    recipient: row.recipient ? String(row.recipient) : null,
    status: String(row.status ?? "unknown"),
    attempt: Number(row.attempt ?? 1),
    rate_limited: Boolean(row.rate_limited),
    error_message: row.error_message ? String(row.error_message) : null,
    created_at: String(row.created_at),
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
  };
}

function normalizeMetric(metric: Record<string, unknown>): DailyMetric {
  return {
    order_date: String(metric.order_date),
    orders_count: Number(metric.orders_count ?? 0),
    revenue: Number(metric.revenue ?? 0),
    high_value_orders: Number(metric.high_value_orders ?? 0),
  };
}

function normalizeOperationalOrderRow(
  row: Record<string, unknown>,
  retailCrmBaseUrl: string | null,
): OperationalOrderRow {
  const rawPayload = row.raw_payload as RetailCrmOrderResponse;
  const retailcrmId = Number(row.retailcrm_id);
  const externalId = row.external_id ? String(row.external_id) : null;
  const phone = extractOrderPhone(rawPayload, row.phone ? String(row.phone) : null);
  const email = extractOrderEmail(rawPayload, row.email ? String(row.email) : null);
  const address = extractOrderAddress(rawPayload);
  const totalAmount = Number(row.total_amount ?? 0);
  const statusCode = row.status ? String(row.status) : null;
  const statusMeta = getStatusMeta(statusCode);
  const segment = getSegmentMeta(totalAmount);
  const source = row.utm_source ? String(row.utm_source) : null;
  const unknownSource = !source?.trim();
  const missingContact = !phone && !email;
  const whatsappUrl = phone ? `https://wa.me/${phone.replaceAll(/\D/g, "")}` : null;

  return {
    retailcrm_id: retailcrmId,
    crm_number: extractOrderNumber(rawPayload, externalId),
    external_id: externalId,
    customer_name: String(row.customer_name ?? "Без имени"),
    phone,
    whatsapp_url: whatsappUrl,
    email,
    city: row.city ? String(row.city) : rawPayload.delivery?.address?.city ?? null,
    address,
    total_amount: totalAmount,
    created_at: String(row.created_at),
    utm_source: source,
    source_label: formatSourceLabel(source),
    status_code: statusCode,
    status_label: statusMeta.label,
    status_group: statusMeta.group,
    status_group_label: statusMeta.groupLabel,
    segment_code: segment.code,
    segment_label: segment.label,
    sla_label: getSlaLabel({
      totalAmount,
      statusCode,
      missingContact,
    }),
    retailcrm_url: buildRetailCrmOrderUrl(retailCrmBaseUrl, retailcrmId),
    items: extractOrderItems(rawPayload),
    missing_contact: missingContact,
    unknown_source: unknownSource,
    telegram_notified_at: row.telegram_notified_at ? String(row.telegram_notified_at) : null,
    alert_reasons: [],
  };
}

function buildSentAlertSet(logs: NotificationLogItem[]): Set<string> {
  return new Set(
    logs
      .filter((row) => row.status === "sent")
      .map((row) => buildNotificationEventKey(row.order_retailcrm_id, row.event_type)),
  );
}

function buildOwnerMetrics(
  orders: OperationalOrderRow[],
  pendingNotificationOrders: OperationalOrderRow[],
): OwnerMetrics {
  const last24HoursBoundary = Date.now() - 24 * 60 * 60 * 1000;
  const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const cancelledOrders = orders.filter((order) => order.status_group === "cancel").length;
  const approvalBacklog = orders.filter(
    (order) => order.status_group === "approval" || order.status_group === "new",
  ).length;
  const deliveryInFlight = orders.filter((order) => order.status_group === "delivery").length;
  const pendingAlerts = pendingNotificationOrders.reduce(
    (sum, order) => sum + order.alert_reasons.length,
    0,
  );

  return {
    averageOrderValue: orders.length ? totalRevenue / orders.length : 0,
    ordersLast24Hours: orders.filter(
      (order) => new Date(order.created_at).getTime() >= last24HoursBoundary,
    ).length,
    cancelRate: orders.length ? (cancelledOrders / orders.length) * 100 : 0,
    approvalBacklog,
    deliveryInFlight,
    pendingAlerts,
    pendingOrders: pendingNotificationOrders.length,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      reason: "missing-env",
      message: "Заполни SUPABASE_URL и SUPABASE_SECRET_KEY, чтобы увидеть данные.",
    };
  }

  const retailCrmBaseUrl = process.env.RETAILCRM_BASE_URL?.trim() ?? null;

  const [metricsResult, allOrdersResult, notificationLogsResult, adminSettingsResult] =
    await Promise.all([
      supabase.from("daily_order_metrics").select("*").order("order_date", { ascending: true }),
      supabase
        .from("orders")
        .select("retailcrm_id, external_id, customer_name, phone, email, city, total_amount, created_at, status, utm_source, telegram_notified_at, raw_payload")
        .order("created_at", { ascending: false }),
    supabase
      .from("notification_logs")
      .select("order_retailcrm_id, order_number, channel, recipient, status, attempt, rate_limited, error_message, created_at, delivered_at")
      .order("created_at", { ascending: false })
      .limit(500),
      supabase
        .from("admin_settings")
        .select(
          "singleton_key, notifications_enabled, high_value_enabled, high_value_threshold, missing_contact_enabled, unknown_source_enabled, cancelled_enabled, working_hours_enabled, workday_start_hour, workday_end_hour, timezone",
        )
        .eq("singleton_key", "default")
        .maybeSingle(),
    ]);

  const logsMissingTable = isMissingSupabaseTableError(notificationLogsResult.error);
  const settingsMissingTable = isMissingSupabaseTableError(adminSettingsResult.error);
  const failedQuery = [metricsResult, allOrdersResult].find((result) => result.error);
  const failedLogsQuery =
    notificationLogsResult.error && !logsMissingTable ? notificationLogsResult.error : null;
  const failedSettingsQuery =
    adminSettingsResult.error && !settingsMissingTable ? adminSettingsResult.error : null;

  if (failedQuery?.error || failedLogsQuery || failedSettingsQuery) {
    return {
      ok: false,
      reason: "query-failed",
      message:
        failedQuery?.error?.message ??
        failedLogsQuery?.message ??
        failedSettingsQuery?.message ??
        "Query failed",
    };
  }

  const adminSettings =
    settingsMissingTable || !adminSettingsResult.data
      ? DEFAULT_ADMIN_SETTINGS
      : normalizeAdminSettings(adminSettingsResult.data as Record<string, unknown>);
  const metrics = (metricsResult.data ?? []).map((metric) => normalizeMetric(metric as Record<string, unknown>));
  const allOrders = (allOrdersResult.data ?? []).map((row) =>
    normalizeOperationalOrderRow(row as Record<string, unknown>, retailCrmBaseUrl),
  );
  const allNotificationLogs =
    logsMissingTable || notificationLogsResult.error
      ? []
      : (notificationLogsResult.data ?? []).map((row) =>
          normalizeNotificationLog(row as Record<string, unknown>),
        );
  const sentAlertSet = buildSentAlertSet(allNotificationLogs);
  const pendingNotificationOrders = allOrders
    .map((order) => {
      const nextAlertTypes = getAlertTypesForOrder(order, adminSettings).filter((eventType) => {
        if (logsMissingTable) {
          return !order.telegram_notified_at;
        }

        return !sentAlertSet.has(buildNotificationEventKey(order.retailcrm_id, eventType));
      });

      return {
        ...order,
        alert_reasons: nextAlertTypes.map((eventType) => getAlertTypeLabel(eventType)),
      };
    })
    .filter((order) => order.alert_reasons.length)
    .sort((left, right) => {
      if (right.alert_reasons.length !== left.alert_reasons.length) {
        return right.alert_reasons.length - left.alert_reasons.length;
      }

      if (right.total_amount !== left.total_amount) {
        return right.total_amount - left.total_amount;
      }

      return Date.parse(right.created_at) - Date.parse(left.created_at);
    });

  const recentOrders = allOrders.slice(0, 6);
  const highValueOrders = allOrders
    .filter((order) => order.total_amount > adminSettings.high_value_threshold)
    .sort((left, right) => right.total_amount - left.total_amount);
  const premiumOrders = allOrders
    .filter((order) => order.total_amount >= PREMIUM_EXPRESS_THRESHOLD)
    .sort((left, right) => right.total_amount - left.total_amount);
  const upsellOrders = allOrders
    .filter(
      (order) =>
        order.total_amount >= FREE_SHIPPING_THRESHOLD &&
        order.total_amount <= adminSettings.high_value_threshold,
    )
    .sort((left, right) => right.total_amount - left.total_amount);
  const ordersWithoutContact = allOrders.filter((order) => order.missing_contact);
  const unknownSourceOrders = allOrders.filter((order) => order.unknown_source);
  const sourceMetrics = buildSourceMetrics(
    allOrders.map((order) => ({
      utm_source: order.utm_source,
      total_amount: order.total_amount,
    })),
  );
  const highValueSourceMetrics = buildSourceMetrics(
    highValueOrders.map((order) => ({
      utm_source: order.utm_source,
      total_amount: order.total_amount,
    })),
  );
  const statusSummary = buildStatusSummary(allOrders);
  const notificationLogs = allNotificationLogs.slice(0, 8);
  const ownerMetrics = buildOwnerMetrics(allOrders, pendingNotificationOrders);
  const notificationOverview: NotificationOverview = {
    windowOpen: isNotificationWindowOpen(adminSettings),
    activeAlerts: getEnabledAlertTypes(adminSettings),
    pendingEvents: ownerMetrics.pendingAlerts,
    pendingOrders: ownerMetrics.pendingOrders,
    scheduleLabel: formatWorkingWindow(adminSettings),
  };

  return {
    ok: true,
    adminSettings,
    notificationOverview,
    summary: summarizeMetrics(allOrders, adminSettings.high_value_threshold),
    ownerMetrics,
    metrics,
    allOrders,
    recentOrders,
    highValueOrders,
    pendingNotificationOrders,
    upsellOrders,
    premiumOrders,
    ordersWithoutContact,
    unknownSourceOrders,
    sourceMetrics,
    highValueSourceMetrics,
    statusSummary,
    notificationLogs,
  };
}
