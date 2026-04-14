import type {
  MockOrder,
  OperationalOrderRow,
  OrderLineItemDetail,
  OrderRecordInput,
  PaymentStatus,
  RetailCrmCreateOrderPayload,
  RetailCrmParty,
  RetailCrmOrderItem,
  RetailCrmOrderResponse,
  SourceMetric,
  StatusSummaryItem,
} from "./types";

export const HIGH_VALUE_THRESHOLD = 50_000;
export const FREE_SHIPPING_THRESHOLD = 35_000;
export const PREMIUM_EXPRESS_THRESHOLD = 60_000;

const MOCK_ORDER_SOURCES: Record<string, string> = {
  "mock-001": "instagram",
  "mock-002": "google",
  "mock-003": "instagram",
  "mock-004": "tiktok",
  "mock-005": "instagram",
  "mock-006": "direct",
  "mock-007": "google",
  "mock-008": "referral",
  "mock-009": "instagram",
  "mock-010": "google",
  "mock-011": "instagram",
  "mock-012": "direct",
  "mock-013": "google",
  "mock-014": "referral",
  "mock-015": "instagram",
  "mock-016": "tiktok",
  "mock-017": "instagram",
  "mock-018": "google",
  "mock-019": "direct",
  "mock-020": "instagram",
  "mock-021": "referral",
  "mock-022": "google",
  "mock-023": "instagram",
  "mock-024": "tiktok",
  "mock-025": "instagram",
  "mock-026": "google",
  "mock-027": "instagram",
  "mock-028": "referral",
  "mock-029": "direct",
  "mock-030": "instagram",
  "mock-031": "google",
  "mock-032": "instagram",
  "mock-033": "direct",
  "mock-034": "tiktok",
  "mock-035": "google",
  "mock-036": "instagram",
  "mock-037": "referral",
  "mock-038": "instagram",
  "mock-039": "google",
  "mock-040": "instagram",
  "mock-041": "direct",
  "mock-042": "instagram",
  "mock-043": "google",
  "mock-044": "tiktok",
  "mock-045": "referral",
  "mock-046": "instagram",
  "mock-047": "google",
  "mock-048": "instagram",
  "mock-049": "direct",
  "mock-050": "referral",
};

const STATUS_META: Record<string, { label: string; group: string; groupLabel: string }> = {
  new: { label: "Новый", group: "new", groupLabel: "Новые" },
  complete: { label: "Выполнен", group: "complete", groupLabel: "Завершены" },
  "partially-completed": {
    label: "Выполнен частично",
    group: "complete",
    groupLabel: "Завершены",
  },
  "availability-confirmed": {
    label: "Наличие подтверждено",
    group: "approval",
    groupLabel: "Согласование",
  },
  "offer-analog": {
    label: "Предложить замену",
    group: "approval",
    groupLabel: "Согласование",
  },
  "ready-to-wait": { label: "Готов ждать", group: "approval", groupLabel: "Согласование" },
  "waiting-for-arrival": {
    label: "Ожидается поступление",
    group: "approval",
    groupLabel: "Согласование",
  },
  "client-confirmed": {
    label: "Согласовано с клиентом",
    group: "approval",
    groupLabel: "Согласование",
  },
  prepayed: { label: "Предоплата поступила", group: "approval", groupLabel: "Согласование" },
  "send-to-assembling": {
    label: "Передано в комплектацию",
    group: "assembling",
    groupLabel: "Комплектация",
  },
  assembling: { label: "Комплектуется", group: "assembling", groupLabel: "Комплектация" },
  "assembling-complete": {
    label: "Укомплектован",
    group: "assembling",
    groupLabel: "Комплектация",
  },
  "send-to-delivery": {
    label: "Передан в доставку",
    group: "delivery",
    groupLabel: "Доставка",
  },
  delivering: { label: "Доставляется", group: "delivery", groupLabel: "Доставка" },
  redirect: { label: "Доставка перенесена", group: "delivery", groupLabel: "Доставка" },
  "ready-for-self-pickup": {
    label: "Готов к самовывозу",
    group: "delivery",
    groupLabel: "Доставка",
  },
  "arrived-in-pickup-point": {
    label: "Прибыл в ПВЗ",
    group: "delivery",
    groupLabel: "Доставка",
  },
  "no-call": { label: "Недозвон", group: "cancel", groupLabel: "Отмены" },
  "no-product": { label: "Нет в наличии", group: "cancel", groupLabel: "Отмены" },
  "already-buyed": { label: "Купил в другом месте", group: "cancel", groupLabel: "Отмены" },
  "delyvery-did-not-suit": {
    label: "Не устроила доставка",
    group: "cancel",
    groupLabel: "Отмены",
  },
  "prices-did-not-suit": {
    label: "Не устроила цена",
    group: "cancel",
    groupLabel: "Отмены",
  },
  "cancel-other": { label: "Отменен", group: "cancel", groupLabel: "Отмены" },
  return: { label: "Возврат", group: "cancel", groupLabel: "Отмены" },
};

