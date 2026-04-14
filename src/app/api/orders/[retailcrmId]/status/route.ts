import { NextResponse } from "next/server";
import {
  OrderWriteAccessError,
  assertOrderWriteAccess,
  normalizeOrderWriteAccessPayload,
} from "@/lib/order-write-access";
import { updateOrderStatusByCode } from "@/lib/order-status-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
          target_status_code?: string;
          source?: string;
          access?: unknown;
        }
      | null;
    const targetStatusCode = body?.target_status_code?.trim();

    if (!targetStatusCode) {
      return NextResponse.json(
        { ok: false, error: "target_status_code is required" },
        { status: 400 },
      );
    }

    await assertOrderWriteAccess({
      retailcrmId: retailcrmIdNumber,
      access: normalizeOrderWriteAccessPayload(body?.access),
    });

    const result = await updateOrderStatusByCode({
      retailcrmId: retailcrmIdNumber,
      targetStatusCode,
      requestHeaders: request.headers,
    });

    return NextResponse.json({
      ok: true,
      changed: result.changed,
      order: result.order,
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

    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /не найден|отключён|запрещён|не удалось определить/i.test(message) ? 400 : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}
