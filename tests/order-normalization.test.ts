import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMockExternalId,
  extractOrderAddress,
  formatTelegramMessage,
  isHighValueOrder,
  mapMockOrderToRetailCrmOrder,
  normalizeRetailCrmOrder,
} from "../src/shared/orders";
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

test("formatTelegramMessage includes contact, address and items", () => {
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
  const text = formatTelegramMessage({
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

  assert.match(text, /<b>Толкын Жумагулова<\/b>/);
  assert.match(text, /wa\.me\/77001234567/);
  assert.match(text, /«Утягивающий комбидресс Nova Slim» ×2/);
  assert.match(text, /<i>/);
  assert.equal(extractOrderAddress(rawOrder), "пр. Абая 10, кв 5");
});
