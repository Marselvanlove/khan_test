import { createSupabaseServerClient } from "./supabase-server";
import { loadRetailCrmKanbanStatuses } from "./order-status-server";
import type {
  AdminSettings,
  DailyMetric,
  DashboardSummary,
  FinanceAccountingExceptionRow,
  FinanceCancellationLosses,
  FinanceOrderFact,
  FinancePaymentSummaryRow,
  FinanceSegmentRevenueRow,
  FinanceTabData,
  GraphsCityRow,
  GraphsData,
  GraphsProductRow,
  GraphsSegmentRow,
  GraphsTrendPoint,
  MarketingAttributionIssueRow,
  MarketingGeoRow,
  MarketingOrderFact,
  MarketingSourceRow,
  MarketingTabData,
  NotificationLogItem,
  NotificationOverview,
  OperationsTabData,
  OperationalOrderRow,
  OwnerMetrics,
  RetailCrmOrderResponse,
  SourceMetric,
  NotificationAlertType,
  PaymentStatus,
} from "@/shared/types";
import {
  buildOperationalOrderRowFromRecord,
  buildSourceMetrics,
  buildStatusSummary,
  extractOrderItemDetails,
  formatPaymentStatusLabel,
  summarizeMetrics,
  PREMIUM_EXPRESS_THRESHOLD,
} from "@/shared/orders";
import { buildKanbanStatusLabelMap } from "@/shared/kanban";
import { buildNotificationLogFeed } from "@/shared/notification-logs";
import { buildSignedLogisticsLink, buildSignedManagerLink } from "@/shared/order-links";
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
  graphsData: GraphsData;
  allOrders: OperationalOrderRow[];
  operationsData: OperationsTabData;
  marketingData: MarketingTabData;
  financeData: FinanceTabData;
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

function buildGraphsPeriodLabel(metrics: DailyMetric[]): string {
  if (!metrics.length) {
    return "Нет данных";
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const first = formatter.format(new Date(metrics[0].order_date));
  const last = formatter.format(new Date(metrics[metrics.length - 1].order_date));

  return `${first} — ${last}`;
}

function buildGraphsTrend(metrics: DailyMetric[]): GraphsTrendPoint[] {
  return metrics.map((metric) => ({
    date: metric.order_date,
    label: new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
    }).format(new Date(metric.order_date)),
    orders_count: metric.orders_count,
    revenue: metric.revenue,
    high_value_orders: metric.high_value_orders,
  }));
}

function buildTopProducts(rows: Array<Record<string, unknown>>, totalRevenue: number): GraphsProductRow[] {
  const byProduct = new Map<string, GraphsProductRow>();

  for (const row of rows) {
    const rawPayload = row.raw_payload as RetailCrmOrderResponse;
    for (const item of extractOrderItemDetails(rawPayload)) {
      const current = byProduct.get(item.name) ?? {
        name: item.name,
        qty: 0,
        revenue: 0,
        share_of_revenue: 0,
      };

      current.qty += item.quantity;
      current.revenue += item.total_price;
      byProduct.set(item.name, current);
    }
  }

  return Array.from(byProduct.values())
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 10)
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
    }));
}

function buildTopCities(orders: OperationalOrderRow[], totalRevenue: number): GraphsCityRow[] {
  const byCity = new Map<string, GraphsCityRow>();

  for (const order of orders) {
    const city = order.city?.trim() || "Не указан";
    const current = byCity.get(city) ?? {
      city,
      orders: 0,
      revenue: 0,
      share_of_revenue: 0,
    };

    current.orders += 1;
    current.revenue += order.total_amount;
    byCity.set(city, current);
  }

  return Array.from(byCity.values())
    .sort((left, right) => right.revenue - left.revenue)
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
    }));
}

