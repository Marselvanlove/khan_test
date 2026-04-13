import test from "node:test";
import assert from "node:assert/strict";
import { buildSignedLogisticsLink, buildSignedManagerLink, verifyLogisticsToken, verifySignedManagerLink } from "../src/shared/order-links";
import { createRetailCrmClient } from "../src/shared/retailcrm";
import { handleTelegramCallbackUpdate } from "../src/lib/telegram-workflow";
import { TelegramApiError } from "../src/shared/telegram-api";

test("signed links validate for manager and logistics routes", async () => {
  const secret = "test-secret";
  const managerLink = await buildSignedManagerLink({
    retailcrmId: 112,
    secret,
    baseUrl: "https://example.com",
  });
  const logisticsLink = await buildSignedLogisticsLink({
    retailcrmId: 112,
    secret,
    baseUrl: "https://example.com",
  });
  const managerUrl = new URL(managerLink.url!);
  const logisticsUrl = new URL(logisticsLink.url!);

  assert.equal(
    await verifySignedManagerLink({
      retailcrmId: 112,
      secret,
      expiresAt: Number(managerUrl.searchParams.get("exp")),
      signature: String(managerUrl.searchParams.get("sig")),
    }),
    true,
  );
  assert.equal(
    await verifyLogisticsToken({
      retailcrmId: 112,
      secret,
      token: String(logisticsUrl.searchParams.get("token")),
    }),
    true,
  );
});

test("handleTelegramCallbackUpdate switches to confirmation keyboard", async () => {
  const calls: string[] = [];

  await handleTelegramCallbackUpdate(
    {
      callback_query: {
        id: "cbq-1",
        data: "done:init:state-1",
        from: { id: 7, username: "manager" },
        message: {
          message_id: 101,
          chat: { id: "-1001" },
        },
      },
    },
    {
      getMessageState: async () => ({
        id: "state-1",
        order_retailcrm_id: 112,
        chat_id: "-1001",
        message_id: 101,
        alert_types: ["high-value"],
        status: "sent",
        completed_at: null,
        completed_by_user_id: null,
        completed_by_username: null,
        crm_status_before: null,
        crm_status_after: null,
        created_at: new Date().toISOString(),
      }),
      loadOrderContext: async () => ({
        payload: {
          alert_types: ["high-value"],
          retailcrm_id: 112,
          external_id: "demo-001",
          customer_name: "Тестовый Клиент",
          phone: "+77001234567",
          email: null,
          city: "Алматы",
          total_amount: 78000,
          created_at: "2026-04-13T10:00:00.000Z",
          utm_source: "instagram",
          raw_payload: {
            id: 112,
            number: "112A",
            items: [{ productName: "Nova", quantity: 1, initialPrice: 78000 }],
          },
        },
        timezone: "Asia/Almaty",
        openUrl: "https://example.com/orders/112?exp=1&sig=abc",
      }),
      markConfirming: async () => {
        calls.push("confirming");
      },
      markSent: async () => {
        throw new Error("unexpected");
      },
      markCompleted: async () => {
        throw new Error("unexpected");
      },
      completeOrder: async () => {
        throw new Error("unexpected");
      },
      answerCallbackQuery: async () => {
        calls.push("answered");
      },
      editReplyMarkup: async ({ replyMarkup }) => {
        calls.push(JSON.stringify(replyMarkup));
      },
      editMessageText: async () => {
        throw new Error("unexpected");
      },
    },
  );

  assert.deepEqual(calls, [
    "confirming",
    "answered",
    JSON.stringify({
      inline_keyboard: [
        [{ text: "Открыть", url: "https://example.com/orders/112?exp=1&sig=abc" }],
        [
          { text: "Подтвердить", callback_data: "done:confirm:state-1" },
          { text: "Отмена", callback_data: "done:cancel:state-1" },
        ],
      ],
    }),
  ]);
});

