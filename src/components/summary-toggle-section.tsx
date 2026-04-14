"use client";

import { useEffect, useState } from "react";
import { formatCurrencyKzt } from "@/shared/orders";
import type { AdminSettings, DashboardSummary, OwnerMetrics } from "@/shared/types";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";

interface SummaryToggleSectionProps {
  summary: DashboardSummary;
  ownerMetrics: OwnerMetrics;
  adminSettings: AdminSettings;
  initialVisible: boolean;
}

export function SummaryToggleSection({
  summary,
  ownerMetrics,
  adminSettings,
  initialVisible,
}: SummaryToggleSectionProps) {
  const [visible, setVisible] = useState(initialVisible);

  useEffect(() => {
    document.cookie = `dashboard-summary-visible=${visible ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }, [visible]);

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Общая статистика</p>
          <p className="text-sm text-muted-foreground">
            Ключевые показатели по заказам, выручке и рискам.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Скрыть" : "Показать общую статистику"}
        </Button>
      </div>

      {visible ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <StatCard
            eyebrow="Всего заказов"
            value={String(summary.totalOrders)}
            hint="Все заказы, подтянутые из RetailCRM."
          />
          <StatCard
            eyebrow="Выручка"
            value={formatCurrencyKzt(summary.totalRevenue)}
            hint="Суммарная выручка по всем заказам."
            tone="accent"
          />
          <StatCard
            eyebrow={`Крупные ${Math.round(adminSettings.high_value_threshold / 1000)}k+`}
            value={String(summary.highValueOrders)}
            hint="Заказы, которые сейчас попадают под порог уведомления."
          />
          <StatCard
            eyebrow="Неизвестный источник"
            value={String(summary.unknownSourceOrders)}
            hint="Заказы, где маркетинг теряет атрибуцию."
          />
          <StatCard
            eyebrow="Без контакта"
            value={String(summary.ordersWithoutContact)}
            hint="Заказы без телефона и email. Это оперативный риск."
          />
          <StatCard
            eyebrow="Без первой реакции"
            value={String(ownerMetrics.ordersWithoutFirstTouch)}
            hint="Активные заказы, по которым команда ещё не зафиксировала ни одного рабочего действия."
          />
          <StatCard
            eyebrow="Средний чек"
            value={formatCurrencyKzt(ownerMetrics.averageOrderValue)}
            hint="Качество корзины, а не только объём потока."
          />
          <StatCard
            eyebrow="Median first touch"
            value={
              ownerMetrics.medianFirstTouchMinutes == null
                ? "нет данных"
                : `${ownerMetrics.medianFirstTouchMinutes} мин`
            }
            hint="Медианное время до первого рабочего касания по заказу."
          />
        </div>
      ) : null}
    </section>
  );
}