function buildSegmentMix(orders: OperationalOrderRow[], totalRevenue: number): GraphsSegmentRow[] {
  const bySegment = new Map<OperationalOrderRow["segment_code"], GraphsSegmentRow>();

  for (const order of orders) {
    const current = bySegment.get(order.segment_code) ?? {
      code: order.segment_code,
      label: order.segment_label,
      orders: 0,
      revenue: 0,
      share_of_revenue: 0,
    };

    current.orders += 1;
    current.revenue += order.total_amount;
    bySegment.set(order.segment_code, current);
  }

  return Array.from(bySegment.values())
    .sort((left, right) => right.revenue - left.revenue)
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
    }));
}

function startOfLocalDay(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isCreatedToday(value: string, timezone: string, now = new Date()): boolean {
  return startOfLocalDay(new Date(value), timezone) === startOfLocalDay(now, timezone);
}

function isOperationallyActive(order: OperationalOrderRow): boolean {
  return order.status_group !== "complete" && order.status_group !== "cancel";
}

function getSlaDeadlineMs(order: OperationalOrderRow): number | null {
  if (!isOperationallyActive(order)) {
    return null;
  }

  if (order.total_amount >= PREMIUM_EXPRESS_THRESHOLD) {
    return 15 * 60 * 1000;
  }

  if (order.segment_code === "high-value") {
    return 30 * 60 * 1000;
  }

  if (order.status_group === "new" || order.status_group === "approval") {
    return 4 * 60 * 60 * 1000;
  }

  if (order.status_group === "delivery") {
    return 24 * 60 * 60 * 1000;
  }

  return 24 * 60 * 60 * 1000;
}

function isSlaOverdue(order: OperationalOrderRow, now = Date.now()): boolean {
  const deadline = getSlaDeadlineMs(order);

  if (!deadline) {
    return false;
  }

  return now - Date.parse(order.created_at) > deadline;
}

function dedupeReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function sortOrdersByUrgency(left: OperationalOrderRow, right: OperationalOrderRow): number {
  const overdueDiff = Number(isSlaOverdue(right)) - Number(isSlaOverdue(left));

  if (overdueDiff !== 0) {
    return overdueDiff;
  }

  if (right.total_amount !== left.total_amount) {
    return right.total_amount - left.total_amount;
  }

  return Date.parse(right.created_at) - Date.parse(left.created_at);
}

function buildOperationsTabData(
  orders: OperationalOrderRow[],
  kanbanOrders: OperationalOrderRow[],
  kanbanStatuses: OperationsTabData["kanbanStatuses"],
  pendingNotificationOrders: OperationalOrderRow[],
  adminSettings: AdminSettings,
): OperationsTabData {
  const pendingByOrderId = new Map(
    pendingNotificationOrders.map((order) => [order.retailcrm_id, order.alert_reasons]),
  );

  const priorityQueue = orders
    .filter(
      (order) =>
        order.total_amount > adminSettings.high_value_threshold && isOperationallyActive(order),
    )
    .map((order) => ({
      ...order,
      alert_reasons: dedupeReasons([
        order.segment_label,
        ...(pendingByOrderId.get(order.retailcrm_id) ?? []),
        ...(isSlaOverdue(order) ? ["SLA просрочен"] : []),
      ]),
    }))
    .sort(sortOrdersByUrgency);

  const actionQueue = orders
    .filter(
      (order) =>
        order.total_amount <= adminSettings.high_value_threshold &&
        (order.status_group === "new" ||
          order.status_group === "approval" ||
          isSlaOverdue(order)),
    )
    .map((order) => ({
      ...order,
      alert_reasons: dedupeReasons([
        order.status_group === "new" ? "Новый заказ" : "",
        order.status_group === "approval" ? "Ждёт согласования" : "",
        ...(pendingByOrderId.get(order.retailcrm_id) ?? []),
        ...(isSlaOverdue(order) ? ["SLA просрочен"] : []),
      ]),
    }))
    .sort(sortOrdersByUrgency);

  const problemQueue = orders
    .filter(
      (order) =>
        order.missing_contact ||
        !order.address?.trim() ||
        !order.items.length ||
        pendingByOrderId.has(order.retailcrm_id),
    )
    .map((order) => ({
      ...order,
      alert_reasons: dedupeReasons([
        order.missing_contact ? "Нет телефона или email" : "",
        !order.address?.trim() ? "Нет адреса" : "",
        !order.items.length ? "Ошибка данных" : "",
        pendingByOrderId.has(order.retailcrm_id) ? "Не отправлено уведомление" : "",
      ]),
    }))
    .sort((left, right) => {
      if (right.alert_reasons.length !== left.alert_reasons.length) {
        return right.alert_reasons.length - left.alert_reasons.length;
      }

      return sortOrdersByUrgency(left, right);
    });

  const now = Date.now();
  const statusFlow = buildStatusSummary(orders).map((row) => ({
    ...row,
    share: orders.length ? (row.count / orders.length) * 100 : 0,
  }));

  return {
    high_value_threshold: adminSettings.high_value_threshold,
    kpis: [
      {
        key: "new-today",
        label: "Новые за сегодня",
        value: orders.filter((order) => isCreatedToday(order.created_at, adminSettings.timezone)).length,
        hint: "Заказы, которые вошли в поток сегодня по рабочему часовому поясу.",
      },
      {
        key: "approval-backlog",
        label: "Согласование",
        value: orders.filter((order) => order.status_group === "approval").length,
        hint: "Заказы, зависшие на подтверждении, замене или ожидании ответа клиента.",
      },
      {
        key: "delivery",
        label: "В доставке",
        value: orders.filter((order) => order.status_group === "delivery").length,
        hint: "Заказы, где нужно контролировать отгрузку, ПВЗ и переносы доставки.",
      },
      {
        key: "missing-contact",
        label: "Без контакта",
        value: orders.filter((order) => order.missing_contact).length,
        hint: "Клиенту нельзя быстро написать или позвонить без ручной правки данных.",
      },
      {
        key: "high-value-active",
        label: "High-value в работе",
        value: priorityQueue.length,
        hint: "Крупные и премиальные заказы, которые ещё не закрыты и требуют внимания.",
      },
      {
        key: "sla-overdue",
        label: "SLA просрочен",
        value: orders.filter((order) => isSlaOverdue(order, now)).length,
        hint: "Активные заказы, которые уже вышли за целевое окно реакции команды.",
      },
    ],
    statusFlow,
    kanbanOrders,
    kanbanStatuses,
    actionQueue,
    priorityQueue,
    problemQueue,
  };
}

function buildMarketingSourceRows(orders: MarketingOrderFact[]): MarketingSourceRow[] {
  const summary = new Map<string, MarketingSourceRow>();

  for (const order of orders) {
    const current = summary.get(order.source_label) ?? {
      source: order.source_label,
      orders: 0,
      revenue: 0,
      average_order_value: 0,
      high_value_orders: 0,
      high_value_share: 0,
      cancel_rate: 0,
    };

    current.orders += 1;
    current.revenue += order.total_amount;

    if (order.segment_code === "high-value" || order.segment_code === "premium-express") {
      current.high_value_orders += 1;
    }

    if (order.status_group === "cancel") {
      current.cancel_rate += 1;
    }

    summary.set(order.source_label, current);
  }

  return Array.from(summary.values())
    .map((row) => ({
      ...row,
      average_order_value: row.orders ? row.revenue / row.orders : 0,
      high_value_share: row.orders ? (row.high_value_orders / row.orders) * 100 : 0,
      cancel_rate: row.orders ? (row.cancel_rate / row.orders) * 100 : 0,
    }))
    .sort((left, right) => {
      if (right.orders !== left.orders) {
        return right.orders - left.orders;
      }

      return right.revenue - left.revenue;
    });
}

function buildMarketingGeoRows(orders: MarketingOrderFact[]): MarketingGeoRow[] {
  const summary = new Map<
    string,
    { city: string; orders: number; revenue: number; sourceCounts: Map<string, { orders: number; revenue: number }> }
  >();

  for (const order of orders) {
    const city = order.city?.trim() || "Не указан";
    const current = summary.get(city) ?? {
      city,
      orders: 0,
      revenue: 0,
      sourceCounts: new Map<string, { orders: number; revenue: number }>(),
    };
    const sourceSummary = current.sourceCounts.get(order.source_label) ?? { orders: 0, revenue: 0 };

    current.orders += 1;
    current.revenue += order.total_amount;
    sourceSummary.orders += 1;
    sourceSummary.revenue += order.total_amount;
    current.sourceCounts.set(order.source_label, sourceSummary);
    summary.set(city, current);
  }

  return Array.from(summary.values())
    .map((row) => {
      const topSource =
        Array.from(row.sourceCounts.entries()).sort((left, right) => {
          if (right[1].orders !== left[1].orders) {
            return right[1].orders - left[1].orders;
          }

          return right[1].revenue - left[1].revenue;
        })[0]?.[0] ?? "unknown source";

      return {
        city: row.city,
        orders: row.orders,
        revenue: row.revenue,
        top_source: topSource,
      };
    })
    .sort((left, right) => {
      if (right.orders !== left.orders) {
        return right.orders - left.orders;
      }

      return right.revenue - left.revenue;
    });
}

function buildMarketingKpis(orders: MarketingOrderFact[]) {
  const totalOrders = orders.length;
  const revenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const highValueOrders = orders.filter(
    (order) => order.segment_code === "high-value" || order.segment_code === "premium-express",
  ).length;
  const unknownSourceOrders = orders.filter((order) => order.unknown_source).length;
  const cancelledOrders = orders.filter((order) => order.status_group === "cancel").length;

  return [
    {
      key: "orders",
      label: "Заказы",
      value: totalOrders,
      hint: "Количество заказов в выбранном маркетинговом срезе.",
    },
    {
      key: "revenue",
      label: "Выручка",
      value: revenue,
      hint: "GMV по выбранным каналам и географии.",
    },
    {
      key: "average-order-value",
      label: "Средний чек",
      value: totalOrders ? revenue / totalOrders : 0,
      hint: "Показывает не только объём, но и качество спроса.",
    },
    {
      key: "high-value-share",
      label: "Доля high-value",
      value: totalOrders ? (highValueOrders / totalOrders) * 100 : 0,
      hint: "Часть потока, которая приводит дорогую корзину.",
    },
      {
        key: "unknown-source-rate",
        label: "Потеря атрибуции",
        value: totalOrders ? (unknownSourceOrders / totalOrders) * 100 : 0,
        hint: "Доля заказов, по которым канал привлечения потерян.",
      },
    {
      key: "cancel-rate",
      label: "Отмены по каналам",
      value: totalOrders ? (cancelledOrders / totalOrders) * 100 : 0,
      hint: "Позволяет видеть не только продажи, но и качество лида после привлечения.",
    },
  ] as MarketingTabData["kpis"];
}

function buildMarketingTabData(
  orders: OperationalOrderRow[],
  reportPeriodLabel: string,
): MarketingTabData {
  const facts: MarketingOrderFact[] = orders.map((order) => ({
    retailcrm_id: order.retailcrm_id,
    crm_number: order.crm_number,
    created_at: order.created_at,
    total_amount: order.total_amount,
    source_label: order.source_label,
    city: order.city,
    status_label: order.status_label,
    status_group: order.status_group,
    segment_code: order.segment_code,
    unknown_source: order.unknown_source,
  }));
  const attributionIssues: MarketingAttributionIssueRow[] = orders
    .filter((order) => order.unknown_source)
    .map((order) => ({
      retailcrm_id: order.retailcrm_id,
      crm_number: order.crm_number,
      created_at: order.created_at,
      total_amount: order.total_amount,
      city: order.city,
      status_label: order.status_label,
      reason: "UTM/source отсутствует",
      manager_url: order.manager_url,
      retailcrm_url: order.retailcrm_url,
    }));

  return {
    report_period_label: reportPeriodLabel,
    sourceOptions: Array.from(new Set(facts.map((fact) => fact.source_label))).sort(),
    cityOptions: Array.from(
      new Set(facts.map((fact) => fact.city).filter((value): value is string => Boolean(value))),
    ).sort(),
    facts,
    kpis: buildMarketingKpis(facts),
    sourceTable: buildMarketingSourceRows(facts),
    highValueSources: buildMarketingSourceRows(
      facts.filter(
        (order) => order.segment_code === "high-value" || order.segment_code === "premium-express",
      ),
    ),
    geoBreakdown: buildMarketingGeoRows(facts),
    attributionIssues,
  };
}

function buildFinanceKpis(
  facts: FinanceOrderFact[],
  hasReliablePaymentData: boolean,
): FinanceTabData["kpis"] {
  const totalOrders = facts.length;
  const gmv = facts.reduce((sum, fact) => sum + fact.total_amount, 0);
  const cancelledAmount = facts
    .filter((fact) => fact.status_group === "cancel")
    .reduce((sum, fact) => sum + fact.total_amount, 0);
  const paidAmount = facts.reduce((sum, fact) => sum + fact.paid_amount, 0);
  const unpaidAmount = facts.reduce((sum, fact) => sum + fact.outstanding_amount, 0);
  const paidOrders = facts.filter((fact) => fact.payment_status === "paid").length;
  const ordersWithPaymentData = facts.filter((fact) => fact.has_payment_data).length;

  return [
    {
      key: "gmv",
      label: "GMV",
      value: gmv,
      hint: "Валовая выручка по заказам в выбранном периоде.",
    },
    {
      key: "paid-amount",
      label: "Оплачено",
      value: hasReliablePaymentData ? paidAmount : null,
      hint: "Сумма подтверждённых оплат из RetailCRM.",
    },
    {
      key: "unpaid-amount",
      label: "Не оплачено",
      value: hasReliablePaymentData ? unpaidAmount : null,
      hint: "Остаток по заказам, где оплата ещё не закрыта полностью.",
    },
    {
      key: "average-order-value",
      label: "Средний чек",
      value: totalOrders ? gmv / totalOrders : 0,
      hint: "Средний размер заказа без привязки к payment status.",
    },
    {
      key: "cancel-losses",
      label: "Потери на отменах",
      value: cancelledAmount,
      hint: "Сумма заказов, ушедших в отмену или возврат.",
    },
    {
      key: "paid-rate",
      label: "Доля оплаченных",
      value:
        hasReliablePaymentData && ordersWithPaymentData
          ? (paidOrders / ordersWithPaymentData) * 100
          : null,
      hint: "Доля полностью оплаченных заказов среди заказов с платёжными данными.",
    },
  ];
}

function buildFinancePaymentSummaryRows(facts: FinanceOrderFact[]): FinancePaymentSummaryRow[] {
  const statuses: PaymentStatus[] = ["unpaid", "partial", "paid", "refunded", "unknown"];

  return statuses.map((status) => {
    const rows = facts.filter((fact) => fact.payment_status === status);

    return {
      status,
      label: formatPaymentStatusLabel(status),
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + row.total_amount, 0),
    };
  });
}

