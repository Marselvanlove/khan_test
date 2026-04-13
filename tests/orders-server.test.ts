import test from "node:test";
import assert from "node:assert/strict";
import { resolveAppBaseUrl } from "../src/lib/orders-server";

test("resolveAppBaseUrl prefers forwarded public host over localhost env", () => {
  const previous = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "http://localhost:3000";

  try {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "demo-public.trycloudflare.com",
    });

    assert.equal(resolveAppBaseUrl(headers), "https://demo-public.trycloudflare.com");
  } finally {
    if (previous == null) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous;
    }
  }
});
