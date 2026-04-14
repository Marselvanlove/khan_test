export const TELEGRAM_MIN_INTERVAL_MS = 1200;

export interface TelegramSendThrottle {
  nextAllowedAt: number;
}

export function createTelegramSendThrottle(): TelegramSendThrottle {
  return { nextAllowedAt: 0 };
}

export function getTelegramThrottleWaitMs(
  throttle: TelegramSendThrottle,
  now = Date.now(),
) {
  return Math.max(0, throttle.nextAllowedAt - now);
}

export function scheduleTelegramSend(
  throttle: TelegramSendThrottle,
  delayMs: number,
  now = Date.now(),
) {
  throttle.nextAllowedAt = now + Math.max(0, delayMs);
}

export function resolveTelegramRateLimitDelayMs(
  retryAfterSeconds: unknown,
  minIntervalMs = TELEGRAM_MIN_INTERVAL_MS,
) {
  const retryAfter = Number(retryAfterSeconds);

  if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
    return minIntervalMs;
  }

  return Math.max(minIntervalMs, Math.ceil(retryAfter) * 1000 + 1000);
}