function buildFinanceSegmentRows(facts: FinanceOrderFact[]): FinanceSegmentRevenueRow[] {
  const totalRevenue = facts.reduce((sum, fact) => sum + fact.total_amount, 0);
  const segments = new Map<OperationalOrderRow["segment_code"], FinanceSegmentRevenueRow>();

  for (const fact of facts) {
    const current = segments.get(fact.segment_code) ?? {
      segment: fact.segment_code,
      label: fact.segment_label,
      orders: 0,
      gmv: 0,
      paid_amount: 0,
      share_of_revenue: 0,
    };

    current.orders += 1;
    current.gmv += fact.total_amount;
    current.paid_amount += fact.paid_amount;
    segments.set(fact.segment_code, current);
  }

  return Array.from(segments.values())
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.gmv / totalRevenue) * 100 : 0,
    }))
    .sort((left, right) => right.gmv - left.gmv);
}

function buildCancellationLosses(facts: FinanceOrderFact[]): FinanceCancellationLosses {
  const cancelledRows = facts.filter((fact) => fact.status_group === "cancel");

  return {
    cancelled_orders: cancelledRows.length,
    cancelled_amount: cancelledRows.reduce((sum, row) => sum + row.total_amount, 0),
    cancelled_after_payment_count: cancelledRows.filter((row) => row.is_cancelled_after_payment).length,
    potential_refund_amount: cancelledRows.reduce((sum, row) => sum + row.paid_amount, 0),
  };
}

