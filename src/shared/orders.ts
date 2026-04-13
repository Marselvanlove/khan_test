import type {
  DailyMetric,
  DashboardOrderRow,
  MockOrder,
  OrderRecordInput,
  RetailCrmCreateOrderPayload,
  RetailCrmOrderItem,
  RetailCrmOrderResponse,
  SourceMetric,
} from "./types";

export const HIGH_VALUE_THRESHOLD = 50_000;
export const FREE_SHIPPING_THRESHOLD = 35_000;
export const PREMIUM_EXPRESS_THRESHOLD = 60_000;

export interface MockOrderMappingOptions {
  siteCode: string;
  orderType?: string;
  orderMethod?: string;
  status?: string;
  utmFieldCode?: string;
}

export interface NormalizeOrderOptions {
  utmFieldCode?: string;
}

export function buildMockExternalId(index: number): string {
  return `mock-${String(index + 1).padStart(3, "0")}`;
}

export function buildOfferExternalId(orderIndex: number, itemIndex: number): string {
  return `${buildMockExternalId(orderIndex)}-item-${String(itemIndex + 1).padStart(2, "0")}`;
}

export function formatRetailCrmDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function parseRetailCrmDate(value: string | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withTimezone);

  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function buildSyntheticCreatedAt(index: number, totalOrders: number): string {
  const now = new Date();
  const windowInDays = 28;
  const steps = Math.max(totalOrders - 1, 1);
  const offset = Math.round(((steps - index) / steps) * windowInDays);

  now.setUTCDate(now.getUTCDate() - offset);
  now.setUTCHours(9 + (index % 8), (index * 11) % 60, 0, 0);

  return formatRetailCrmDate(now);
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));

    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

export function calculateItemCount(items: RetailCrmOrderItem[] | null | undefined): number {
  if (!items?.length) {
    return 0;
  }

  return items.reduce((sum, item) => sum + Math.max(0, toNumber(item.quantity ?? 0)), 0);
}

export function calculateOrderTotal(items: RetailCrmOrderItem[] | null | undefined): number {
  if (!items?.length) {
    return 0;
  }

  return items.reduce((sum, item) => {
    const quantity = Math.max(0, toNumber(item.quantity ?? 0));
    const price = Math.max(0, toNumber(item.initialPrice ?? 0));

    return sum + quantity * price;
  }, 0);
}

export function mapMockOrderToRetailCrmOrder(
  order: MockOrder,
  index: number,
  totalOrders: number,
  options: MockOrderMappingOptions,
): RetailCrmCreateOrderPayload {
  const utmSource = order.customFields?.utm_source?.trim();
  const customerComment =
    utmSource && !options.utmFieldCode
      ? `Imported from mock_orders.json. utm_source=${utmSource}`
      : "Imported from mock_orders.json";

  return {
    externalId: buildMockExternalId(index),
    site: options.siteCode,
    firstName: order.firstName,
    lastName: order.lastName,
    phone: order.phone,
    email: order.email,
    countryIso: "KZ",
    createdAt: buildSyntheticCreatedAt(index, totalOrders),
    status: options.status ?? order.status,
    orderType: options.orderType ?? order.orderType,
    orderMethod: options.orderMethod ?? order.orderMethod,
    customerComment,
    customFields:
      utmSource && options.utmFieldCode ? { [options.utmFieldCode]: utmSource } : undefined,
    delivery: order.delivery,
    items: order.items.map((item, itemIndex) => ({
      productName: item.productName,
      quantity: item.quantity,
      initialPrice: item.initialPrice,
      offer: {
        externalId: buildOfferExternalId(index, itemIndex),
        name: item.productName,
      },
    })),
  };
}

export function extractUtmSource(
  order: Pick<RetailCrmOrderResponse, "customFields" | "customerComment">,
  options: NormalizeOrderOptions = {},
): string | null {
  const customFields = order.customFields ?? {};
  const preferredField = options.utmFieldCode;

  if (preferredField) {
    const preferredValue = customFields[preferredField];

    if (typeof preferredValue === "string" && preferredValue.trim()) {
      return preferredValue.trim();
    }
  }

  const defaultValue = customFields.utm_source;

  if (typeof defaultValue === "string" && defaultValue.trim()) {
    return defaultValue.trim();
  }

  const customerComment = order.customerComment ?? "";
  const matched = customerComment.match(/utm_source=([a-z0-9_-]+)/i);

  return matched?.[1] ?? null;
}

