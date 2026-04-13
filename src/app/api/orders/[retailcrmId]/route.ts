import { NextResponse } from "next/server";
import { buildSignedLogisticsLink, buildSignedManagerLink } from "@/shared/order-links";
import {
  buildOperationalOrderRowFromRecord,
  resolveOrderStatusTransition,
  splitCustomerName,
} from "@/shared/orders";
import { createRetailCrmClient } from "@/shared/retailcrm";
import { resolveAppBaseUrl, updateOrderSnapshotFromRetailCrm } from "@/lib/orders-server";
import type { RetailCrmOrderResponse } from "@/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function buildEditableOrderPayload(body: Record<string, unknown>) {
  const firstName =
    typeof body.first_name === "string" ? body.first_name.trim() : "";
  const lastName =
    typeof body.last_name === "string" ? body.last_name.trim() : "";
  const fallbackName =
    typeof body.customer_name === "string" ? splitCustomerName(body.customer_name) : null;

  return {
    firstName: firstName || fallbackName?.firstName || "",
    lastName: lastName || fallbackName?.lastName || "",
    phone: typeof body.phone === "string" ? body.phone.trim() : "",
    email: typeof body.email === "string" ? body.email.trim() : "",
    customerComment:
      typeof body.customer_comment === "string" ? body.customer_comment.trim() : "",
    status: typeof body.status_code === "string" ? body.status_code.trim() : "",
    delivery: {
      address: {
        city: typeof body.city === "string" ? body.city.trim() : "",
        text: typeof body.address === "string" ? body.address.trim() : "",
      },
    },
  };
}

async function buildOperationalOrderResponse(
  requestHeaders: Headers,
  retailcrmId: number,
  rawOrder: RetailCrmOrderResponse,
) {
  await updateOrderSnapshotFromRetailCrm({
    retailcrmId,
    rawOrder,
  });

  const linkSigningSecret = process.env.LINK_SIGNING_SECRET?.trim() ?? null;
  const retailCrmBaseUrl = process.env.RETAILCRM_BASE_URL?.trim() ?? null;
  const appBaseUrl = resolveAppBaseUrl(requestHeaders);
  const managerUrl = linkSigningSecret
    ? (
        await buildSignedManagerLink({
          retailcrmId,
          secret: linkSigningSecret,
        })
      ).path
    : null;
  const logisticsUrl = linkSigningSecret
    ? (
        await buildSignedLogisticsLink({
          retailcrmId,
          secret: linkSigningSecret,
          baseUrl: appBaseUrl,
        })
      ).url
    : null;

  return buildOperationalOrderRowFromRecord(
    {
      retailcrm_id: rawOrder.id,
      external_id: rawOrder.externalId ?? null,
      customer_name:
        [rawOrder.firstName, rawOrder.lastName].filter(Boolean).join(" ").trim() || "Без имени",
      phone: rawOrder.phone ?? null,
      email: rawOrder.email ?? null,
      city: rawOrder.delivery?.address?.city ?? null,
      total_amount: rawOrder.totalSumm ?? rawOrder.summ ?? 0,
      created_at: rawOrder.createdAt ?? new Date().toISOString(),
      status: rawOrder.status ?? null,
      utm_source:
        typeof rawOrder.customFields?.utm_source === "string"
          ? rawOrder.customFields.utm_source
          : null,
      telegram_notified_at: null,
      raw_payload: rawOrder as RetailCrmOrderResponse,
    },
    {
      retailCrmBaseUrl,
      managerUrl,
      logisticsUrl,
    },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ retailcrmId: string }> },
) {
  try {
    const { retailcrmId } = await context.params;
    const retailcrmIdNumber = Number(retailcrmId);

    if (!Number.isFinite(retailcrmIdNumber)) {
      return NextResponse.json({ ok: false, error: "Invalid retailcrmId" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const retailCrm = createRetailCrmRuntimeClient();
    const editResponse = await retailCrm.editOrder(
      retailcrmIdNumber,
      buildEditableOrderPayload(body),
      { by: "id" },
    );
    const rawOrder =
      editResponse.order ??
      (await retailCrm.getOrder(retailcrmIdNumber, {
        by: "id",
      }));

    const order = await buildOperationalOrderResponse(
      request.headers,
      retailcrmIdNumber,
      rawOrder,
    );

    return NextResponse.json({
      ok: true,
      order,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ retailcrmId: string }> },
) {
  try {
    const { retailcrmId } = await context.params;
    const retailcrmIdNumber = Number(retailcrmId);

    if (!Number.isFinite(retailcrmIdNumber)) {
      return NextResponse.json({ ok: false, error: "Invalid retailcrmId" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action;

    if (action !== "handoff" && action !== "complete") {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const retailCrm = createRetailCrmRuntimeClient();
    const currentOrder = await retailCrm.getOrder(retailcrmIdNumber, { by: "id" });
    const transition = resolveOrderStatusTransition(
      action,
      typeof currentOrder.status === "string" ? currentOrder.status : null,
    );

    if (!transition.ok) {
      return NextResponse.json({ ok: false, error: transition.error }, { status: 400 });
    }

    const rawOrder =
      transition.nextStatusCode === null
        ? currentOrder
        : (
            await retailCrm.editOrder(
              retailcrmIdNumber,
              {
                status: transition.nextStatusCode,
              },
              { by: "id" },
            )
          ).order ??
          (await retailCrm.getOrder(retailcrmIdNumber, {
            by: "id",
          }));

    const order = await buildOperationalOrderResponse(
      request.headers,
      retailcrmIdNumber,
      rawOrder,
    );

    return NextResponse.json({
      ok: true,
      changed: transition.changed,
      order,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
