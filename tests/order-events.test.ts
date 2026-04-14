import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOperationalTouchIndex,
  buildRetailCrmSnapshotEvents,
  calculateMedianFirstTouchMinutes,
} from "../src/shared/order-events";
import type { OrderRecordInput } from "../src/shared/types";

function buildRecord(overrides: Partial<OrderRecordInput> = {}): OrderRecordInput {
  return {
    retailcrm_id: 101,
    external_id: "demo-101",
    customer_name: "Тестовый Клиент",
    phone: "+77001234567",
    email: "test@example.com",
    city: "Алматы",
    utm_source: "instagram",
    status: "new",
    item_count: 1,
    total_amount: 50000,
    created_at: "2026-04-14T10:00:00.000Z",
    updated_at: "2026-04-14T10:05:00.000Z",
    synced_at: "2026-04-14T10:06:00.000Z",
    last_seen_in_retailcrm_at: "2026-04-14T10:06:00.000Z",
    sync_state: "synced",
    raw_payload: {
      id: 101,
      number: "101A",
    },
    ...overrides,
  };
}

test("buildRetailCrmSnapshotEvents returns create event for new snapshot", () => {
  const events = buildRetailCrmSnapshotEvents({
    previous: null,
    next: buildRecord(),
    eventSource: "retailcrm-poll",
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.event_type, "snapshot-created");
});

test("buildRetailCrmSnapshotEvents returns diff events for changed fields", () => {
  const events = buildRetailCrmSnapshotEvents({
    previous: {
      retailcrm_id: 101,
      external_id: "demo-101",
      status: "new",
      total_amount: 50000,
      utm_source: "instagram",
      updated_at: "2026-04-14T10:05:00.000Z",
      sync_state: "missing_in_retailcrm",
    },
    next: buildRecord({
      status: "send-to-delivery",
      total_amount: 62000,
      utm_source: "direct",
      updated_at: "2026-04-14T10:30:00.000Z",
    }),
    eventSource: "retailcrm-poll",
  });

  assert.deepEqual(
    events.map((event) => event.event_type).sort(),
    ["amount-changed", "restored-in-retailcrm", "source-changed", "status-changed"],
  );
});

test("buildOperationalTouchIndex picks earliest touch event", () => {
  const touchIndex = buildOperationalTouchIndex(
    [
      {
        retailcrm_id: 101,
        created_at: "2026-04-14T10:00:00.000Z",
      },
    ],
    [
      {
        id: "2",
        event_key: "status-updated:101",
        order_retailcrm_id: 101,
        event_type: "status-updated",
        event_source: "kanban",
        event_at: "2026-04-14T10:12:00.000Z",
        actor_label: null,
        payload: {},
        created_at: "2026-04-14T10:12:00.000Z",
      },
      {
        id: "1",
        event_key: "manager-opened:101",
        order_retailcrm_id: 101,
        event_type: "manager-opened",
        event_source: "manager-page",
        event_at: "2026-04-14T10:07:00.000Z",
        actor_label: null,
        payload: {},
        created_at: "2026-04-14T10:07:00.000Z",
      },
    ],
  );

  assert.deepEqual(touchIndex.get(101), {
    first_touch_at: "2026-04-14T10:07:00.000Z",
    first_touch_source: "manager-page",
    first_touch_minutes: 7,
  });
});

test("calculateMedianFirstTouchMinutes returns median", () => {
  assert.equal(
    calculateMedianFirstTouchMinutes([
      { first_touch_at: "2026-04-14T10:05:00.000Z", first_touch_source: "manager", first_touch_minutes: 5 },
      { first_touch_at: "2026-04-14T10:15:00.000Z", first_touch_source: "manager", first_touch_minutes: 15 },
      { first_touch_at: "2026-04-14T10:25:00.000Z", first_touch_source: "manager", first_touch_minutes: 25 },
    ]),
    15,
  );
});
