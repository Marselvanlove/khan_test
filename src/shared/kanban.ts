import type { KanbanStage, KanbanStatusOption, RetailCrmStatusReference } from "./types";

export const KANBAN_STAGE_ORDER: KanbanStage[] = [
  "new",
  "approval",
  "assembling",
  "delivery",
  "complete",
  "cancel",
];

export const KANBAN_STAGE_LABELS: Record<KanbanStage, string> = {
  new: "Новый",
  approval: "Согласование",
  assembling: "Комплектация",
  delivery: "Доставка",
  complete: "Выполнен",
  cancel: "Отменен",
};

export const KANBAN_STAGE_STATUS_FALLBACKS: Array<{
  code: string;
  label: string;
  stage: KanbanStage;
}> = [
  { code: "new", label: "Новый", stage: "new" },
  { code: "availability-confirmed", label: "Наличие подтверждено", stage: "approval" },
  { code: "offer-analog", label: "Предложить замену", stage: "approval" },
  { code: "ready-to-wait", label: "Готов ждать", stage: "approval" },
  { code: "waiting-for-arrival", label: "Ожидается поступление", stage: "approval" },
  { code: "client-confirmed", label: "Согласовано с клиентом", stage: "approval" },
  { code: "prepayed", label: "Предоплата поступила", stage: "approval" },
  { code: "send-to-assembling", label: "Передано в комплектацию", stage: "assembling" },
  { code: "assembling", label: "Комплектуется", stage: "assembling" },
  { code: "assembling-complete", label: "Укомплектован", stage: "assembling" },
  { code: "send-to-delivery", label: "Передан в доставку", stage: "delivery" },
  { code: "delivering", label: "Доставляется", stage: "delivery" },
  { code: "redirect", label: "Доставка перенесена", stage: "delivery" },
  { code: "ready-for-self-pickup", label: "Готов к самовывозу", stage: "delivery" },
  { code: "arrived-in-pickup-point", label: "Прибыл в ПВЗ", stage: "delivery" },
  { code: "complete", label: "Выполнен", stage: "complete" },
  { code: "partially-completed", label: "Выполнен частично", stage: "complete" },
  { code: "no-call", label: "Недозвон", stage: "cancel" },
  { code: "no-product", label: "Нет в наличии", stage: "cancel" },
  { code: "already-buyed", label: "Купил в другом месте", stage: "cancel" },
  { code: "delyvery-did-not-suit", label: "Не устроила доставка", stage: "cancel" },
  { code: "prices-did-not-suit", label: "Не устроила цена", stage: "cancel" },
  { code: "cancel-other", label: "Отменен", stage: "cancel" },
  { code: "return", label: "Возврат", stage: "cancel" },
];

export const KANBAN_STAGE_TRANSITIONS: Record<KanbanStage, KanbanStage[]> = {
  new: ["approval", "cancel"],
  approval: ["new", "assembling", "cancel"],
  assembling: ["approval", "delivery", "cancel"],
  delivery: ["assembling", "complete", "cancel"],
  complete: [],
  cancel: [],
};

const STATUS_STAGE_BY_CODE = new Map(
  KANBAN_STAGE_STATUS_FALLBACKS.map((status) => [status.code, status.stage]),
);

export function isKanbanStage(value: string | null | undefined): value is KanbanStage {
  return value != null && KANBAN_STAGE_ORDER.includes(value as KanbanStage);
}

export function getKanbanStageLabel(stage: KanbanStage) {
  return KANBAN_STAGE_LABELS[stage];
}

export function getKanbanStageFromStatus(params: {
  statusCode: string | null | undefined;
  statusGroup?: string | null | undefined;
}) {
  if (params.statusCode && STATUS_STAGE_BY_CODE.has(params.statusCode)) {
    return STATUS_STAGE_BY_CODE.get(params.statusCode) ?? null;
  }

  if (isKanbanStage(params.statusGroup)) {
    return params.statusGroup;
  }

  return null;
}

export function isKanbanStageTransitionAllowed(source: KanbanStage, target: KanbanStage) {
  return KANBAN_STAGE_TRANSITIONS[source].includes(target);
}

export function buildKanbanStatusOptions(
  references?: RetailCrmStatusReference[] | null,
): KanbanStatusOption[] {
  if (!references?.length) {
    return KANBAN_STAGE_STATUS_FALLBACKS.map((status) => ({
      code: status.code,
      label: status.label,
      stage: status.stage,
      active: true,
    }));
  }

  const byCode = new Map(references.map((status) => [status.code, status]));

  return KANBAN_STAGE_STATUS_FALLBACKS.flatMap((status) => {
    const reference = byCode.get(status.code);

    if (!reference) {
      return [];
    }

    return [
      {
        code: status.code,
        label: reference.name?.trim() || status.label,
        stage: status.stage,
        active: reference.active !== false,
      },
    ];
  });
}

export function getKanbanStatusOptionsForStage(
  stage: KanbanStage,
  options: KanbanStatusOption[],
) {
  return options.filter((option) => option.stage === stage && option.active);
}

export function buildKanbanStatusLabelMap(options: KanbanStatusOption[]) {
  return Object.fromEntries(options.map((status) => [status.code, status.label]));
}