test("handleTelegramCallbackUpdate completes order and edits message", async () => {
  const calls: string[] = [];

  await handleTelegramCallbackUpdate(
    {
      callback_query: {
        id: "cbq-2",
        data: "done:confirm:state-2",
        from: { id: 8, username: "ops-manager" },
        message: {
          message_id: 202,
          chat: { id: "-1002" },
        },
      },
    },
    {
      getMessageState: async () => ({
        id: "state-2",
        order_retailcrm_id: 113,
        chat_id: "-1002",
        message_id: 202,
        alert_types: ["high-value"],
        status: "confirming",
        completed_at: null,
        completed_by_user_id: null,
        completed_by_username: null,
        crm_status_before: null,
        crm_status_after: null,
        created_at: new Date().toISOString(),
      }),
      loadOrderContext: async () => {
        throw new Error("unexpected");
      },
      markConfirming: async () => {
        throw new Error("unexpected");
      },
      markSent: async () => {
        throw new Error("unexpected");
      },
      markCompleted: async ({ previousStatus, nextStatus, username }) => {
        calls.push(`${previousStatus}->${nextStatus}:${username}`);
      },
      completeOrder: async () => ({
        payload: {
          alert_types: ["high-value"],
          retailcrm_id: 113,
          external_id: "demo-002",
          customer_name: "Завершённый Клиент",
          phone: "+77005554433",
          email: null,
          city: "Астана",
          total_amount: 99000,
          created_at: "2026-04-13T12:00:00.000Z",
          utm_source: "direct",
          raw_payload: {
            id: 113,
            number: "113A",
            phone: "+77005554433",
            status: "complete",
            items: [{ productName: "Nova Lift", quantity: 2, initialPrice: 49500 }],
          },
        },
        timezone: "Asia/Almaty",
        openUrl: "https://example.com/orders/113?exp=1&sig=abc",
        rawOrder: {
          id: 113,
          number: "113A",
          status: "complete",
          items: [{ productName: "Nova Lift", quantity: 2, initialPrice: 49500 }],
        },
        previousStatus: "assembling",
        nextStatus: "complete",
      }),
      answerCallbackQuery: async () => {
        calls.push("answered");
      },
      editReplyMarkup: async () => {
        throw new Error("unexpected");
      },
      editMessageText: async ({ text, replyMarkup }) => {
        calls.push(text);
        calls.push(JSON.stringify(replyMarkup));
      },
    },
  );

  assert.match(calls[2], /<s>/);
  assert.equal(
    calls[3],
    JSON.stringify({
      inline_keyboard: [[{ text: "Открыть", url: "https://example.com/orders/113?exp=1&sig=abc" }]],
    }),
  );
  assert.equal(calls[0], "assembling->complete:ops-manager");
});

test("handleTelegramCallbackUpdate ignores stale callback query errors", async () => {
  const calls: string[] = [];

  await handleTelegramCallbackUpdate(
    {
      callback_query: {
        id: "cbq-stale",
        data: "done:init:state-stale",
        from: { id: 9, username: "manager" },
        message: {
          message_id: 303,
          chat: { id: "-1003" },
        },
      },
    },
    {
      getMessageState: async () => ({
        id: "state-stale",
        order_retailcrm_id: 114,
        chat_id: "-1003",
        message_id: 303,
        alert_types: ["high-value"],
        status: "sent",
        completed_at: null,
        completed_by_user_id: null,
        completed_by_username: null,
        crm_status_before: null,
        crm_status_after: null,
        created_at: new Date().toISOString(),
      }),
      loadOrderContext: async () => ({
        payload: {
          alert_types: ["high-value"],
          retailcrm_id: 114,
          external_id: "demo-003",
          customer_name: "Отложенный Клиент",
          phone: "+77000000000",
          email: null,
          city: "Алматы",
          total_amount: 65000,
          created_at: "2026-04-13T13:00:00.000Z",
          utm_source: "instagram",
          raw_payload: {
            id: 114,
            number: "114A",
            items: [{ productName: "Nova", quantity: 1, initialPrice: 65000 }],
          },
        },
        timezone: "Asia/Almaty",
        openUrl: "https://example.com/orders/114?exp=1&sig=abc",
      }),
      markConfirming: async () => {
        calls.push("confirming");
      },
      markSent: async () => {
        throw new Error("unexpected");
      },
      markCompleted: async () => {
        throw new Error("unexpected");
      },
      completeOrder: async () => {
        throw new Error("unexpected");
      },
      answerCallbackQuery: async () => {
        throw new TelegramApiError(
          "query too old",
          400,
          {
            description: "Bad Request: query is too old and response timeout expired or query ID is invalid",
          },
        );
      },
      editReplyMarkup: async ({ replyMarkup }) => {
        calls.push(JSON.stringify(replyMarkup));
      },
      editMessageText: async () => {
        throw new Error("unexpected");
      },
    },
  );

  assert.deepEqual(calls, [
    "confirming",
    JSON.stringify({
      inline_keyboard: [
        [{ text: "Открыть", url: "https://example.com/orders/114?exp=1&sig=abc" }],
        [
          { text: "Подтвердить", callback_data: "done:confirm:state-stale" },
          { text: "Отмена", callback_data: "done:cancel:state-stale" },
        ],
      ],
    }),
  ]);
});

test("retailcrm client builds getOrder and editOrder requests", async () => {
  const requests: Array<{ url: string; method: string; body: string | null }> = [];
  const originalFetch = global.fetch;

  global.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      body:
        typeof init?.body === "string"
          ? init.body
          : init?.body instanceof URLSearchParams
            ? init.body.toString()
            : null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: 112,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof global.fetch;

  try {
    const client = createRetailCrmClient({
      baseUrl: "https://example.com",
      apiKey: "secret",
      defaultSite: "xmamyrov",
    });

    await client.getOrder(112, { by: "id" });
    await client.editOrder(
      "demo-001",
      {
        status: "complete",
      },
      { by: "externalId", siteCode: "xmamyrov" },
    );

    assert.match(requests[0].url, /\/api\/v5\/orders\/112\?by=id&apiKey=secret/);
    assert.equal(requests[1].method, "POST");
    assert.match(requests[1].url, /\/api\/v5\/orders\/demo-001\/edit\?apiKey=secret/);
    assert.match(String(requests[1].body), /by=externalId/);
    assert.match(String(requests[1].body), /site=xmamyrov/);
    assert.match(String(requests[1].body), /status/);
  } finally {
    global.fetch = originalFetch;
  }
});
