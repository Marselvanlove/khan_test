import { buildOperationalOrderRowFromRecord } from "@/shared/orders";
import {
  buildKanbanStatusLabelMap,
  buildKanbanStatusOptions,
  getKanbanStageFromStatus,
  getKanbanStageLabel,
  isKanbanStageTransitionAllowed,
} from "@/shared/kanban";
import { createRetailCrmClient } from "@/shared/retailcrm";
import type { KanbanStatusOption, RetailCrmOrderResponse } from "@/shared/types";
import { resolveAppBaseUrl, updateOrderSnapshotFromRetailCrm } from "@/lib/orders-server";
import { buildSignedLogisticsLink, buildSignedManagerLink } from "@/shared/order-links";

const RETAILCRM_STATUSES_CACHE_TTL_MS = 5 * 60 * 1000;

let retailCrmStatusesCache:
  | {
      expiresAt: number;
      statuses: KanbanStatusOption[];
    }
  | null = null;

export function resetRetailCrmKanbanStatusesCacheForTests() {
  retailCrmStatusesCache = null;
}

export function createRetailCrmRuntimeClient() {
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

export async function loadRetailCrmKanbanStatuses(options: {
  strict?: boolean;
  force?: boolean;
} = {}) {
  if (!options.force && retailCrmStatusesCache && retailCrmStatusesCache.expiresAt > Date.now()) {
    return retailCrmStatusesCache.statuses;
  }

  try {
    const retailCrm = createRetailCrmRuntimeClient();
    const response = await retailCrm.listOrderStatuses();
    const statuses = buildKanbanStatusOptions(response.statuses ?? []);

    retailCrmStatusesCache = {
      statuses,
      expiresAt: Date.now() + RETAILCRM_STATUSES_CACHE_TTL_MS,
    };

    return statuses;
  } catch (error) {
    if (options.strict) {
      throw error;
    }

    return buildKanbanStatusOptions();
  }
}

export async function buildOperationalOrderResponse(
  requestHeaders: Headers,
  retailcrmId: number,
  rawOrder: RetailCrmOrderResponse,
  statusOptions?: KanbanStatusOption[],
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
      statusLabels: statusOptions ? buildKanbanStatusLabelMap(statusOptions) : undefined,
    },
  );
}

export async function updateOrderStatusByCode(params: {
  retailcrmId: number;
  targetStatusCode: string;
  requestHeaders: Headers;
}) {
  const retailCrm = createRetailCrmRuntimeClient();
  const statusOptions = await loadRetailCrmKanbanStatuses({ strict: true });
  const targetStatus = statusOptions.find((status) => status.code === params.targetStatusCode);

  if (!targetStatus) {
    throw new Error("Статус не найден в справочнике RetailCRM.");
  }

  if (!targetStatus.active) {
    throw new Error("Статус отключён в RetailCRM.");
  }

  const currentOrder = await retailCrm.getOrder(params.retailcrmId, { by: "id" });
  const currentStatusCode =
    typeof currentOrder.status === "string" && currentOrder.status.trim()
      ? currentOrder.status
      : null;

  if (currentStatusCode === params.targetStatusCode) {
    return {
      changed: false,
      order: await buildOperationalOrderResponse(
        params.requestHeaders,
        params.retailcrmId,
        currentOrder,
        statusOptions,
      ),
    };
  }

  const currentStage = getKanbanStageFromStatus({
    statusCode: currentStatusCode,
  });
  const targetStage = getKanbanStageFromStatus({
    statusCode: params.targetStatusCode,
  });

  if (!currentStage || !targetStage) {
    throw new Error("Не удалось определить колонку для перехода статуса.");
  }

  if (
    currentStage !== targetStage &&
    !isKanbanStageTransitionAllowed(currentStage, targetStage)
  ) {
    throw new Error(
      `Переход из «${getKanbanStageLabel(currentStage)}» в «${getKanbanStageLabel(targetStage)}» запрещён.`,
    );
  }

  const response = await retailCrm.editOrder(
    params.retailcrmId,
    {
      status: params.targetStatusCode,
    },
    { by: "id" },
  );
  const rawOrder =
    response.order ??
    (await retailCrm.getOrder(params.retailcrmId, {
      by: "id",
    }));

  return {
    changed: true,
    order: await buildOperationalOrderResponse(
      params.requestHeaders,
      params.retailcrmId,
      rawOrder,
      statusOptions,
    ),
  };
}
