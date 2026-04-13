"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OpsOrderCard } from "@/components/ops-order-card";
import { formatCurrencyKzt, formatOrderDate } from "@/shared/orders";
import type { GraphsTrendPoint, OperationalOrderRow } from "@/shared/types";

interface GraphsSalesTrendProps {
  points: GraphsTrendPoint[];
  orders: OperationalOrderRow[];
  highValueThreshold: number;
  className?: string;
}

type TrendChartPoint = GraphsTrendPoint & {
  has_high_value: boolean;
};

const chartConfig = {
  revenue: {
    label: "Выручка",
    color: "#8a9bd4",
  },
  orders_count: {
    label: "Заказы",
    color: "#24303d",
  },
} satisfies ChartConfig;

function compactKzt(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} млн`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return String(value);
}

function buildRevenueTicks(points: GraphsTrendPoint[], highValueThreshold: number) {
  const maxRevenue = Math.max(
    highValueThreshold * 2,
    ...points.map((point) => point.revenue),
    1,
  );
  const step = maxRevenue <= 100_000 ? 25_000 : maxRevenue <= 200_000 ? 50_000 : 100_000;
  const maxTick = Math.ceil(maxRevenue / step) * step;
  const ticks: number[] = [];

  for (let value = 0; value <= maxTick; value += step) {
    ticks.push(value);
  }

  return { maxTick, ticks };
}

function formatHighValueLabel(count: number, threshold: number) {
  const noun = count === 1 ? "заказ" : count < 5 ? "заказа" : "заказов";

  return `${count} ${noun} выше ${formatCurrencyKzt(threshold)}`;
}

function getOrderDateKey(value: string) {
  return value.slice(0, 10);
}

function getActivePointFromChartState(chartState: unknown): TrendChartPoint | null {
  if (!chartState || typeof chartState !== "object" || !("activePayload" in chartState)) {
    return null;
  }

  const activePayload = (chartState as { activePayload?: Array<{ payload?: TrendChartPoint }> })
    .activePayload;

  return activePayload?.[0]?.payload ?? null;
}

export function GraphsSalesTrend({
  points,
  orders,
  highValueThreshold,
  className,
}: GraphsSalesTrendProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollRef = useRef(false);

  const ordersByDate = useMemo(() => {
    const grouped = new Map<string, OperationalOrderRow[]>();

    for (const order of orders) {
      const key = getOrderDateKey(order.created_at);
      const current = grouped.get(key);

      if (current) {
        current.push(order);
      } else {
        grouped.set(key, [order]);
      }
    }

    return grouped;
  }, [orders]);

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        has_high_value: point.high_value_orders > 0,
      })),
    [points],
  );
  const highlightedDays = useMemo(
    () => chartData.filter((point) => point.high_value_orders > 0),
    [chartData],
  );
  const { maxTick, ticks } = useMemo(
    () => buildRevenueTicks(points, highValueThreshold),
    [points, highValueThreshold],
  );
  const selectedPoint = useMemo(
    () => chartData.find((point) => point.date === selectedDate) ?? null,
    [chartData, selectedDate],
  );
  const selectedOrders = useMemo(
    () => (selectedDate ? ordersByDate.get(selectedDate) ?? [] : []),
    [ordersByDate, selectedDate],
  );

  useEffect(() => {
    if (!selectedDate || !shouldScrollRef.current) {
      return;
    }

    shouldScrollRef.current = false;
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate && !chartData.some((point) => point.date === selectedDate)) {
      setSelectedDate(null);
    }
  }, [chartData, selectedDate]);

  if (!points.length) {
    return (
      <Card className={className}>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Продажи по дням</CardTitle>
          <CardDescription>
            После первого sync здесь появится график с выручкой, количеством заказов и детализацией
            по дням.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSelectDate = (date: string) => {
    if (date === selectedDate) {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    shouldScrollRef.current = true;
    startTransition(() => {
      setSelectedDate(date);
    });
  };

  return (
    <div className="grid gap-4">
      <Card className={className}>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Продажи по дням</CardTitle>
          <CardDescription>
            Столбцы показывают дневную выручку, линия показывает количество заказов. Нажмите на
            столбец, точку или день на графике, чтобы открыть конкретные заказы ниже.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-2 rounded-full px-3 py-1 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: "var(--color-revenue)" }}
              />
              Выручка по дням
            </Badge>
            <Badge variant="outline" className="gap-2 rounded-full px-3 py-1 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: "var(--color-orders_count)" }}
              />
              Количество заказов
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
              Ориентир: {formatCurrencyKzt(highValueThreshold)}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
              Нажмите на график, чтобы открыть заказы за день
            </Badge>
          </div>

          {highlightedDays.length ? (
            <div className="flex flex-wrap gap-2">
              {highlightedDays.slice(0, 8).map((point) => (
                <Badge key={point.date} variant="secondary" className="rounded-full px-3 py-1">
                  {point.label}: {formatHighValueLabel(point.high_value_orders, highValueThreshold)}
                </Badge>
              ))}
            </div>
          ) : null}

          <ChartContainer config={chartConfig} className="min-h-[420px] w-full">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 18, left: 10, bottom: 8 }}
              onClick={(chartState) => {
                const point = getActivePointFromChartState(chartState);

                if (point) {
                  handleSelectDate(point.date);
                }
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis
                yAxisId="revenue"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tickFormatter={compactKzt}
                ticks={ticks}
                domain={[0, maxTick]}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                allowDecimals={false}
              />

              <ReferenceLine
                yAxisId="revenue"
                y={highValueThreshold}
                stroke="rgba(98, 115, 182, 0.55)"
                strokeDasharray="6 6"
                ifOverflow="extendDomain"
                label={{
                  value: `${Math.round(highValueThreshold / 1000)}k ориентир`,
                  position: "insideTopLeft",
                  fill: "#6273b6",
                  fontSize: 12,
                }}
              />

              {selectedPoint ? (
                <ReferenceLine
                  x={selectedPoint.label}
                  stroke="rgba(31, 41, 51, 0.18)"
                  strokeDasharray="4 4"
                />
              ) : null}

              <ChartTooltip
                cursor={{ fill: "rgba(31, 41, 51, 0.05)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const point = payload[0]?.payload as GraphsTrendPoint | undefined;

                  if (!point) {
                    return null;
                  }

                  return (
                    <div className="grid gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                      <div className="font-medium text-foreground">{formatOrderDate(point.date)}</div>
                      <div className="grid gap-1 text-muted-foreground">
                        <div className="flex items-center justify-between gap-4">
                          <span>Выручка</span>
                          <span className="font-medium text-foreground">
                            {formatCurrencyKzt(point.revenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Заказов</span>
                          <span className="font-medium text-foreground">{point.orders_count}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Крупных заказов</span>
                          <span className="font-medium text-foreground">
                            {point.high_value_orders}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />

              <Bar yAxisId="revenue" dataKey="revenue" radius={[12, 12, 0, 0]} barSize={26}>
                {chartData.map((point) => {
                  const fill =
                    selectedDate === point.date
                      ? "#24303d"
                      : point.has_high_value
                        ? "#7b8bd0"
                        : "#a7b4df";

                  return (
                    <Cell
                      key={point.date}
                      fill={fill}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSelectDate(point.date)}
                    />
                  );
                })}
              </Bar>

              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders_count"
                stroke="var(--color-orders_count)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{ r: 4, fill: "#ffffff", stroke: "var(--color-orders_count)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#ffffff", stroke: "var(--color-orders_count)", strokeWidth: 2.5 }}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div ref={detailsRef}>
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>
              {selectedPoint ? `Заказы за ${formatOrderDate(selectedPoint.date)}` : "Заказы по выбранному дню"}
            </CardTitle>
            <CardDescription>
              {selectedPoint
                ? "Список обновляется по клику на другой день в графике."
                : "Нажмите на график выше, и здесь появятся конкретные заказы за выбранный день."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {selectedPoint ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Дата</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {formatOrderDate(selectedPoint.date)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Выручка</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {formatCurrencyKzt(selectedPoint.revenue)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Всего заказов</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedPoint.orders_count}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Крупные заказы</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedPoint.high_value_orders}
                  </p>
                </div>
              </div>
            ) : null}

            {selectedPoint ? (
              selectedOrders.length ? (
                <ScrollArea className="h-[34rem] pr-4">
                  <div className="grid gap-4">
                    {selectedOrders.map((order) => (
                      <OpsOrderCard key={`${order.retailcrm_id}-${order.crm_number}`} order={order} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                  Заказов за этот день не найдено. Проверь синхронность `orders` и агрегации
                  по дням.
                </div>
              )
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-8 text-sm text-muted-foreground">
                Выберите день в графике. После клика экран прокрутится сюда и покажет конкретные
                заказы.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
