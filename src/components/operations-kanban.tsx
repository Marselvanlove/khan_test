"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { OpsOrderCard } from "@/components/ops-order-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KANBAN_STAGE_ORDER,
  getKanbanStageFromStatus,
  getKanbanStageLabel,
  getKanbanStatusOptionsForStage,
  isKanbanStageTransitionAllowed,
} from "@/shared/kanban";
import type {
  KanbanStage,
  KanbanStatusOption,
  OperationalOrderRow,
  OrderWriteAccessPayload,
} from "@/shared/types";
import { cn } from "@/lib/utils";

interface OperationsKanbanProps {
  orders: OperationalOrderRow[];
  statuses: KanbanStatusOption[];
  manageAccess?: OrderWriteAccessPayload | null;
}

interface PendingStatusDialogState {
  orderId: number;
  targetStage: KanbanStage;
}

function sortKanbanOrders(left: OperationalOrderRow, right: OperationalOrderRow) {
  const overdueDiff =
    Number(right.alert_reasons.includes("SLA просрочен")) -
    Number(left.alert_reasons.includes("SLA просрочен"));

  if (overdueDiff !== 0) {
    return overdueDiff;
  }

  if (right.total_amount !== left.total_amount) {
    return right.total_amount - left.total_amount;
  }

  return Date.parse(right.created_at) - Date.parse(left.created_at);
}

