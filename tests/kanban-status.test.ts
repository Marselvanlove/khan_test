import test from "node:test";
import assert from "node:assert/strict";
import { buildKanbanStatusOptions, getKanbanStageFromStatus, isKanbanStageTransitionAllowed } from "../src/shared/kanban";
import { POST as updateOrderStatusRoute } from "../src/app/api/orders/[retailcrmId]/status/route";
import { resetRetailCrmKanbanStatusesCacheForTests } from "../src/lib/order-status-server";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
}

test.afterEach(() => {
  restoreEnv();
  resetRetailCrmKanbanStatusesCacheForTests();
});

test("kanban helpers map stages and transition matrix", () => {
  assert.equal(
    getKanbanStageFromStatus({ statusCode: "availability-confirmed" }),
    "approval",
  );
  assert.equal(
    getKanbanStageFromStatus({ statusCode: "unknown-code", statusGroup: "delivery" }),
    "delivery",
  );
  assert.equal(isKanbanStageTransitionAllowed("new", "approval"), true);
  assert.equal(isKanbanStageTransitionAllowed("new", "delivery"), false);
});

test("buildKanbanStatusOptions prefers CRM labels and activity", () => {
  const options = buildKanbanStatusOptions([
    {
      code: "client-confirmed",
      name: "Согласовано с клиентом CRM",
      active: true,
    },
    {
      code: "redirect",
      name: "Доставка перенесена CRM",
      active: false,
    },
  ]);

  assert.deepEqual(options, [
    {
      code: "client-confirmed",
      label: "Согласовано с клиентом CRM",
      stage: "approval",
      active: true,
    },
    {
      code: "redirect",
      label: "Доставка перенесена CRM",
      stage: "delivery",
      active: false,
    },
  ]);
});

test("status route rejects invalid payload", async () => {
  const response = await updateOrderStatusRoute(
    new Request("http://localhost/api/orders/501/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "kanban" }),
    }),
    { params: Promise.resolve({ retailcrmId: "501" }) },
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /target_status_code/i);
});

test("status route rejects unauthorized mutations", async () => {
  const response = await updateOrderStatusRoute(
    new Request("http://localhost/api/orders/501/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_status_code: "client-confirmed",
        source: "kanban",
      }),
    }),
    { params: Promise.resolve({ retailcrmId: "501" }) },
  );

  assert.equal(response.status, 401);
  assert.match(await response.text(), /manager-link|DASHBOARD_OPERATOR_TOKEN/i);
});

test("status route updates order when transition is allowed", async () => {
  process.env.RETAILCRM_BASE_URL = "https://crm.example.com";
  process.env.RETAILCRM_API_KEY = "secret";
  process.env.RETAILCRM_SITE_CODE = "main";
  process.env.SUPABASE_URL = "https://supabase.example.com";
  process.env.SUPABASE_SECRET_KEY = "supabase-secret";
  process.env.LINK_SIGNING_SECRET = "link-secret";
  process.env.APP_BASE_URL = "https://dashboard.example.com";
  process.env.DASHBOARD_OPERATOR_TOKEN = "ops-token";

  const requests: Array<{ url: string; method: string; body: string | null }> = [];
  const originalFetch = global.fetch;

  global.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const body =
      typeof init?.body === "string"
        ? init.body
        : init?.body instanceof URLSearchParams
          ? init.body.toString()
          : null;

    requests.push({
      url,
      method: init?.method ?? "GET",
      body,
    });

    if (url.includes("/api/v5/reference/statuses")) {
      return new Response(
        JSON.stringify({
          success: true,
          statuses: [
            { code: "new", name: "Новый", active: true },
            { code: "client-confirmed", name: "Согласовано с клиентом", active: true },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.includes("/api/v5/orders/501?")) {
      return new Response(
        JSON.stringify({
          success: true,
          order: {
            id: 501,
            externalId: "demo-501",
            firstName: "Айгерим",
            lastName: "Тест",
            createdAt: "2026-04-14T10:00:00.000Z",
            status: "new",
            totalSumm: 56000,
            items: [{ productName: "Nova", quantity: 1, initialPrice: 56000 }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.includes("/api/v5/orders/501/edit")) {
      assert.match(body ?? "", /client-confirmed/);

      return new Response(
        JSON.stringify({
          success: true,
          id: 501,
          order: {
            id: 501,
            externalId: "demo-501",
            firstName: "Айгерим",
            lastName: "Тест",
            createdAt: "2026-04-14T10:00:00.000Z",
            status: "client-confirmed",
            totalSumm: 56000,
            items: [{ productName: "Nova", quantity: 1, initialPrice: 56000 }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.includes("supabase.example.com/rest/v1/orders")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("supabase.example.com/rest/v1/order_events")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof global.fetch;

  try {
    const response = await updateOrderStatusRoute(
      new Request("http://localhost/api/orders/501/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_status_code: "client-confirmed",
          source: "kanban",
          access: {
            operator_token: "ops-token",
          },
        }),
      }),
      { params: Promise.resolve({ retailcrmId: "501" }) },
    );
    const payload = (await response.json()) as { ok: boolean; order: { status_code: string; status_group: string } };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.order.status_code, "client-confirmed");
    assert.equal(payload.order.status_group, "approval");
    assert.match(
      requests.map((request) => request.url).join("\n"),
      /\/api\/v5\/orders\/501\/edit/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("status route rejects illegal column transition", async () => {
  process.env.RETAILCRM_BASE_URL = "https://crm.example.com";
  process.env.RETAILCRM_API_KEY = "secret";
  process.env.DASHBOARD_OPERATOR_TOKEN = "ops-token";

  const originalFetch = global.fetch;

  global.fetch = (async (input: URL | RequestInfo) => {
    const url = String(input);

    if (url.includes("/api/v5/reference/statuses")) {
      return new Response(
        JSON.stringify({
          success: true,
          statuses: [
            { code: "new", name: "Новый", active: true },
            { code: "send-to-delivery", name: "Передан в доставку", active: true },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.includes("/api/v5/orders/777?")) {
      return new Response(
        JSON.stringify({
          success: true,
          order: {
            id: 777,
            createdAt: "2026-04-14T10:00:00.000Z",
            status: "new",
            totalSumm: 25000,
            items: [{ productName: "Nova", quantity: 1, initialPrice: 25000 }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof global.fetch;

  try {
    const response = await updateOrderStatusRoute(
      new Request("http://localhost/api/orders/777/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_status_code: "send-to-delivery",
          source: "kanban",
          access: {
            operator_token: "ops-token",
          },
        }),
      }),
      { params: Promise.resolve({ retailcrmId: "777" }) },
    );
    const payload = (await response.json()) as { ok: boolean; error: string };

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /запрещён/i);
  } finally {
    global.fetch = originalFetch;
  }
});
