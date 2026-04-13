import { createSupabaseServerClient } from "./supabase-server";
import type { DailyMetric, DashboardOrderRow, DashboardSummary, SourceMetric } from "@/shared/types";
import { buildSourceMetrics, summarizeMetrics } from "@/shared/orders";

interface DashboardDataSuccess {
  ok: true;
  summary: DashboardSummary;
  metrics: DailyMetric[];
  allOrders: DashboardOrderRow[];
  recentOrders: DashboardOrderRow[];
  highValueOrders: DashboardOrderRow[];
  sourceMetrics: SourceMetric[];
}

interface DashboardDataFailure {
  ok: false;
  reason: "missing-env" | "query-failed";
  message: string;
}

export type DashboardData = DashboardDataSuccess | DashboardDataFailure;

function normalizeMetric(metric: Record<string, unknown>): DailyMetric {
  return {
    order_date: String(metric.order_date),
    orders_count: Number(metric.orders_count ?? 0),
    revenue: Number(metric.revenue ?? 0),
    high_value_orders: Number(metric.high_value_orders ?? 0),
  };
}

function normalizeOrderRow(row: Record<string, unknown>): DashboardOrderRow {
  return {
    retailcrm_id: Number(row.retailcrm_id),
    external_id: row.external_id ? String(row.external_id) : null,
    customer_name: String(row.customer_name ?? "Без имени"),
    city: row.city ? String(row.city) : null,
    total_amount: Number(row.total_amount ?? 0),
    created_at: String(row.created_at),
    status: row.status ? String(row.status) : null,
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

  const [metricsResult, allOrdersResult, recentOrdersResult, highValueOrdersResult] = await Promise.all([
    supabase.from("daily_order_metrics").select("*").order("order_date", { ascending: true }),
    supabase
      .from("orders")
      .select("retailcrm_id, external_id, customer_name, city, total_amount, created_at, status, utm_source")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("retailcrm_id, external_id, customer_name, city, total_amount, created_at, status")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("orders")
      .select("retailcrm_id, external_id, customer_name, city, total_amount, created_at, status")
      .gt("total_amount", 50000)
      .order("total_amount", { ascending: false })
      .limit(5),
  ]);

  const failedQuery = [metricsResult, allOrdersResult, recentOrdersResult, highValueOrdersResult].find(
    (result) => result.error,
  );

  if (failedQuery?.error) {
    return {
      ok: false,
      reason: "query-failed",
      message: failedQuery.error.message,
    };
  }

  const metrics = (metricsResult.data ?? []).map((metric) => normalizeMetric(metric as Record<string, unknown>));
  const allOrders = (allOrdersResult.data ?? []).map((row) =>
    normalizeOrderRow(row as Record<string, unknown>),
  );
  const recentOrders = (recentOrdersResult.data ?? []).map((row) =>
    normalizeOrderRow(row as Record<string, unknown>),
  );
  const highValueOrders = (highValueOrdersResult.data ?? []).map((row) =>
    normalizeOrderRow(row as Record<string, unknown>),
  );
  const sourceMetrics = buildSourceMetrics(
    (allOrdersResult.data ?? []).map((row) => ({
      utm_source: row.utm_source ? String(row.utm_source) : null,
      total_amount: Number(row.total_amount ?? 0),
    })),
  );

  return {
    ok: true,
    summary: summarizeMetrics(metrics, allOrders),
    metrics,
    allOrders,
    recentOrders,
    highValueOrders,
    sourceMetrics,
  };
}