function DraggableOrderCard({
  order,
  disabled,
  onOrderUpdated,
  onRequestStatusChange,
  manageAccess,
}: {
  order: OperationalOrderRow;
  disabled: boolean;
  onOrderUpdated: (order: OperationalOrderRow) => void;
  onRequestStatusChange: () => void;
  manageAccess: OrderWriteAccessPayload | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order:${order.retailcrm_id}`,
    disabled,
  });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-20 opacity-70 shadow-lg")}
      {...attributes}
      {...listeners}
    >
      <OpsOrderCard
        order={order}
        variant="kanban"
        onOrderUpdated={onOrderUpdated}
        onRequestStatusChange={onRequestStatusChange}
        manageAccess={manageAccess}
      />
    </div>
  );
}

function DroppableKanbanColumn({
  stage,
  count,
  children,
}: {
  stage: KanbanStage;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `stage:${stage}`,
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[440px] min-w-[440px] max-w-[440px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Kanban</p>
          <h3 className="text-base font-semibold">{getKanbanStageLabel(stage)}</h3>
        </div>
        <Badge variant="outline">{count}</Badge>
      </header>

      <div className="grid gap-3 px-3 py-3">{children}</div>
    </section>
  );
}

export function OperationsKanban({
  orders,
  statuses,
  manageAccess = null,
}: OperationsKanbanProps) {
  const router = useRouter();
  const [boardOrders, setBoardOrders] = useState(orders);
  const [dialogState, setDialogState] = useState<PendingStatusDialogState | null>(null);
  const [pendingOrderIds, setPendingOrderIds] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();
  const canManage = Boolean(manageAccess);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
  );

  useEffect(() => {
    setBoardOrders(orders);
  }, [orders]);

  const ordersByStage = useMemo(() => {
    return Object.fromEntries(
      KANBAN_STAGE_ORDER.map((stage) => [
        stage,
        boardOrders
          .filter(
            (order) =>
              getKanbanStageFromStatus({
                statusCode: order.status_code,
                statusGroup: order.status_group,
              }) === stage,
          )
          .sort(sortKanbanOrders),
      ]),
    ) as Record<KanbanStage, OperationalOrderRow[]>;
  }, [boardOrders]);

  const dialogOrder =
    dialogState == null
      ? null
      : boardOrders.find((order) => order.retailcrm_id === dialogState.orderId) ?? null;
  const dialogStatuses =
    dialogState == null ? [] : getKanbanStatusOptionsForStage(dialogState.targetStage, statuses);

  function markOrderPending(orderId: number, nextPending: boolean) {
    setPendingOrderIds((current) =>
      nextPending ? Array.from(new Set([...current, orderId])) : current.filter((value) => value !== orderId),
    );
  }

  function replaceOrder(nextOrder: OperationalOrderRow) {
    setBoardOrders((current) =>
      current.map((order) => (order.retailcrm_id === nextOrder.retailcrm_id ? nextOrder : order)),
    );
  }

  function previewOrderStatus(order: OperationalOrderRow, status: KanbanStatusOption) {
    return {
      ...order,
      status_code: status.code,
      status_label: status.label,
      status_group: status.stage,
      status_group_label: getKanbanStageLabel(status.stage),
    };
  }

  function requestStageChange(order: OperationalOrderRow, targetStage: KanbanStage) {
    const currentStage = getKanbanStageFromStatus({
      statusCode: order.status_code,
      statusGroup: order.status_group,
    });

    if (!currentStage) {
      toast.error("Не удалось определить текущую колонку заказа.");
      return;
    }

    if (currentStage !== targetStage && !isKanbanStageTransitionAllowed(currentStage, targetStage)) {
      toast.error("Переход между колонками запрещён.");
      return;
    }

    const options = getKanbanStatusOptionsForStage(targetStage, statuses);

    if (!options.length) {
      toast.error("Для этой колонки нет доступных статусов в RetailCRM.");
      return;
    }

    if (options.length === 1) {
      void applyStatusChange(order, options[0]);
      return;
    }

    setDialogState({
      orderId: order.retailcrm_id,
      targetStage,
    });
  }

  async function applyStatusChange(order: OperationalOrderRow, status: KanbanStatusOption) {
    const previousOrder = order;
    const optimisticOrder = previewOrderStatus(order, status);

    replaceOrder(optimisticOrder);
    markOrderPending(order.retailcrm_id, true);

    try {
      const response = await fetch(`/api/orders/${order.retailcrm_id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_status_code: status.code,
          source: "kanban",
          access: manageAccess,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; order?: OperationalOrderRow }
        | null;

      if (!response.ok || !payload?.ok || !payload.order) {
        throw new Error(payload?.error ?? "Не удалось обновить статус заказа.");
      }

      replaceOrder(payload.order);
      toast.success(`Статус обновлён: ${payload.order.status_label}.`);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      replaceOrder(previousOrder);
      toast.error(
        error instanceof Error ? error.message : "Не удалось изменить статус заказа.",
      );
    } finally {
      markOrderPending(order.retailcrm_id, false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!activeId.startsWith("order:") || !overId?.startsWith("stage:")) {
      return;
    }

    if (!canManage) {
      return;
    }

    const orderId = Number(activeId.replace("order:", ""));
    const targetStage = overId.replace("stage:", "") as KanbanStage;
    const order = boardOrders.find((row) => row.retailcrm_id === orderId);

    if (!order) {
      return;
    }

    const currentStage = getKanbanStageFromStatus({
      statusCode: order.status_code,
      statusGroup: order.status_group,
    });

    if (!currentStage || currentStage === targetStage || pendingOrderIds.includes(orderId)) {
      return;
    }

    requestStageChange(order, targetStage);
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-2">
          <div className="flex w-max items-start gap-4">
            {KANBAN_STAGE_ORDER.map((stage) => (
              <DroppableKanbanColumn
                key={stage}
                stage={stage}
                count={ordersByStage[stage].length}
              >
                {ordersByStage[stage].length ? (
                  ordersByStage[stage].map((order) => (
                    <DraggableOrderCard
                      key={`${order.retailcrm_id}-${order.status_code ?? "unknown"}`}
                      order={order}
                      disabled={!canManage || isPending || pendingOrderIds.includes(order.retailcrm_id)}
                      onOrderUpdated={replaceOrder}
                      onRequestStatusChange={() => {
                        if (!canManage) {
                          return;
                        }

                        const currentStage = getKanbanStageFromStatus({
                          statusCode: order.status_code,
                          statusGroup: order.status_group,
                        });

                        if (!currentStage) {
                          toast.error("Не удалось определить колонку заказа.");
                          return;
                        }

                        requestStageChange(order, currentStage);
                      }}
                      manageAccess={manageAccess}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                    В этой колонке пока нет заказов.
                  </div>
                )}
              </DroppableKanbanColumn>
            ))}
          </div>
        </div>
      </DndContext>

      <Dialog open={dialogState != null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState ? `Выбери статус для колонки «${getKanbanStageLabel(dialogState.targetStage)}»` : ""}
            </DialogTitle>
            <DialogDescription>
              {dialogOrder
                ? `Заказ ${dialogOrder.crm_number}. Это обязательный шаг перед сменой колонки.`
                : "Выбери официальный статус RetailCRM."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {dialogStatuses.map((status) => (
              <Button
                key={status.code}
                variant="outline"
                className="justify-start"
                onClick={() => {
                  if (!dialogOrder) {
                    return;
                  }

                  setDialogState(null);
                  void applyStatusChange(dialogOrder, status);
                }}
              >
                {status.label}
              </Button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setDialogState(null)}>
              Отмена
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