export type OrderStatusAction = "handoff" | "complete";

export interface MockOrderMappingOptions {
  siteCode: string;
  orderType?: string;
  orderMethod?: string;
  status?: string;
  utmFieldCode?: string;
  externalIdPrefix?: string;
}

export interface NormalizeOrderOptions {
  utmFieldCode?: string;
  syncedAt?: string;
}

function fallbackMockUtmSource(externalId: string | null | undefined): string | null {
  if (!externalId) {
    return null;
  }

  return MOCK_ORDER_SOURCES[externalId] ?? null;
}

export function buildOrderExternalId(index: number, prefix = "mock"): string {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

export function buildMockExternalId(index: number): string {
  return buildOrderExternalId(index, "mock");
}

export function buildOfferExternalId(orderIndex: number, itemIndex: number, prefix = "mock"): string {
  return `${buildOrderExternalId(orderIndex, prefix)}-item-${String(itemIndex + 1).padStart(2, "0")}`;
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
  const customerComment = utmSource
    ? `Imported from mock_orders.json. utm_source=${utmSource}`
    : "Imported from mock_orders.json";

  return {
    externalId: buildOrderExternalId(index, options.externalIdPrefix ?? "mock"),
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
        externalId: buildOfferExternalId(index, itemIndex, options.externalIdPrefix ?? "mock"),
        name: item.productName,
      },
    })),
  };
}

export function extractUtmSource(
  order: Pick<RetailCrmOrderResponse, "customFields" | "customerComment" | "externalId">,
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

  if (matched?.[1]) {
    return matched[1];
  }

  return fallbackMockUtmSource(order.externalId);
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
  const syncedAt = options.syncedAt ?? new Date().toISOString();

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
    synced_at: syncedAt,
    last_seen_in_retailcrm_at: syncedAt,
    sync_state: "synced",
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

export function formatOrderDateTime(value: string, timezone = "Asia/Almaty"): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatSourceLabel(source: string | null | undefined): string {
  if (!source?.trim()) {
    return "unknown source";
  }

  const normalized = source.trim().toLowerCase();
  const labels: Record<string, string> = {
    instagram: "Instagram",
    google: "Google",
    tiktok: "TikTok",
    referral: "Referral",
    direct: "Direct",
  };

  return labels[normalized] ?? normalized;
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Не оплачено",
  partial: "Частично оплачено",
  paid: "Оплачено",
  refunded: "Возврат",
  unknown: "Нет данных",
};

const REFUND_PAYMENT_STATUSES = ["refund", "returned", "chargeback"];
const UNPAID_PAYMENT_STATUSES = ["not-paid", "unpaid", "await", "pending", "new", "process"];

function normalizePaymentStatusToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isRefundPaymentStatus(value: string): boolean {
  return REFUND_PAYMENT_STATUSES.some((token) => value.includes(token));
}

function isUnpaidPaymentStatus(value: string): boolean {
  return UNPAID_PAYMENT_STATUSES.some((token) => value.includes(token));
}

export function formatPaymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status];
}

