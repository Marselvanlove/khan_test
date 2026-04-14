import type {
  OrderEventItem,
  OrderEventType,
  OrderRecordInput,
} from "./types";

export interface ExistingOrderSnapshot {
  retailcrm_id: number;
  external_id: string | null;
  status: string | null;
  total_amount: number;
  utm_source: string | null;
  updated_at: string;
  sync_state: "synced" | "missing_in_retailcrm";
}

export interface OrderReactionState {
  first_touch_at: string | null;
  first_touch_source: string | null;
  first_touch_minutes: number | null;
}

const REACTION_EVENT_TYPES = new Set<OrderEventType>([
  "manager-opened",
  "logistics-opened",
  "status-updated",
  "telegram-completed",
]);

const ORDER_EVENT_LABELS: Record<OrderEventType, string> = {
  "snapshot-created": "Заказ появился в snapshot",
  "status-changed": "Статус изменился в RetailCRM",
  "amount-changed": "Сумма заказа изменилась",
  "source-changed": "Источник заказа изменился",
  "missing-in-retailcrm": "Заказ пропал из RetailCRM",
  "restored-in-retailcrm": "Заказ снова найден в RetailCRM",
  "notification-sent": "Уведомление отправлено",
  "manager-opened": "Менеджер открыл карточку",
  "logistics-opened": "Логистика открыла карточку",
  "status-updated": "Статус изменён вручную",
  "telegram-completed": "Заказ завершён из Telegram",
};

