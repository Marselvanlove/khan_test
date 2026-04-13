import { createSupabaseServerClient } from "./supabase-server";
import type {
  DailyMetric,
  DashboardSummary,
  NotificationLogItem,
  OperationalOrderRow,
  RetailCrmOrderResponse,
  SourceMetric,
  StatusSummaryItem,
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
  HIGH_VALUE_THRESHOLD,
  FREE_SHIPPING_THRESHOLD,
  PREMIUM_EXPRESS_THRESHOLD,
} from "@/shared/orders";

interface DashboardDataSuccess {
  ok: true;
  summary: DashboardSummary;
  metrics: DailyMetric[];
  allOrders: OperationalOrderRow[];
  recentOrders: OperationalOrderRow[];
  highValueOrders: OperationalOrderRow[];
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

  const [metricsResult, allOrdersResult, notificationLogsResult] = await Promise.all([
    supabase.from("daily_order_metrics").select("*").order("order_date", { ascending: true }),
    supabase
      .from("orders")
      .select("retailcrm_id, external_id, customer_name, phone, email, city, total_amount, created_at, status, utm_source, raw_payload")
      .order("created_at", { ascending: false }),
    supabase
      .from("notification_logs")
      .select("order_retailcrm_id, order_number, channel, recipient, status, attempt, rate_limited, error_message, created_at, delivered_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const logsMissingTable =
    notificationLogsResult.error?.code === "PGRST205" ||
    notificationLogsResult.error?.message?.includes("Could not find the table");
  const failedQuery = [metricsResult, allOrdersResult].find((result) => result.error);

  if (failedQuery?.error) {
    return {
      ok: false,
      reason: "query-failed",
      message: failedQuery.error.message,
    };
  }

  const metrics = (metricsResult.data ?? []).map((metric) => normalizeMetric(metric as Record<string, unknown>));
  const allOrders = (allOrdersResult.data ?? []).map((row) =>
    normalizeOperationalOrderRow(row as Record<string, unknown>, retailCrmBaseUrl),
  );

  const recentOrders = allOrders.slice(0, 6);
  const highValueOrders = allOrders
    .filter((order) => order.total_amount > HIGH_VALUE_THRESHOLD)
    .sort((left, right) => right.total_amount - left.total_amount);
  const premiumOrders = allOrders
    .filter((order) => order.total_amount >= PREMIUM_EXPRESS_THRESHOLD)
    .sort((left, right) => right.total_amount - left.total_amount);
  const upsellOrders = allOrders
    .filter(
      (order) =>
        order.total_amount >= FREE_SHIPPING_THRESHOLD && order.total_amount <= HIGH_VALUE_THRESHOLD,
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
  const notificationLogs =
    logsMissingTable || notificationLogsResult.error
      ? []
      : (notificationLogsResult.data ?? []).map((row) =>
          normalizeNotificationLog(row as Record<string, unknown>),
        );

  return {
    ok: true,
    summary: summarizeMetrics(metrics, allOrders),
    metrics,
    allOrders,
    recentOrders,
    highValueOrders,
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