function buildFinanceExceptions(facts: FinanceOrderFact[]): FinanceAccountingExceptionRow[] {
  return facts
    .filter(
      (fact) =>
        fact.payment_status === "unpaid" ||
        fact.payment_status === "partial" ||
        fact.payment_status === "refunded" ||
        fact.is_cancelled_after_payment,
    )
    .map((fact) => ({
      retailcrm_id: fact.retailcrm_id,
      crm_number: fact.crm_number,
      customer_name: fact.customer_name,
      total_amount: fact.total_amount,
      paid_amount: fact.paid_amount,
      outstanding_amount: fact.outstanding_amount,
      status_label: fact.status_label,
      payment_status: fact.payment_status,
      payment_paid_at: fact.payment_paid_at,
      issue_label: fact.is_cancelled_after_payment
        ? "Отменён после оплаты"
        : fact.payment_status === "partial"
          ? "Частичная оплата"
          : fact.payment_status === "unpaid"
            ? "Оплата не поступила"
            : "Нужна проверка возврата",
      manager_url: fact.manager_url,
      retailcrm_url: fact.retailcrm_url,
    }))
    .sort((left, right) => {
      if (left.issue_label !== right.issue_label) {
        return left.issue_label.localeCompare(right.issue_label, "ru");
      }

      if (right.outstanding_amount !== left.outstanding_amount) {
        return right.outstanding_amount - left.outstanding_amount;
      }

      return right.total_amount - left.total_amount;
    });
}

