"use client";

import { useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import { OperationsKanban } from "@/components/operations-kanban";
import { OrderQueue } from "@/components/order-queue";
import { StatusBreakdown } from "@/components/status-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  OperationsKpiItem,
  OperationsTabData,
  OperationalOrderRow,
  OrderWriteAccessPayload,
} from "@/shared/types";
import { cn } from "@/lib/utils";

interface OperationsTabProps {
  data: OperationsTabData;
  manageAccess?: OrderWriteAccessPayload | null;
}

type OperationsFilter =
  | { type: "all" }
  | { type: "metric"; key: OperationsKpiItem["key"] }
  | { type: "status"; group: string };

const FILTER_LABELS: Record<OperationsKpiItem["key"], string> = {
  "new-today": "Новые за сегодня",
  "approval-backlog": "Согласование",
  delivery: "В доставке",
  "missing-contact": "Без контакта",
  "no-first-touch": "Без первой реакции",
  "high-value-active": "High-value в работе",
  "sla-overdue": "SLA просрочен",
};

function getFilterTitle(filter: OperationsFilter): string {
  if (filter.type === "all") {
    return "Все активные очереди";
  }

  if (filter.type === "status") {
    return `Фильтр по статусу: ${filter.group}`;
  }

  return `Фильтр по KPI: ${FILTER_LABELS[filter.key]}`;
}

function matchesMetric(
  order: OperationalOrderRow,
  key: OperationsKpiItem["key"],
  highValueThreshold: number,
): boolean {
  switch (key) {
    case "new-today":
      return Date.now() - Date.parse(order.created_at) <= 24 * 60 * 60 * 1000;
    case "approval-backlog":
      return order.status_group === "approval";
    case "delivery":
      return order.status_group === "delivery";
    case "missing-contact":
      return order.missing_contact;
    case "no-first-touch":
      return (
        order.status_group !== "complete" &&
        order.status_group !== "cancel" &&
        !order.first_touch_at
      );
    case "high-value-active":
      return (
        order.total_amount > highValueThreshold &&
        order.status_group !== "complete" &&
        order.status_group !== "cancel"
      );
    case "sla-overdue":
      return order.alert_reasons.includes("SLA просрочен");
    default:
      return true;
  }
}

function matchesFilter(
  order: OperationalOrderRow,
  filter: OperationsFilter,
  highValueThreshold: number,
): boolean {
  if (filter.type === "all") {
    return true;
  }

  if (filter.type === "status") {
    return order.status_group === filter.group;
  }

  return matchesMetric(order, filter.key, highValueThreshold);
}

export function OperationsTab({ data, manageAccess = null }: OperationsTabProps) {
  const [activeFilter, setActiveFilter] = useState<OperationsFilter>({ type: "all" });
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const canManage = Boolean(manageAccess);

  const filteredQueues = useMemo(
    () => ({
      actionQueue: data.actionQueue.filter((order) =>
        matchesFilter(order, activeFilter, data.high_value_threshold),
      ),
      priorityQueue: data.priorityQueue.filter((order) =>
        matchesFilter(order, activeFilter, data.high_value_threshold),
      ),
      problemQueue: data.problemQueue.filter((order) =>
        matchesFilter(order, activeFilter, data.high_value_threshold),
      ),
    }),
    [activeFilter, data.actionQueue, data.high_value_threshold, data.priorityQueue, data.problemQueue],
  );
  const filteredKanbanOrders = useMemo(
    () =>
      data.kanbanOrders.filter((order) =>
        matchesFilter(order, activeFilter, data.high_value_threshold),
      ),
    [activeFilter, data.high_value_threshold, data.kanbanOrders],
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((item) => {
          const isActive = activeFilter.type === "metric" && activeFilter.key === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setActiveFilter((current) =>
                  current.type === "metric" && current.key === item.key
                    ? { type: "all" }
                    : { type: "metric", key: item.key },
                )
              }
              className="text-left"
            >
              <Card
                className={cn(
                  "border-border/70 bg-card/90 shadow-sm transition-colors hover:border-primary/40",
                  isActive && "border-primary/50 bg-primary/5",
                )}
              >
                <CardHeader>
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="text-3xl">{item.value}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {item.hint}
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <StatusBreakdown
        rows={data.statusFlow}
        activeGroup={activeFilter.type === "status" ? activeFilter.group : null}
        onSelect={(group) =>
          setActiveFilter((current) =>
            current.type === "status" && current.group === group
              ? { type: "all" }
              : { type: "status", group },
          )
        }
      />

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Фокус оператора</CardTitle>
            <CardDescription>
              {getFilterTitle(activeFilter)}. Фильтр применяется сразу ко всем представлениям ниже.
            </CardDescription>
            {!canManage ? (
              <p className="text-sm text-muted-foreground">
                Публичный дашборд работает в read-only режиме. Изменение статусов доступно только
                из подписанной manager-link.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border/70 bg-background/70 p-1">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                Список
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                Kanban
              </Button>
            </div>
            {activeFilter.type !== "all" ? (
              <Button variant="outline" size="sm" onClick={() => setActiveFilter({ type: "all" })}>
                <XIcon data-icon="inline-start" />
                Сбросить
              </Button>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {viewMode === "kanban" ? (
        <OperationsKanban
          orders={filteredKanbanOrders}
          statuses={data.kanbanStatuses}
          manageAccess={manageAccess}
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <OrderQueue
              title="Требуют действия сейчас"
              caption="Action Queue"
              description="Основной рабочий поток: новые и ожидающие заказы, где менеджер должен вмешаться прямо сейчас."
              rows={filteredQueues.actionQueue}
              emptyText="По текущему фильтру срочных действий нет."
              manageAccess={manageAccess}
            />
            <OrderQueue
              title="Крупные / премиальные заказы"
              caption={`Порог ${Math.round(data.high_value_threshold / 1000)}k+`}
              description="Приоритетный поток крупных корзин, где важны скорость реакции, точность и контроль SLA."
              rows={filteredQueues.priorityQueue}
              emptyText="По текущему фильтру крупных активных заказов нет."
              manageAccess={manageAccess}
            />
          </div>

          <OrderQueue
            title="Проблемные заказы"
            caption="Risk Queue"
            description="Заказы с отсутствующими данными, непройденными уведомлениями или другими операционными рисками."
            rows={filteredQueues.problemQueue}
            emptyText="По текущему фильтру проблемных заказов нет."
            manageAccess={manageAccess}
          />
        </>
      )}
    </div>
  );
}
