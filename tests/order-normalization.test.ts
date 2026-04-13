import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatWorkingWindow,
  getAlertTypesForOrder,
  isNotificationWindowOpen,
  normalizeAdminSettings,
} from "../src/shared/admin-settings";
import {
  buildMockExternalId,
  extractOrderAddress,
  isHighValueOrder,
  mapMockOrderToRetailCrmOrder,
  normalizeOrderPayments,
  normalizeRetailCrmOrder,
  resolveOrderStatusTransition,
} from "../src/shared/orders";
import {
  buildTelegramNotificationKeyboard,
  formatTelegramOrderMessage,
} from "../src/shared/telegram";
import type { MockOrder, RetailCrmOrderResponse } from "../src/shared/types";

async function readMockOrders() {
  const fileUrl = new URL("../mock_orders.json", import.meta.url);
  const file = await readFile(fileUrl, "utf8");

  return JSON.parse(file) as MockOrder[];
}

test("buildMockExternalId generates deterministic IDs", () => {
  assert.equal(buildMockExternalId(0), "mock-001");
  assert.equal(buildMockExternalId(49), "mock-050");
});

test("mapMockOrderToRetailCrmOrder preserves source order data", async () => {
  const orders = await readMockOrders();
  const payload = mapMockOrderToRetailCrmOrder(orders[0], 0, orders.length, {
    siteCode: "main",
    utmFieldCode: "utm_source",
  });

  assert.equal(payload.externalId, "mock-001");
  assert.equal(payload.site, "main");
  assert.equal(payload.items.length, orders[0].items.length);
  assert.equal(payload.customFields?.utm_source, orders[0].customFields?.utm_source);
});

test("normalizeRetailCrmOrder calculates totals and extracts utm", () => {
  const retailOrder: RetailCrmOrderResponse = {
    id: 101,
    externalId: "mock-001",
    firstName: "Айгуль",
    lastName: "Касымова",
    phone: "+77001234501",
    email: "aigul.kasymova@example.com",
    createdAt: "2026-04-10 09:00:00",
    status: "new",
    customerComment: "Imported from mock_orders.json. utm_source=instagram",
    delivery: {
      address: {
        city: "Алматы",
      },
    },
    items: [
      {
        productName: "Nova Classic",
        quantity: 2,
        initialPrice: 15000,
      },
      {
        productName: "Nova Lift",
        quantity: 1,
        initialPrice: 22000,
      },
    ],
  };

  const normalized = normalizeRetailCrmOrder(retailOrder);

  assert.equal(normalized.total_amount, 52000);
  assert.equal(normalized.item_count, 3);
  assert.equal(normalized.utm_source, "instagram");
  assert.equal(isHighValueOrder(normalized.total_amount), true);
});

test("normalizeOrderPayments classifies partial and refunded flows", () => {
  const partialPaymentOrder: RetailCrmOrderResponse = {
    id: 201,
    totalSumm: 60000,
    payments: [
      {
        id: 1,
        status: "paid",
        amount: 25000,
        paidAt: "2026-04-13T10:00:00.000Z",
      },
    ],
  };
  const refundedOrder: RetailCrmOrderResponse = {
    id: 202,
    totalSumm: 60000,
    payments: [
      {
        id: 1,
        status: "paid",
        amount: 60000,
        paidAt: "2026-04-13T10:00:00.000Z",
      },
      {
        id: 2,
        status: "refund",
        amount: 60000,
      },
    ],
  };

  const partial = normalizeOrderPayments(partialPaymentOrder, 60000);
  const refunded = normalizeOrderPayments(refundedOrder, 60000);

  assert.equal(partial.payment_status, "partial");
  assert.equal(partial.paid_amount, 25000);
  assert.equal(partial.outstanding_amount, 35000);
  assert.equal(partial.is_partial_payment, true);
  assert.equal(partial.has_payment_data, true);

  assert.equal(refunded.payment_status, "refunded");
  assert.equal(refunded.paid_amount, 0);
  assert.equal(refunded.outstanding_amount, 60000);
});

