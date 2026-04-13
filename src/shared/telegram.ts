import {
  extractOrderItemDetails,
  extractOrderNumber,
  extractOrderPhone,
  formatOrderItemUnitLine,
  formatCurrencyKzt,
  formatOrderDateTime,
  formatSourceLabel,
} from "./orders";
import type {
  TelegramMessageStateStatus,
  TelegramOrderContext,
} from "./types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function digitsOnly(value: string) {
  return value.replaceAll(/\D/g, "");
}

function buildWhatsappLink(phone: string | null, completed: boolean) {
  if (!phone) {
    return null;
  }

  if (completed) {
    return escapeHtml(phone);
  }

  const digits = digitsOnly(phone);

  if (!digits) {
    return escapeHtml(phone);
  }

  return `<a href="https://wa.me/${digits}">${escapeHtml(phone)}</a>`;
}

function maybeStrike(value: string, completed: boolean) {
  return completed ? `<s>${value}</s>` : value;
}

function buildItemsBlock(
  items: ReturnType<typeof extractOrderItemDetails>,
  completed: boolean,
) {
  if (!items.length) {
    return maybeStrike("Товары: не указаны", completed);
  }

  const content = items
    .map((item) => escapeHtml(formatOrderItemUnitLine(item)))
    .join("\n");

  if (completed) {
    return `<blockquote><s>${content}</s></blockquote>`;
  }

  return `<blockquote>${content}</blockquote>`;
}

export function formatTelegramOrderMessage(
  order: TelegramOrderContext,
  options: {
    completed?: boolean;
    timezone?: string;
  } = {},
) {
  const completed = options.completed ?? false;
  const timezone = options.timezone ?? "Asia/Almaty";
  const orderNumber = extractOrderNumber(order.raw_payload, order.external_id);
  const phone = extractOrderPhone(order.raw_payload, order.phone);
  const items = extractOrderItemDetails(order.raw_payload);
  const lines = [
    maybeStrike(`Заказ <code>${escapeHtml(orderNumber)}</code>`, completed),
    maybeStrike(`<b>${escapeHtml(order.customer_name)}</b>`, completed),
  ];

  const phoneLabel = buildWhatsappLink(phone, completed);

  if (phoneLabel) {
    lines.push(maybeStrike(`Телефон: ${phoneLabel}`, completed));
  }

  lines.push(buildItemsBlock(items, completed));
  lines.push(
    maybeStrike(`Сумма: <i>${escapeHtml(formatCurrencyKzt(order.total_amount))}</i>`, completed),
  );
  lines.push(
    maybeStrike(`Источник: ${escapeHtml(formatSourceLabel(order.utm_source))}`, completed),
  );
  lines.push(
    maybeStrike(
      `Дата: ${escapeHtml(formatOrderDateTime(order.created_at, timezone))}`,
      completed,
    ),
  );

  return lines.join("\n");
}

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

type TelegramDoneAction = "init" | "confirm" | "cancel";

function normalizeTelegramButtonUrl(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isLoopbackHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost");

    if (!["http:", "https:"].includes(parsed.protocol) || isLoopbackHost) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildDoneCallbackData(action: TelegramDoneAction, stateId: string) {
  return `done:${action}:${stateId}`;
}

export function parseDoneCallbackData(data: string | null | undefined) {
  if (!data?.startsWith("done:")) {
    return null;
  }

  const [prefix, action, stateId] = data.split(":");

  if (prefix !== "done" || !stateId || !["init", "confirm", "cancel"].includes(action ?? "")) {
    return null;
  }

  return {
    action: action as TelegramDoneAction,
    stateId,
  };
}

export function buildTelegramNotificationKeyboard(params: {
  openUrl: string | null;
  stateId: string;
  status: TelegramMessageStateStatus;
}): TelegramInlineKeyboardMarkup | undefined {
  const rows: TelegramInlineKeyboardButton[][] = [];
  const safeOpenUrl = normalizeTelegramButtonUrl(params.openUrl);
  const openButton = safeOpenUrl
    ? [{ text: "Открыть", url: safeOpenUrl }]
    : [];

  if (params.status === "completed") {
    if (openButton.length) {
      rows.push(openButton);
    }

    return rows.length ? { inline_keyboard: rows } : undefined;
  }

  if (params.status === "confirming") {
    if (openButton.length) {
      rows.push(openButton);
    }

    rows.push([
      {
        text: "Подтвердить",
        callback_data: buildDoneCallbackData("confirm", params.stateId),
      },
      {
        text: "Отмена",
        callback_data: buildDoneCallbackData("cancel", params.stateId),
      },
    ]);

    return { inline_keyboard: rows };
  }

  rows.push([
    ...(openButton.length ? openButton : []),
    {
      text: "Выполнено",
      callback_data: buildDoneCallbackData("init", params.stateId),
    },
  ]);

  return { inline_keyboard: rows };
}