export function normalizeRetailCrmOrder(
  order: RetailCrmOrderResponse,
  options: NormalizeOrderOptions = {},
): OrderRecordInput {
  const customerName = [order.firstName, order.lastName].filter(Boolean).join(" ").trim() || "Без имени";
  const totalFromPayload = Math.max(toNumber(order.totalSumm), toNumber(order.summ));
  const calculatedTotal = calculateOrderTotal(order.items);
  const totalAmount = totalFromPayload > 0 ? totalFromPayload : calculatedTotal;
  const itemCount = calculateItemCount(order.items);
  const createdAt = parseRetailCrmDate(order.createdAt);
  const updatedAt = order.updatedAt ? parseRetailCrmDate(order.updatedAt) : createdAt;

  return {
    retailcrm_id: order.id,
    external_id: order.externalId ?? null,
    customer_name: customerName,
    phone: order.phone ?? null,
    email: order.email ?? null,
    city: order.delivery?.address?.city ?? null,
    utm_source: extractUtmSource(order, options),
    status: order.status ?? null,
    item_count: itemCount,
    total_amount: totalAmount,
    created_at: createdAt,
    updated_at: updatedAt,
    raw_payload: order,
  };
}

export function isHighValueOrder(totalAmount: number): boolean {
  return totalAmount > HIGH_VALUE_THRESHOLD;
}

export function formatCurrencyKzt(value: number): string {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTelegramMessage(order: {
  retailcrm_id: number;
  external_id: string | null;
  customer_name: string;
  city: string | null;
  total_amount: number;
  created_at: string;
  utm_source?: string | null;
}): string {
  const orderRef = order.external_id ?? `id:${order.retailcrm_id}`;
  const logistics =
    order.total_amount >= PREMIUM_EXPRESS_THRESHOLD
      ? "DHL express free"
      : order.total_amount >= FREE_SHIPPING_THRESHOLD
        ? "free shipping eligible"
        : "standard shipping";

  return [
    "Новый крупный заказ",
    `Заказ: ${orderRef}`,
    `Клиент: ${order.customer_name}`,
    `Город: ${order.city ?? "не указан"}`,
    `Источник: ${order.utm_source ?? "unknown"}`,
    `Сумма: ${formatCurrencyKzt(order.total_amount)}`,
    `Сегмент: ${logistics}`,
    `Дата: ${formatOrderDate(order.created_at)}`,
  ].join("\n");
}

export function summarizeMetrics(metrics: DailyMetric[], orders: DashboardOrderRow[]) {
  const summary = metrics.reduce(
    (draft, metric) => {
      draft.totalOrders += metric.orders_count;
      draft.totalRevenue += metric.revenue;
      draft.highValueOrders += metric.high_value_orders;

      return draft;
    },
    {
      totalOrders: 0,
      totalRevenue: 0,
      highValueOrders: 0,
      freeShippingOrders: 0,
      premiumExpressOrders: 0,
    },
  );

  for (const order of orders) {
    if (order.total_amount >= FREE_SHIPPING_THRESHOLD) {
      summary.freeShippingOrders += 1;
    }

    if (order.total_amount >= PREMIUM_EXPRESS_THRESHOLD) {
      summary.premiumExpressOrders += 1;
    }
  }

  return summary;
}

export function buildSourceMetrics(
  orders: Array<Pick<OrderRecordInput, "utm_source" | "total_amount">>,
): SourceMetric[] {
  const summary = new Map<string, SourceMetric>();

  for (const order of orders) {
    const source = order.utm_source?.trim() || "unknown";
    const current = summary.get(source) ?? { source, orders: 0, revenue: 0 };

    current.orders += 1;
    current.revenue += order.total_amount;
    summary.set(source, current);
  }

  return Array.from(summary.values()).sort((left, right) => {
    if (right.orders !== left.orders) {
      return right.orders - left.orders;
    }

    return right.revenue - left.revenue;
  });
}
