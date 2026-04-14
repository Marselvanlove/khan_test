import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDashboardOperatorAccess,
  hasOrderWriteAccess,
  normalizeOrderWriteAccessPayload,
} from "../src/lib/order-write-access";
import { PATCH as updateOrderRoute } from "../src/app/api/orders/[retailcrmId]/route";
import { buildSignedManagerLink } from "../src/shared/order-links";

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
});

test("normalizeOrderWriteAccessPayload sanitizes arbitrary input", () => {
  assert.deepEqual(normalizeOrderWriteAccessPayload(null), {});
  assert.deepEqual(
    normalizeOrderWriteAccessPayload({
      manager_signature: " sig ",
      manager_expires_at: "1710000000",
      operator_token: " ops ",
    }),
    {
      manager_signature: "sig",
      manager_expires_at: 1710000000,
      operator_token: "ops",
    },
  );
});

test("hasOrderWriteAccess accepts signed manager link", async () => {
  process.env.LINK_SIGNING_SECRET = "link-secret";

  const link = await buildSignedManagerLink({
    retailcrmId: 812,
    secret: "link-secret",
    baseUrl: "https://example.com",
  });

  assert.equal(
    await hasOrderWriteAccess({
      retailcrmId: 812,
      access: {
        manager_signature: link.signature,
        manager_expires_at: link.expiresAt,
      },
    }),
    true,
  );
});

test("assertDashboardOperatorAccess requires exact token", () => {
  process.env.DASHBOARD_OPERATOR_TOKEN = "ops-token";

  assert.doesNotThrow(() => assertDashboardOperatorAccess("ops-token"));
  assert.throws(() => assertDashboardOperatorAccess("wrong-token"), /read-only/i);
});

test("PATCH order route rejects unauthorized edits", async () => {
  const response = await updateOrderRoute(
    new Request("http://localhost/api/orders/812", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: "Айгерим",
      }),
    }),
    { params: Promise.resolve({ retailcrmId: "812" }) },
  );

  assert.equal(response.status, 401);
  assert.match(await response.text(), /manager-link|DASHBOARD_OPERATOR_TOKEN/i);
});
