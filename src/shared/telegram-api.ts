import type { TelegramInlineKeyboardMarkup } from "./telegram";

export interface TelegramApiErrorPayload {
  ok?: boolean;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
  [key: string]: unknown;
}

export class TelegramApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: TelegramApiErrorPayload | null,
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

export function isStaleTelegramCallbackQueryError(error: unknown) {
  if (!(error instanceof TelegramApiError) || error.status !== 400) {
    return false;
  }

  const description = String(error.payload?.description ?? error.message).toLowerCase();

  return (
    description.includes("query is too old") ||
    description.includes("query id is invalid") ||
    description.includes("response timeout expired")
  );
}

interface TelegramMethodResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
}

async function callTelegramMethod<T>(
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as TelegramMethodResponse<T> | null;

  if (!response.ok || !data?.ok) {
    throw new TelegramApiError(
      data?.description ?? `${method} failed`,
      response.status,
      data as TelegramApiErrorPayload | null,
    );
  }

  if (data.result == null) {
    throw new TelegramApiError(
      `${method} returned no result`,
      response.status,
      data as TelegramApiErrorPayload,
    );
  }

  return data.result;
}

export async function sendTelegramTextMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  return callTelegramMethod<{ message_id: number }>(params.botToken, "sendMessage", {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: params.replyMarkup,
  });
}

export async function answerTelegramCallbackQuery(params: {
  botToken: string;
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}) {
  return callTelegramMethod<true>(params.botToken, "answerCallbackQuery", {
    callback_query_id: params.callbackQueryId,
    text: params.text,
    show_alert: params.showAlert,
  });
}

export async function editTelegramMessageReplyMarkup(params: {
  botToken: string;
  chatId: string;
  messageId: number;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  return callTelegramMethod<unknown>(params.botToken, "editMessageReplyMarkup", {
    chat_id: params.chatId,
    message_id: params.messageId,
    reply_markup: params.replyMarkup,
  });
}

export async function editTelegramMessageText(params: {
  botToken: string;
  chatId: string;
  messageId: number;
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  return callTelegramMethod<unknown>(params.botToken, "editMessageText", {
    chat_id: params.chatId,
    message_id: params.messageId,
    text: params.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: params.replyMarkup,
  });
}
