"use client";

import { useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import { OrderQueue } from "@/components/order-queue";
import { StatusBreakdown } from "@/components/status-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OperationsKpiItem, OperationsTabData, OperationalOrderRow } from "@/shared/types";
import { cn } from "@/lib/utils";

interface OperationsTabProps {
  data: OperationsTabData;
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

export function OperationsTab({ data }: OperationsTabProps) {
  const [activeFilter, setActiveFilter] = useState<OperationsFilter>({ type: "all" });

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
              {getFilterTitle(activeFilter)}. Фильтр применяется сразу ко всем рабочим очередям ниже.
            </CardDescription>
          </div>
          {activeFilter.type !== "all" ? (
            <Button variant="outline" size="sm" onClick={() => setActiveFilter({ type: "all" })}>
              <XIcon data-icon="inline-start" />
              Сбросить
            </Button>
          ) : null}
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <OrderQueue
          title="Требуют действия сейчас"
          caption="Action Queue"
          description="Основной рабочий поток: новые и ожидающие заказы, где менеджер должен вмешаться прямо сейчас."
          rows={filteredQueues.actionQueue}
          emptyText="По текущему фильтру срочных действий нет."
        />
        <OrderQueue
          title="Крупные / премиальные заказы"
          caption={`Порог ${Math.round(data.high_value_threshold / 1000)}k+`}
          description="Приоритетный поток крупных корзин, где важны скорость реакции, точность и контроль SLA."
          rows={filteredQueues.priorityQueue}
          emptyText="По текущему фильтру крупных активных заказов нет."
        />
      </div>

      <OrderQueue
        title="Проблемные заказы"
        caption="Risk Queue"
        description="Заказы с отсутствующими данными, непройденными уведомлениями или другими операционными рисками."
        rows={filteredQueues.problemQueue}
        emptyText="По текущему фильтру проблемных заказов нет."
      />
    </div>
  );
}
