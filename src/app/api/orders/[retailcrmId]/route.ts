import { NextResponse } from "next/server";
import {
  OrderWriteAccessError,
  assertOrderWriteAccess,
  normalizeOrderWriteAccessPayload,
} from "@/lib/order-write-access";
import { resolveOrderStatusTransition, splitCustomerName } from "@/shared/orders";
import {
  buildOperationalOrderResponse,
  createRetailCrmRuntimeClient,
} from "@/lib/order-status-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    await assertOrderWriteAccess({
      retailcrmId: retailcrmIdNumber,
      access: normalizeOrderWriteAccessPayload(body.access),
    });

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
    if (error instanceof OrderWriteAccessError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 401 },
      );
    }

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

    const body = (await request.json().catch(() => null)) as
      | {
          action?: string;
          access?: unknown;
        }
      | null;
    const action = body?.action;

    if (action !== "handoff" && action !== "complete") {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    await assertOrderWriteAccess({
      retailcrmId: retailcrmIdNumber,
      access: normalizeOrderWriteAccessPayload(body?.access),
    });

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
    if (error instanceof OrderWriteAccessError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
