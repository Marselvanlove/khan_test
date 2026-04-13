import {
  buildTelegramNotificationKeyboard,
  formatTelegramOrderMessage,
  parseDoneCallbackData,
} from "@/shared/telegram";
import { isStaleTelegramCallbackQueryError } from "@/shared/telegram-api";
import type {
  RetailCrmOrderResponse,
  TelegramMessageStateRecord,
  TelegramOrderContext,
} from "@/shared/types";

interface TelegramCallbackUpdate {
  callback_query?: {
    id: string;
    data?: string;
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    message?: {
      message_id?: number;
      chat?: {
        id?: number | string;
      };
    };
  };
}

interface TelegramOrderRuntimeContext {
  payload: TelegramOrderContext;
  timezone: string;
  openUrl: string | null;
}

interface CompletionResult extends TelegramOrderRuntimeContext {
  rawOrder: RetailCrmOrderResponse;
  previousStatus: string | null;
  nextStatus: string | null;
}

interface TelegramWorkflowDeps {
  getMessageState(stateId: string): Promise<TelegramMessageStateRecord | null>;
  loadOrderContext(retailcrmId: number): Promise<TelegramOrderRuntimeContext>;
  markConfirming(stateId: string): Promise<void>;
  markSent(stateId: string): Promise<void>;
  markCompleted(params: {
    stateId: string;
    userId: number | null;
    username: string | null;
    previousStatus: string | null;
    nextStatus: string | null;
  }): Promise<void>;
  completeOrder(retailcrmId: number): Promise<CompletionResult>;
  answerCallbackQuery(params: {
    callbackQueryId: string;
    text?: string;
    showAlert?: boolean;
  }): Promise<void>;
  editReplyMarkup(params: {
    chatId: string;
    messageId: number;
    replyMarkup: ReturnType<typeof buildTelegramNotificationKeyboard>;
  }): Promise<void>;
  editMessageText(params: {
    chatId: string;
    messageId: number;
    text: string;
    replyMarkup: ReturnType<typeof buildTelegramNotificationKeyboard>;
  }): Promise<void>;
}

function resolveActorName(
  callbackQuery: NonNullable<TelegramCallbackUpdate["callback_query"]>,
) {
  if (callbackQuery.from?.username) {
    return callbackQuery.from.username;
  }

  return [callbackQuery.from?.first_name, callbackQuery.from?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || null;
}

async function answerCallbackQuerySafely(
  deps: TelegramWorkflowDeps,
  params: {
    callbackQueryId: string;
    text?: string;
    showAlert?: boolean;
  },
) {
  try {
    await deps.answerCallbackQuery(params);
  } catch (error) {
    if (!isStaleTelegramCallbackQueryError(error)) {
      throw error;
    }
  }
}

export async function handleTelegramCallbackUpdate(
  update: TelegramCallbackUpdate,
  deps: TelegramWorkflowDeps,
) {
  const callbackQuery = update.callback_query;
  const parsed = parseDoneCallbackData(callbackQuery?.data);

  if (!callbackQuery || !parsed) {
    return { handled: false as const };
  }

  const state = await deps.getMessageState(parsed.stateId);
  const messageId = Number(callbackQuery.message?.message_id ?? 0);
  const chatId = String(callbackQuery.message?.chat?.id ?? "");

  if (!state || !messageId || !chatId) {
    await answerCallbackQuerySafely(deps, {
      callbackQueryId: callbackQuery.id,
      text: "Связанный заказ не найден.",
      showAlert: true,
    });

    return { handled: true as const };
  }

  if (parsed.action === "init") {
    if (state.status === "completed") {
      await answerCallbackQuerySafely(deps, {
        callbackQueryId: callbackQuery.id,
        text: "Заказ уже помечен как выполненный.",
      });

      return { handled: true as const };
    }

    const orderContext = await deps.loadOrderContext(state.order_retailcrm_id);

    await deps.markConfirming(state.id);
    await answerCallbackQuerySafely(deps, {
      callbackQueryId: callbackQuery.id,
      text: "Подтвердите выполнение заказа.",
    });
    await deps.editReplyMarkup({
      chatId,
      messageId,
      replyMarkup: buildTelegramNotificationKeyboard({
        openUrl: orderContext.openUrl,
        stateId: state.id,
        status: "confirming",
      }),
    });

    return { handled: true as const };
  }

  if (parsed.action === "cancel") {
    if (state.status === "completed") {
      await answerCallbackQuerySafely(deps, {
        callbackQueryId: callbackQuery.id,
        text: "Заказ уже завершён.",
      });

      return { handled: true as const };
    }

    const orderContext = await deps.loadOrderContext(state.order_retailcrm_id);

    await deps.markSent(state.id);
    await answerCallbackQuerySafely(deps, {
      callbackQueryId: callbackQuery.id,
      text: "Подтверждение отменено.",
    });
    await deps.editReplyMarkup({
      chatId,
      messageId,
      replyMarkup: buildTelegramNotificationKeyboard({
        openUrl: orderContext.openUrl,
        stateId: state.id,
        status: "sent",
      }),
    });

    return { handled: true as const };
  }

  if (state.status === "completed") {
    await answerCallbackQuerySafely(deps, {
      callbackQueryId: callbackQuery.id,
      text: "Заказ уже завершён.",
    });

    return { handled: true as const };
  }

  const completion = await deps.completeOrder(state.order_retailcrm_id);

  await deps.markCompleted({
    stateId: state.id,
    userId: callbackQuery.from?.id ?? null,
    username: resolveActorName(callbackQuery),
    previousStatus: completion.previousStatus,
    nextStatus: completion.nextStatus,
  });
  await answerCallbackQuerySafely(deps, {
    callbackQueryId: callbackQuery.id,
    text: "Заказ переведён в выполненные.",
  });
  await deps.editMessageText({
    chatId,
    messageId,
    text: formatTelegramOrderMessage(completion.payload, {
      completed: true,
      timezone: completion.timezone,
    }),
    replyMarkup: buildTelegramNotificationKeyboard({
      openUrl: completion.openUrl,
      stateId: state.id,
      status: "completed",
    }),
  });

  return { handled: true as const };
}