export function normalizeOrderPayments(
  order: RetailCrmOrderResponse,
  totalAmount: number,
): {
  paid_amount: number;
  outstanding_amount: number;
  payment_status: PaymentStatus;
  is_partial_payment: boolean;
  payment_paid_at: string | null;
  has_payment_data: boolean;
} {
  const payments = Array.isArray(order.payments)
    ? order.payments.filter((payment): payment is Record<string, unknown> => Boolean(payment))
    : [];

  if (!payments.length) {
    return {
      paid_amount: 0,
      outstanding_amount: Math.max(totalAmount, 0),
      payment_status: "unknown",
      is_partial_payment: false,
      payment_paid_at: null,
      has_payment_data: false,
    };
  }

  let capturedAmount = 0;
  let refundedAmount = 0;
  let latestPaidAt: string | null = null;
  let hasPaymentData = false;

  for (const payment of payments) {
    const status = normalizePaymentStatusToken(payment.status ?? payment.paymentStatus);
    const amount = Math.abs(
      toNumber(
        (payment.amount as number | string | null | undefined) ??
          (payment.paidAmount as number | string | null | undefined) ??
          (payment.sum as number | string | null | undefined) ??
          0,
      ),
    );
    const paidAt = payment.paidAt ? String(payment.paidAt) : null;

    if (status || amount > 0 || paidAt) {
      hasPaymentData = true;
    }

    if (paidAt) {
      if (!latestPaidAt || Date.parse(paidAt) > Date.parse(latestPaidAt)) {
        latestPaidAt = paidAt;
      }
    }

    if (isRefundPaymentStatus(status)) {
      refundedAmount += amount;
      continue;
    }

    if (status && isUnpaidPaymentStatus(status)) {
      continue;
    }

    if (amount > 0) {
      capturedAmount += amount;
    }
  }

  const paidAmount = Math.max(capturedAmount - refundedAmount, 0);
  const outstandingAmount = Math.max(totalAmount - paidAmount, 0);

  let paymentStatus: PaymentStatus = "unknown";

  if (!hasPaymentData) {
    paymentStatus = "unknown";
  } else if (refundedAmount > 0 && paidAmount === 0) {
    paymentStatus = "refunded";
  } else if (paidAmount >= totalAmount && totalAmount > 0) {
    paymentStatus = "paid";
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    paymentStatus = "partial";
  } else if (paidAmount === 0) {
    paymentStatus = "unpaid";
  } else if (refundedAmount > 0) {
    paymentStatus = "refunded";
  }

  return {
    paid_amount: paidAmount,
    outstanding_amount: outstandingAmount,
    payment_status: paymentStatus,
    is_partial_payment: paymentStatus === "partial",
    payment_paid_at: latestPaidAt,
    has_payment_data: hasPaymentData,
  };
}

export function getStatusMeta(statusCode: string | null | undefined) {
  if (statusCode && STATUS_META[statusCode]) {
    return STATUS_META[statusCode];
  }

  if (!statusCode) {
    return {
      label: "Статус не задан",
      group: "unknown",
      groupLabel: "Неизвестно",
    };
  }

  return {
    label: statusCode.replaceAll("-", " "),
    group: "unknown",
    groupLabel: "Неизвестно",
  };
}

export function getSegmentMeta(totalAmount: number) {
  if (totalAmount >= PREMIUM_EXPRESS_THRESHOLD) {
    return { code: "premium-express" as const, label: "60k+ premium / express" };
  }

  if (totalAmount > HIGH_VALUE_THRESHOLD) {
    return { code: "high-value" as const, label: "50k+ крупный заказ" };
  }

  if (totalAmount >= FREE_SHIPPING_THRESHOLD) {
    return { code: "free-shipping" as const, label: "35k+ апселл до high-value" };
  }

  return { code: "under-35" as const, label: "до 35k" };
}

export function getSlaLabel(params: {
  totalAmount: number;
  statusCode: string | null | undefined;
  missingContact: boolean;
}) {
  const statusMeta = getStatusMeta(params.statusCode);

  if (params.missingContact) {
    return "Нужен контакт вручную";
  }

  if (statusMeta.group === "delivery") {
    return "Проверить отгрузку сегодня";
  }

  if (statusMeta.group === "cancel") {
    return "Проверить причину отмены";
  }

  if (params.totalAmount >= PREMIUM_EXPRESS_THRESHOLD) {
    return "Связаться за 5 минут";
  }

  if (params.totalAmount > HIGH_VALUE_THRESHOLD) {
    return "Связаться за 10 минут";
  }

  if (params.totalAmount >= FREE_SHIPPING_THRESHOLD) {
    return "Предложить апселл сегодня";
  }

  return "В обработку сегодня";
}