function buildFinanceTabData(
  orders: OperationalOrderRow[],
  reportPeriodLabel: string,
): FinanceTabData {
  const facts: FinanceOrderFact[] = orders.map((order) => ({
    retailcrm_id: order.retailcrm_id,
    crm_number: order.crm_number,
    customer_name: order.customer_name,
    created_at: order.created_at,
    total_amount: order.total_amount,
    status_label: order.status_label,
    status_group: order.status_group,
    segment_code: order.segment_code,
    segment_label: order.segment_label,
    payment_status: order.payment_status,
    paid_amount: order.paid_amount,
    outstanding_amount: order.outstanding_amount,
    is_partial_payment: order.is_partial_payment,
    is_cancelled_after_payment: order.is_cancelled_after_payment,
    payment_paid_at: order.payment_paid_at,
    has_payment_data: order.has_payment_data,
    manager_url: order.manager_url,
    retailcrm_url: order.retailcrm_url,
  }));
  const hasReliablePaymentData = facts.some((fact) => fact.has_payment_data);

  return {
    report_period_label: reportPeriodLabel,
    has_reliable_payment_data: hasReliablePaymentData,
    facts,
    kpis: buildFinanceKpis(facts, hasReliablePaymentData),
    paymentSummary: hasReliablePaymentData ? buildFinancePaymentSummaryRows(facts) : [],
    segmentRevenue: buildFinanceSegmentRows(facts),
    cancellationLosses: buildCancellationLosses(facts),
    accountingExceptions: hasReliablePaymentData ? buildFinanceExceptions(facts) : [],
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
  const linkSigningSecret = process.env.LINK_SIGNING_SECRET?.trim() ?? null;
  const appBaseUrl = process.env.APP_BASE_URL?.trim() ?? null;

  const [metricsResult, allOrdersResult, notificationLogsResult, adminSettingsResult, kanbanStatuses] =
    await Promise.all([
      supabase.from("daily_order_metrics").select("*").order("order_date", { ascending: true }),
      supabase
        .from("orders")
        .select("retailcrm_id, external_id, customer_name, phone, email, city, total_amount, created_at, status, utm_source, telegram_notified_at, raw_payload")
        .order("created_at", { ascending: false }),
    supabase
      .from("notification_logs")
      .select("order_retailcrm_id, order_number, event_type, channel, recipient, status, attempt, rate_limited, error_message, created_at, delivered_at")
      .order("created_at", { ascending: false })
      .limit(500),
      supabase
        .from("admin_settings")
        .select(
          "singleton_key, notifications_enabled, high_value_enabled, high_value_threshold, missing_contact_enabled, unknown_source_enabled, cancelled_enabled, working_hours_enabled, workday_start_hour, workday_end_hour, timezone",
        )
        .eq("singleton_key", "default")
        .maybeSingle(),
      loadRetailCrmKanbanStatuses(),
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
  const statusLabels = buildKanbanStatusLabelMap(kanbanStatuses);
  const allOrders = await Promise.all(
    (allOrdersResult.data ?? []).map(async (row) => {
      const retailcrmId = Number((row as Record<string, unknown>).retailcrm_id);
      const managerUrl = linkSigningSecret
        ? (
            await buildSignedManagerLink({
              retailcrmId,
              secret: linkSigningSecret,
            })
          ).path
        : null;
      const logisticsUrl = linkSigningSecret
        ? (
            await buildSignedLogisticsLink({
              retailcrmId,
              secret: linkSigningSecret,
              baseUrl: appBaseUrl,
            })
          ).url
        : null;

      return buildOperationalOrderRowFromRecord(row as Record<string, unknown>, {
        retailCrmBaseUrl,
        managerUrl,
        logisticsUrl,
        statusLabels,
      });
    }),
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
  const pendingByOrderId = new Map(
    pendingNotificationOrders.map((order) => [order.retailcrm_id, order.alert_reasons]),
  );
  const kanbanOrders = allOrders
    .map((order) => ({
      ...order,
      alert_reasons: dedupeReasons([
        order.status_group === "new" ? "Новый заказ" : "",
        order.status_group === "approval" ? "Ждёт согласования" : "",
        order.total_amount > adminSettings.high_value_threshold && isOperationallyActive(order)
          ? order.segment_label
          : "",
        order.missing_contact ? "Нет телефона или email" : "",
        !order.address?.trim() ? "Нет адреса" : "",
        !order.items.length ? "Ошибка данных" : "",
        ...(pendingByOrderId.get(order.retailcrm_id) ?? []),
        ...(isSlaOverdue(order) ? ["SLA просрочен"] : []),
      ]),
    }))
    .sort(sortOrdersByUrgency);
  const sourceMetrics = buildSourceMetrics(
    allOrders.map((order) => ({
      utm_source: order.utm_source,
      total_amount: order.total_amount,
    })),
  );
  const notificationLogs = buildNotificationLogFeed(allNotificationLogs, 8);
  const ownerMetrics = buildOwnerMetrics(allOrders, pendingNotificationOrders);
  const summary = summarizeMetrics(allOrders, adminSettings.high_value_threshold);
  const reportPeriodLabel = buildGraphsPeriodLabel(metrics);
  const graphsData: GraphsData = {
    report_title: "Продажи и заказы Tomyris",
    report_period_label: reportPeriodLabel,
    sales_summary: {
      total_orders: summary.totalOrders,
      total_revenue: summary.totalRevenue,
      average_order_value: ownerMetrics.averageOrderValue,
      high_value_share: summary.totalOrders
        ? (summary.highValueOrders / summary.totalOrders) * 100
        : 0,
    },
    sales_trend: buildGraphsTrend(metrics),
    top_products: buildTopProducts(
      (allOrdersResult.data ?? []) as Array<Record<string, unknown>>,
      summary.totalRevenue,
    ),
    top_cities: buildTopCities(allOrders, summary.totalRevenue),
    source_mix: sourceMetrics,
    segment_mix: buildSegmentMix(allOrders, summary.totalRevenue),
  };
  const operationsData = buildOperationsTabData(
    allOrders,
    kanbanOrders,
    kanbanStatuses,
    pendingNotificationOrders,
    adminSettings,
  );
  const marketingData = buildMarketingTabData(allOrders, reportPeriodLabel);
  const financeData = buildFinanceTabData(allOrders, reportPeriodLabel);
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
    summary,
    ownerMetrics,
    graphsData,
    allOrders,
    operationsData,
    marketingData,
    financeData,
    notificationLogs,
  };
}
