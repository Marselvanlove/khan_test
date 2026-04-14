import { NextResponse } from "next/server";
import { buildSignedManagerLink } from "@/shared/order-links";
import { createRetailCrmClient } from "@/shared/retailcrm";
import {
  getTelegramMessageStateById,
  updateTelegramMessageState,
} from "@/shared/telegram-message-state";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageReplyMarkup,
  editTelegramMessageText,
} from "@/shared/telegram-api";
import { handleTelegramCallbackUpdate } from "@/lib/telegram-workflow";
import { recordServerOrderEvents } from "@/lib/order-events-server";
import {
  loadOrderPresentation,
  resolveAppBaseUrl,
  updateOrderSnapshotAfterCompletion,
} from "@/lib/orders-server";
import { buildOrderEvent } from "@/shared/order-events";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { TelegramOrderContext } from "@/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildTelegramPayload(
  presentation: Awaited<ReturnType<typeof loadOrderPresentation>>,
): TelegramOrderContext {
  return {
    alert_types: ["high-value"],
    retailcrm_id: presentation.order.retailcrm_id,
    external_id: presentation.order.external_id,
    customer_name: presentation.order.customer_name,
    phone: presentation.order.phone,
    email: presentation.order.email,
    city: presentation.order.city,
    total_amount: presentation.order.total_amount,
    created_at: presentation.order.created_at,
    utm_source: presentation.order.utm_source,
    raw_payload: presentation.rawOrder,
  };
}

function createRetailCrmRuntimeClient() {
  const baseUrl = process.env.RETAILCRM_BASE_URL?.trim();
  const apiKey = process.env.RETAILCRM_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error("RETAILCRM env vars are missing.");
  }

  return createRetailCrmClient({
    baseUrl,
    apiKey,
    defaultSite: process.env.RETAILCRM_SITE_CODE?.trim(),
  });
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (!secret || providedSecret !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const linkSecret = process.env.LINK_SIGNING_SECRET?.trim();
  const supabase = createSupabaseServerClient();

  if (!botToken || !supabase) {
    return NextResponse.json({ ok: false, error: "Missing bot or supabase config" }, { status: 500 });
  }

  const update = await request.json().catch(() => null);
  const baseUrl = resolveAppBaseUrl(request.headers);

  if (!update) {
    return NextResponse.json({ ok: true });
  }

  await handleTelegramCallbackUpdate(update, {
    getMessageState: (stateId) => getTelegramMessageStateById(supabase as never, stateId),
    loadOrderContext: async (retailcrmId) => {
      const presentation = await loadOrderPresentation(retailcrmId, { baseUrl });
      const openUrl = linkSecret
        ? (
            await buildSignedManagerLink({
              retailcrmId,
              secret: linkSecret,
              baseUrl,
            })
          ).url
        : null;

      return {
        payload: buildTelegramPayload(presentation),
        timezone: presentation.adminSettings.timezone,
        openUrl,
      };
    },
    markConfirming: (stateId) =>
      updateTelegramMessageState(supabase as never, stateId, {
        status: "confirming",
      }),
    markSent: (stateId) =>
      updateTelegramMessageState(supabase as never, stateId, {
        status: "sent",
      }),
    markCompleted: ({ stateId, userId, username, previousStatus, nextStatus }) =>
      updateTelegramMessageState(supabase as never, stateId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by_user_id: userId,
        completed_by_username: username,
        crm_status_before: previousStatus,
        crm_status_after: nextStatus,
      }),
    completeOrder: async (retailcrmId) => {
      const retailCrm = createRetailCrmRuntimeClient();
      const previousOrder = await retailCrm.getOrder(retailcrmId, { by: "id" });
      const response = await retailCrm.editOrder(
        retailcrmId,
        {
          status: "complete",
        },
        { by: "id" },
      );
      const nextOrder =
        response.order ??
        (await retailCrm.getOrder(retailcrmId, {
          by: "id",
        }));

      await updateOrderSnapshotAfterCompletion({
        retailcrmId,
        rawOrder: nextOrder,
      });
      const eventAt =
        typeof nextOrder.updatedAt === "string" && nextOrder.updatedAt.trim()
          ? nextOrder.updatedAt
          : new Date().toISOString();

      await recordServerOrderEvents([
        buildOrderEvent({
          eventKey: ["telegram-completed", retailcrmId, eventAt].join(":"),
          orderRetailCrmId: retailcrmId,
          eventType: "telegram-completed",
          eventSource: "telegram",
          eventAt,
          payload: {
            previous_status: typeof previousOrder.status === "string" ? previousOrder.status : null,
            next_status: typeof nextOrder.status === "string" ? nextOrder.status : null,
          },
        }),
      ]);

      const presentation = await loadOrderPresentation(retailcrmId, { baseUrl });
      const openUrl = linkSecret
        ? (
            await buildSignedManagerLink({
              retailcrmId,
              secret: linkSecret,
              baseUrl,
            })
          ).url
        : null;

      return {
        payload: buildTelegramPayload(presentation),
        timezone: presentation.adminSettings.timezone,
        openUrl,
        rawOrder: nextOrder,
        previousStatus: typeof previousOrder.status === "string" ? previousOrder.status : null,
        nextStatus: typeof nextOrder.status === "string" ? nextOrder.status : null,
      };
    },
    answerCallbackQuery: ({ callbackQueryId, text, showAlert }) =>
      answerTelegramCallbackQuery({
        botToken,
        callbackQueryId,
        text,
        showAlert,
      }).then(() => undefined),
    editReplyMarkup: ({ chatId, messageId, replyMarkup }) =>
      editTelegramMessageReplyMarkup({
        botToken,
        chatId,
        messageId,
        replyMarkup,
      }).then(() => undefined),
    editMessageText: ({ chatId, messageId, text, replyMarkup }) =>
      editTelegramMessageText({
        botToken,
        chatId,
        messageId,
        text,
        replyMarkup,
      }).then(() => undefined),
  });

  return NextResponse.json({ ok: true });
}