test("formatTelegramOrderMessage includes compact fields and quoted items", () => {
  const rawOrder: RetailCrmOrderResponse = {
    id: 1,
    number: "65A",
    externalId: "mock-050",
    phone: "+77001234567",
    email: "client@example.com",
    delivery: {
      address: {
        city: "Алматы",
        text: "пр. Абая 10, кв 5",
      },
    },
    items: [
      {
        productName: "Nova Slim",
        quantity: 2,
        initialPrice: 42000,
        offer: {
          displayName: "Утягивающий комбидресс Nova Slim",
        },
      },
    ],
  };
  const text = formatTelegramOrderMessage({
    alert_types: ["high-value", "missing-contact"],
    retailcrm_id: 1,
    external_id: "mock-050",
    customer_name: "Толкын Жумагулова",
    phone: "+77001234567",
    email: "client@example.com",
    city: "Алматы",
    total_amount: 84000,
    created_at: "2026-04-13T10:00:00.000Z",
    utm_source: "instagram",
    raw_payload: rawOrder,
  });

  assert.match(text, /Заказ <code>65A<\/code>/);
  assert.match(text, /<b>Толкын Жумагулова<\/b>/);
  assert.match(text, /wa\.me\/77001234567/);
  assert.match(text, /<blockquote>«Утягивающий комбидресс Nova Slim» - х2 42/);
  assert.match(text, /<i>/);
  assert.match(text, /Дата: /);
  assert.equal(extractOrderAddress(rawOrder), "пр. Абая 10, кв 5");
});

test("buildTelegramNotificationKeyboard omits localhost open button", () => {
  const keyboard = buildTelegramNotificationKeyboard({
    openUrl: "http://localhost:3000/orders/112?sig=test",
    stateId: "state-1",
    status: "sent",
  });

  assert.deepEqual(keyboard, {
    inline_keyboard: [[{ text: "Выполнено", callback_data: "done:init:state-1" }]],
  });
});

test("notification settings normalize schedule and timezone defaults", () => {
  const settings = normalizeAdminSettings({
    workday_start_hour: 20,
    workday_end_hour: 18,
    timezone: "Invalid/Zone",
  });

  assert.equal(settings.workday_start_hour, 20);
  assert.equal(settings.workday_end_hour, 21);
  assert.equal(settings.timezone, "Asia/Almaty");
  assert.equal(formatWorkingWindow(settings), "20:00-21:00 (Asia/Almaty)");
});

test("resolveOrderStatusTransition maps handoff and completion actions", () => {
  assert.deepEqual(resolveOrderStatusTransition("handoff", "assembling"), {
    ok: true,
    nextStatusCode: "send-to-delivery",
    changed: true,
  });
  assert.deepEqual(resolveOrderStatusTransition("handoff", "delivering"), {
    ok: true,
    nextStatusCode: null,
    changed: false,
  });
  assert.deepEqual(resolveOrderStatusTransition("complete", "delivering"), {
    ok: true,
    nextStatusCode: "complete",
    changed: true,
  });
  assert.deepEqual(resolveOrderStatusTransition("complete", "complete"), {
    ok: true,
    nextStatusCode: null,
    changed: false,
  });
  assert.deepEqual(resolveOrderStatusTransition("handoff", "cancel-other"), {
    ok: false,
    error: "Отменённый заказ нельзя передать курьеру.",
  });
});

test("getAlertTypesForOrder respects enabled rules", () => {
  const settings = normalizeAdminSettings({
    high_value_enabled: true,
    high_value_threshold: 45000,
    missing_contact_enabled: true,
    unknown_source_enabled: true,
    cancelled_enabled: true,
  });

  assert.deepEqual(
    getAlertTypesForOrder(
      {
        total_amount: 51000,
        missing_contact: true,
        unknown_source: true,
        status_group: "cancel",
      },
      settings,
    ),
    ["high-value", "missing-contact", "unknown-source", "cancelled"],
  );
});

test("isNotificationWindowOpen checks timezone hour window", () => {
  const settings = normalizeAdminSettings({
    working_hours_enabled: true,
    workday_start_hour: 10,
    workday_end_hour: 19,
    timezone: "Asia/Almaty",
  });

  assert.equal(isNotificationWindowOpen(settings, new Date("2026-04-13T06:30:00.000Z")), true);
  assert.equal(isNotificationWindowOpen(settings, new Date("2026-04-13T15:30:00.000Z")), false);
});