export function buildRetailCrmOrderUrl(baseUrl: string | null | undefined, retailcrmId: number): string | null {
  if (!baseUrl?.trim()) {
    return null;
  }

  return `${baseUrl.replace(/\/+$/, "")}/admin/orders/${retailcrmId}/edit`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function digitsOnly(value: string): string {
  return value.replaceAll(/\D/g, "");
}

function readPartyAddress(party: RetailCrmParty | null | undefined): string | null {
  return party?.address?.text?.trim() || null;
}

function readPartyPhone(party: RetailCrmParty | null | undefined): string | null {
  const phone = party?.phones?.find((entry) => entry.number?.trim())?.number?.trim();

  return phone || null;
}

export function extractOrderAddress(order: RetailCrmOrderResponse): string | null {
  return (
    order.delivery?.address?.text?.trim() ||
    readPartyAddress(order.customer) ||
    readPartyAddress(order.contact) ||
    null
  );
}

export function extractOrderPhone(order: RetailCrmOrderResponse, fallback?: string | null): string | null {
  return (
    fallback?.trim() ||
    order.phone?.trim() ||
    readPartyPhone(order.customer) ||
    readPartyPhone(order.contact) ||
    null
  );
}

export function extractOrderEmail(order: RetailCrmOrderResponse, fallback?: string | null): string | null {
  return (
    fallback?.trim() ||
    order.email?.trim() ||
    order.customer?.email?.trim() ||
    order.contact?.email?.trim() ||
    null
  );
}

export function extractOrderNumber(order: RetailCrmOrderResponse, fallbackExternalId?: string | null): string {
  return order.number?.trim() || fallbackExternalId || String(order.id);
}

export function extractOrderItems(order: RetailCrmOrderResponse): Array<{ name: string; quantity: number }> {
  return (order.items ?? [])
    .map((item) => ({
      name: item.offer?.displayName || item.offer?.name || item.productName || "Товар без названия",
      quantity: Math.max(1, toNumber(item.quantity ?? 1)),
    }))
    .filter((item) => item.name.trim());
}

export function extractOrderItemDetails(order: RetailCrmOrderResponse): OrderLineItemDetail[] {
  return (order.items ?? [])
    .map((item) => {
      const quantity = Math.max(1, toNumber(item.quantity ?? 1));
      const initialPrice = Math.max(0, toNumber(item.initialPrice ?? 0));

      return {
        name: item.offer?.displayName || item.offer?.name || item.productName || "Товар без названия",
        quantity,
        initial_price: initialPrice,
        total_price: initialPrice * quantity,
      };
    })
    .filter((item) => item.name.trim());
}

export function formatOrderItemUnitLine(item: Pick<OrderLineItemDetail, "name" | "quantity" | "initial_price">) {
  return `«${item.name}» - х${item.quantity} ${formatCurrencyKzt(item.initial_price)}`;
}

export function buildWhatsappUrl(phone: string | null): string | null {
  if (!phone) {
    return null;
  }

  const digits = digitsOnly(phone);

  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}`;
}

export function getOrderCustomerName(
  order: RetailCrmOrderResponse,
  fallback = "Без имени",
): string {
  const value = [order.firstName, order.lastName].filter(Boolean).join(" ").trim();

  return value || fallback;
}

export function splitCustomerName(customerName: string | null | undefined) {
  const value = customerName?.trim() ?? "";

  if (!value) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const [firstName, ...rest] = value.split(/\s+/);

  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export function getKnownStatusOptions() {
  return Object.entries(STATUS_META).map(([code, meta]) => ({
    code,
    label: meta.label,
    group: meta.groupLabel,
  }));
}

export function resolveOrderStatusTransition(
  action: OrderStatusAction,
  statusCode: string | null | undefined,
) {
  const statusMeta = getStatusMeta(statusCode);

  if (action === "handoff") {
    if (statusMeta.group === "complete") {
      return {
        ok: false as const,
        error: "Заказ уже завершён.",
      };
    }

    if (statusMeta.group === "cancel") {
      return {
        ok: false as const,
        error: "Отменённый заказ нельзя передать курьеру.",
      };
    }

    if (statusMeta.group === "delivery") {
      return {
        ok: true as const,
        nextStatusCode: null,
        changed: false,
      };
    }

    return {
      ok: true as const,
      nextStatusCode: "send-to-delivery",
      changed: true,
    };
  }

  if (statusMeta.group === "complete") {
    return {
      ok: true as const,
      nextStatusCode: null,
      changed: false,
    };
  }

  if (statusMeta.group === "cancel") {
    return {
      ok: false as const,
      error: "Отменённый заказ нельзя завершить.",
    };
  }

  return {
    ok: true as const,
    nextStatusCode: "complete",
    changed: true,
  };
}

export function buildOperationalOrderRowFromRecord(
  row: Record<string, unknown>,
  options: {
    retailCrmBaseUrl: string | null;
    managerUrl?: string | null;
    logisticsUrl?: string | null;
    statusLabels?: Record<string, string>;
    firstTouchAt?: string | null;
    firstTouchSource?: string | null;
    firstTouchMinutes?: number | null;
  },
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
  const paymentMeta = normalizeOrderPayments(rawPayload, totalAmount);

  return {
    retailcrm_id: retailcrmId,
    crm_number: extractOrderNumber(rawPayload, externalId),
    external_id: externalId,
    customer_name: String(row.customer_name ?? getOrderCustomerName(rawPayload)),
    first_name: typeof rawPayload.firstName === "string" ? rawPayload.firstName : null,
    last_name: typeof rawPayload.lastName === "string" ? rawPayload.lastName : null,
    phone,
    whatsapp_url: buildWhatsappUrl(phone),
    email,
    city: row.city ? String(row.city) : rawPayload.delivery?.address?.city ?? null,
    address,
    customer_comment:
      typeof rawPayload.customerComment === "string" ? rawPayload.customerComment : null,
    total_amount: totalAmount,
    created_at: String(row.created_at),
    utm_source: source,
    source_label: formatSourceLabel(source),
    status_code: statusCode,
    status_label: statusCode ? options.statusLabels?.[statusCode] ?? statusMeta.label : statusMeta.label,
    status_group: statusMeta.group,
    status_group_label: statusMeta.groupLabel,
    segment_code: segment.code,
    segment_label: segment.label,
    sla_label:
      options.firstTouchMinutes != null
        ? `Первая реакция за ${options.firstTouchMinutes} мин`
        : getSlaLabel({
            totalAmount,
            statusCode,
            missingContact,
          }),
    retailcrm_url: buildRetailCrmOrderUrl(options.retailCrmBaseUrl, retailcrmId),
    manager_url: options.managerUrl ?? null,
    logistics_url: options.logisticsUrl ?? null,
    items: extractOrderItemDetails(rawPayload),
    missing_contact: missingContact,
    unknown_source: unknownSource,
    paid_amount: paymentMeta.paid_amount,
    outstanding_amount: paymentMeta.outstanding_amount,
    payment_status: paymentMeta.payment_status,
    is_partial_payment: paymentMeta.is_partial_payment,
    is_cancelled_after_payment:
      statusMeta.group === "cancel" && paymentMeta.paid_amount > 0,
    payment_paid_at: paymentMeta.payment_paid_at,
    has_payment_data: paymentMeta.has_payment_data,
    telegram_notified_at: row.telegram_notified_at ? String(row.telegram_notified_at) : null,
    synced_at: row.synced_at ? String(row.synced_at) : null,
    last_seen_in_retailcrm_at: row.last_seen_in_retailcrm_at
      ? String(row.last_seen_in_retailcrm_at)
      : null,
    sync_state: row.sync_state === "missing_in_retailcrm" ? "missing_in_retailcrm" : "synced",
    first_touch_at: options.firstTouchAt ?? null,
    first_touch_source: options.firstTouchSource ?? null,
    first_touch_minutes: options.firstTouchMinutes ?? null,
    alert_reasons: [],
  };
}

export function summarizeMetrics(
  orders: Array<Pick<OperationalOrderRow, "total_amount" | "unknown_source" | "missing_contact">>,
  highValueThreshold: number,
) {
  const summary = {
    totalOrders: 0,
    totalRevenue: 0,
    highValueOrders: 0,
    freeShippingOrders: 0,
    premiumExpressOrders: 0,
    unknownSourceOrders: 0,
    ordersWithoutContact: 0,
  };

  for (const order of orders) {
    summary.totalOrders += 1;
    summary.totalRevenue += order.total_amount;

    if (order.total_amount > highValueThreshold) {
      summary.highValueOrders += 1;
    }

    if (order.total_amount >= FREE_SHIPPING_THRESHOLD) {
      summary.freeShippingOrders += 1;
    }

    if (order.total_amount >= PREMIUM_EXPRESS_THRESHOLD) {
      summary.premiumExpressOrders += 1;
    }

    if (order.unknown_source) {
      summary.unknownSourceOrders += 1;
    }

    if (order.missing_contact) {
      summary.ordersWithoutContact += 1;
    }
  }

  return summary;
}

export function buildSourceMetrics(
  orders: Array<Pick<OrderRecordInput, "utm_source" | "total_amount">>,
): SourceMetric[] {
  const summary = new Map<string, SourceMetric>();

  for (const order of orders) {
    const source = formatSourceLabel(order.utm_source);
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

export function buildStatusSummary(orders: Array<Pick<OperationalOrderRow, "status_group" | "status_group_label">>): StatusSummaryItem[] {
  const summary = new Map<string, StatusSummaryItem>();

  for (const order of orders) {
    const key = order.status_group;
    const current = summary.get(key) ?? {
      group: order.status_group,
      label: order.status_group_label,
      count: 0,
    };

    current.count += 1;
    summary.set(key, current);
  }

  return Array.from(summary.values()).sort((left, right) => right.count - left.count);
}