function normalizePayload(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeString(value: string | null | undefined) {
  return value?.trim() || null;
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function buildEventKey(parts: Array<string | number | null | undefined>) {
  return parts
    .map((value) => (value == null || value === "" ? "na" : String(value)))
    .join(":");
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function getOrderEventTypeLabel(type: OrderEventType) {
  return ORDER_EVENT_LABELS[type];
}

export function normalizeOrderEvent(row: Record<string, unknown>): OrderEventItem {
  return {
    id: String(row.id),
    event_key: String(row.event_key ?? ""),
    order_retailcrm_id: Number(row.order_retailcrm_id),
    event_type: String(row.event_type ?? "snapshot-created") as OrderEventType,
    event_source: String(row.event_source ?? "unknown"),
    event_at: String(row.event_at),
    actor_label: row.actor_label ? String(row.actor_label) : null,
    payload: normalizePayload(row.payload),
    created_at: String(row.created_at),
  };
}

export function buildOrderEvent(params: {
  eventKey: string;
  orderRetailCrmId: number;
  eventType: OrderEventType;
  eventSource: string;
  eventAt: string | Date;
  actorLabel?: string | null;
  payload?: Record<string, unknown>;
}): {
  event_key: string;
  order_retailcrm_id: number;
  event_type: OrderEventType;
  event_source: string;
  event_at: string;
  actor_label: string | null;
  payload: Record<string, unknown>;
} {
  return {
    event_key: params.eventKey,
    order_retailcrm_id: params.orderRetailCrmId,
    event_type: params.eventType,
    event_source: params.eventSource,
    event_at: toIsoString(params.eventAt),
    actor_label: normalizeString(params.actorLabel),
    payload: params.payload ?? {},
  };
}

export function buildRetailCrmSnapshotEvents(params: {
  previous: ExistingOrderSnapshot | null;
  next: OrderRecordInput;
  eventSource: string;
}) {
  const events = [];
  const updatedAt = params.next.updated_at;

  if (!params.previous) {
    events.push(
      buildOrderEvent({
        eventKey: buildEventKey([
          "snapshot-created",
          params.next.retailcrm_id,
          updatedAt,
        ]),
        orderRetailCrmId: params.next.retailcrm_id,
        eventType: "snapshot-created",
        eventSource: params.eventSource,
        eventAt: updatedAt,
        payload: {
          status: params.next.status,
          total_amount: params.next.total_amount,
          utm_source: params.next.utm_source,
        },
      }),
    );

    return events;
  }

  if (params.previous.sync_state === "missing_in_retailcrm") {
    events.push(
      buildOrderEvent({
        eventKey: buildEventKey([
          "restored-in-retailcrm",
          params.next.retailcrm_id,
          updatedAt,
        ]),
        orderRetailCrmId: params.next.retailcrm_id,
        eventType: "restored-in-retailcrm",
        eventSource: params.eventSource,
        eventAt: updatedAt,
        payload: {
          previous_sync_state: params.previous.sync_state,
        },
      }),
    );
  }

  if (normalizeString(params.previous.status) !== normalizeString(params.next.status)) {
    events.push(
      buildOrderEvent({
        eventKey: buildEventKey([
          "status-changed",
          params.next.retailcrm_id,
          params.next.status,
          updatedAt,
        ]),
        orderRetailCrmId: params.next.retailcrm_id,
        eventType: "status-changed",
        eventSource: params.eventSource,
        eventAt: updatedAt,
        payload: {
          previous_status: params.previous.status,
          next_status: params.next.status,
        },
      }),
    );
  }

  if (Number(params.previous.total_amount) !== Number(params.next.total_amount)) {
    events.push(
      buildOrderEvent({
        eventKey: buildEventKey([
          "amount-changed",
          params.next.retailcrm_id,
          params.next.total_amount,
          updatedAt,
        ]),
        orderRetailCrmId: params.next.retailcrm_id,
        eventType: "amount-changed",
        eventSource: params.eventSource,
        eventAt: updatedAt,
        payload: {
          previous_total_amount: params.previous.total_amount,
          next_total_amount: params.next.total_amount,
        },
      }),
    );
  }

  if (normalizeString(params.previous.utm_source) !== normalizeString(params.next.utm_source)) {
    events.push(
      buildOrderEvent({
        eventKey: buildEventKey([
          "source-changed",
          params.next.retailcrm_id,
          params.next.utm_source,
          updatedAt,
        ]),
        orderRetailCrmId: params.next.retailcrm_id,
        eventType: "source-changed",
        eventSource: params.eventSource,
        eventAt: updatedAt,
        payload: {
          previous_utm_source: params.previous.utm_source,
          next_utm_source: params.next.utm_source,
        },
      }),
    );
  }

  return events;
}

export function buildMissingInRetailCrmEvent(params: {
  retailcrmId: number;
  externalId?: string | null;
  eventSource: string;
  eventAt: string | Date;
}) {
  return buildOrderEvent({
    eventKey: buildEventKey(["missing-in-retailcrm", params.retailcrmId]),
    orderRetailCrmId: params.retailcrmId,
    eventType: "missing-in-retailcrm",
    eventSource: params.eventSource,
    eventAt: params.eventAt,
    payload: {
      external_id: params.externalId ?? null,
    },
  });
}

export function buildNotificationSentEvent(params: {
  retailcrmId: number;
  eventAt: string | Date;
  stateId: string;
  alertTypes: string[];
}) {
  return buildOrderEvent({
    eventKey: buildEventKey(["notification-sent", params.retailcrmId, params.stateId]),
    orderRetailCrmId: params.retailcrmId,
    eventType: "notification-sent",
    eventSource: "telegram",
    eventAt: params.eventAt,
    payload: {
      alert_types: params.alertTypes,
      telegram_state_id: params.stateId,
    },
  });
}

export function buildOperationalTouchIndex(
  orders: Array<{ retailcrm_id: number; created_at: string }>,
  events: OrderEventItem[],
) {
  const createdAtByOrderId = new Map(
    orders.map((order) => [order.retailcrm_id, Date.parse(order.created_at)]),
  );
  const stateByOrderId = new Map<number, OrderReactionState>();

  for (const event of events) {
    if (!REACTION_EVENT_TYPES.has(event.event_type)) {
      continue;
    }

    const createdAtMs = createdAtByOrderId.get(event.order_retailcrm_id);
    const eventAtMs = Date.parse(event.event_at);

    if (createdAtMs == null || Number.isNaN(eventAtMs)) {
      continue;
    }

    const current = stateByOrderId.get(event.order_retailcrm_id);

    if (current?.first_touch_at && Date.parse(current.first_touch_at) <= eventAtMs) {
      continue;
    }

    stateByOrderId.set(event.order_retailcrm_id, {
      first_touch_at: event.event_at,
      first_touch_source: event.event_source,
      first_touch_minutes: Math.max(0, Math.round((eventAtMs - createdAtMs) / 60000)),
    });
  }

  return stateByOrderId;
}

export function calculateMedianFirstTouchMinutes(
  states: Iterable<OrderReactionState>,
): number | null {
  const values = Array.from(states)
    .map((state) => state.first_touch_minutes)
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);

  if (!values.length) {
    return null;
  }

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 1) {
    return values[middle] ?? null;
  }

  const left = values[middle - 1] ?? 0;
  const right = values[middle] ?? 0;

  return Math.round((left + right) / 2);
}

export function formatOrderEventPayloadPreview(payload: Record<string, unknown>) {
  const entries = Object.entries(payload)
    .filter(([, value]) => value != null && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`);

  return entries.join(", ");
}

export function normalizeSyncState(value: unknown): "synced" | "missing_in_retailcrm" {
  return value === "missing_in_retailcrm" ? "missing_in_retailcrm" : "synced";
}

export function normalizeOrderSnapshot(
  row: Record<string, unknown>,
): ExistingOrderSnapshot {
  return {
    retailcrm_id: normalizeNumber(row.retailcrm_id),
    external_id: row.external_id ? String(row.external_id) : null,
    status: row.status ? String(row.status) : null,
    total_amount: normalizeNumber(row.total_amount),
    utm_source: row.utm_source ? String(row.utm_source) : null,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    sync_state: normalizeSyncState(row.sync_state),
  };
}
