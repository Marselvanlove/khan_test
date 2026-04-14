import { verifySignedManagerLink } from "@/shared/order-links";
import type { OrderWriteAccessPayload } from "@/shared/types";

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export class OrderWriteAccessError extends Error {
  constructor(message = "Нужна подписанная manager-link или DASHBOARD_OPERATOR_TOKEN.") {
    super(message);
    this.name = "OrderWriteAccessError";
  }
}

export class DashboardOperatorAccessError extends Error {
  constructor(
    message = "Публичный дашборд работает в read-only режиме. Для изменения настроек нужен DASHBOARD_OPERATOR_TOKEN.",
  ) {
    super(message);
    this.name = "DashboardOperatorAccessError";
  }
}

export function normalizeOrderWriteAccessPayload(value: unknown): OrderWriteAccessPayload {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;

  return {
    manager_signature: readTrimmedString(record.manager_signature),
    manager_expires_at: readFiniteNumber(record.manager_expires_at),
    operator_token: readTrimmedString(record.operator_token),
  };
}

export function hasDashboardOperatorAccess(operatorToken: unknown): boolean {
  const expectedToken = process.env.DASHBOARD_OPERATOR_TOKEN?.trim();
  const providedToken = readTrimmedString(operatorToken);

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

export function assertDashboardOperatorAccess(operatorToken: unknown) {
  if (!hasDashboardOperatorAccess(operatorToken)) {
    throw new DashboardOperatorAccessError();
  }
}

export async function hasOrderWriteAccess(params: {
  retailcrmId: number;
  access: OrderWriteAccessPayload;
}) {
  if (hasDashboardOperatorAccess(params.access.operator_token)) {
    return true;
  }

  const linkSecret = process.env.LINK_SIGNING_SECRET?.trim();

  if (!linkSecret || !params.access.manager_signature || !params.access.manager_expires_at) {
    return false;
  }

  return verifySignedManagerLink({
    retailcrmId: params.retailcrmId,
    secret: linkSecret,
    expiresAt: params.access.manager_expires_at,
    signature: params.access.manager_signature,
  });
}

export async function assertOrderWriteAccess(params: {
  retailcrmId: number;
  access: OrderWriteAccessPayload;
}) {
  if (!(await hasOrderWriteAccess(params))) {
    throw new OrderWriteAccessError();
  }
}
