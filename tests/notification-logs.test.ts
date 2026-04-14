import test from "node:test";
import assert from "node:assert/strict";
import { buildNotificationLogFeed } from "../src/shared/notification-logs";
import { TELEGRAM_MIN_INTERVAL_MS, resolveTelegramRateLimitDelayMs } from "../src/shared/telegram-send-throttle";
import type { NotificationLogItem } from "../src/shared/types";

function buildLog(overrides: Partial<NotificationLogItem>): NotificationLogItem {
  return {
    order_retailcrm_id: 73,
    order_number: "73A",
    event_type: "high-value",
    channel: "telegram",
    recipient: "-1001",
    status: "sent",
    attempt: 1,
    rate_limited: false,
    error_message: null,
    created_at: "2026-04-13T10:00:00.000Z",
    delivered_at: "2026-04-13T10:00:00.000Z",
    ...overrides,
  };
}

test("buildNotificationLogFeed hides stale rate_limited rows when retry later succeeded", () => {
  const logs = [
    buildLog({
      status: "sent",
      attempt: 2,
      created_at: "2026-04-13T10:00:05.000Z",
    }),
    buildLog({
      status: "rate_limited",
      attempt: 1,
      rate_limited: true,
      error_message: "Too Many Requests: retry after 1",
      delivered_at: null,
      created_at: "2026-04-13T10:00:01.000Z",
    }),
  ];

  const feed = buildNotificationLogFeed(logs, 8);

  assert.equal(feed.length, 1);
  assert.equal(feed[0]?.status, "sent");
  assert.equal(feed[0]?.attempt, 2);
});

test("buildNotificationLogFeed keeps active rate_limited rows without final outcome", () => {
  const logs = [
    buildLog({
      status: "rate_limited",
      attempt: 1,
      rate_limited: true,
      error_message: "Too Many Requests: retry after 2",
      delivered_at: null,
      created_at: "2026-04-13T10:00:01.000Z",
    }),
  ];

  const feed = buildNotificationLogFeed(logs, 8);

  assert.equal(feed.length, 1);
  assert.equal(feed[0]?.status, "rate_limited");
});

test("resolveTelegramRateLimitDelayMs respects retry_after and keeps a safe floor", () => {
  assert.equal(resolveTelegramRateLimitDelayMs(undefined), TELEGRAM_MIN_INTERVAL_MS);
  assert.equal(resolveTelegramRateLimitDelayMs(1), 2000);
  assert.equal(resolveTelegramRateLimitDelayMs(0), TELEGRAM_MIN_INTERVAL_MS);
});
