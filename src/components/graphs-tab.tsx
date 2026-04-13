"use client";

import { useMemo, useState } from "react";
import { CalendarDaysIcon } from "lucide-react";
import { GraphsKpiColumn } from "@/components/graphs-kpi-column";
import { GraphsSalesTrend } from "@/components/graphs-sales-trend";
import { GraphsSegmentMix } from "@/components/graphs-segment-mix";
import { GraphsTopCities } from "@/components/graphs-top-cities";
import { GraphsTopProducts } from "@/components/graphs-top-products";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildSourceMetrics, summarizeMetrics } from "@/shared/orders";
import type { GraphsData, GraphsTrendPoint, OperationalOrderRow } from "@/shared/types";

interface GraphsTabProps {
  data: GraphsData;
  orders: OperationalOrderRow[];
  highValueThreshold: number;
}

interface DateRangeValue {
  start: string;
  end: string;
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
});
const PERIOD_LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function getDateKey(value: string) {
  return value.slice(0, 10);
}

function formatPeriodLabel(range: DateRangeValue) {
  return `${PERIOD_LABEL_FORMATTER.format(dateFromKey(range.start))} — ${PERIOD_LABEL_FORMATTER.format(
    dateFromKey(range.end),
  )}`;
}

function getMonthBounds(dateKey: string): DateRangeValue {
  const [year, month] = dateKey.split("-").map(Number);
  const monthToken = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    start: `${year}-${monthToken}-01`,
    end: `${year}-${monthToken}-${String(lastDay).padStart(2, "0")}`,
  };
}

function clampDateKey(value: string, min: string, max: string) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function normalizeRange(range: DateRangeValue, min: string, max: string): DateRangeValue {
  let start = clampDateKey(range.start, min, max);
  let end = clampDateKey(range.end, min, max);

  if (start > end) {
    [start, end] = [end, start];
  }

  return { start, end };
}

function buildDateKeys(range: DateRangeValue) {
  const result: string[] = [];
  const cursor = dateFromKey(range.start);
  const end = dateFromKey(range.end);

  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function getOrdersDateBounds(orders: OperationalOrderRow[]) {
  if (!orders.length) {
    const today = new Date().toISOString().slice(0, 10);

    return { min: today, max: today };
  }

  let min = getDateKey(orders[0].created_at);
  let max = min;

  for (const order of orders) {
    const key = getDateKey(order.created_at);

    if (key < min) {
      min = key;
    }

    if (key > max) {
      max = key;
    }
  }

  return { min, max };
}

function buildDefaultRange(bounds: { min: string; max: string }) {
  return normalizeRange(getMonthBounds(bounds.max), bounds.min, bounds.max);
}

function buildTopProducts(orders: OperationalOrderRow[], totalRevenue: number) {
  const byProduct = new Map<
    string,
    { name: string; qty: number; revenue: number; share_of_revenue: number }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const current = byProduct.get(item.name) ?? {
        name: item.name,
        qty: 0,
        revenue: 0,
        share_of_revenue: 0,
      };

      current.qty += item.quantity;
      current.revenue += item.total_price;
      byProduct.set(item.name, current);
    }
  }

  return Array.from(byProduct.values())
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 10)
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
    }));
}

function buildTopCities(orders: OperationalOrderRow[], totalRevenue: number) {
  const byCity = new Map<
    string,
    { city: string; orders: number; revenue: number; share_of_revenue: number }
  >();

  for (const order of orders) {
    const city = order.city?.trim() || "Не указан";
    const current = byCity.get(city) ?? {
      city,
      orders: 0,
      revenue: 0,
      share_of_revenue: 0,
    };

    current.orders += 1;
    current.revenue += order.total_amount;
    byCity.set(city, current);
  }

  return Array.from(byCity.values())
    .sort((left, right) => right.revenue - left.revenue)
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
    }));
}

function buildSegmentMix(orders: OperationalOrderRow[], totalRevenue: number) {
  const bySegment = new Map<
    OperationalOrderRow["segment_code"],
    {
      code: OperationalOrderRow["segment_code"];
      label: string;
      orders: number;
      revenue: number;
      share_of_revenue: number;
    }
  >();

  for (const order of orders) {
    const current = bySegment.get(order.segment_code) ?? {
      code: order.segment_code,
      label: order.segment_label,
      orders: 0,
      revenue: 0,
      share_of_revenue: 0,
    };

    current.orders += 1;
    current.revenue += order.total_amount;
    bySegment.set(order.segment_code, current);
  }

  return Array.from(bySegment.values())
    .sort((left, right) => right.revenue - left.revenue)
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
    }));
}

function buildTrend(orders: OperationalOrderRow[], range: DateRangeValue, highValueThreshold: number): GraphsTrendPoint[] {
  const metricsByDate = new Map<string, GraphsTrendPoint>();

  for (const date of buildDateKeys(range)) {
    metricsByDate.set(date, {
      date,
      label: DAY_LABEL_FORMATTER.format(dateFromKey(date)),
      orders_count: 0,
      revenue: 0,
      high_value_orders: 0,
    });
  }

  for (const order of orders) {
    const dateKey = getDateKey(order.created_at);
    const current = metricsByDate.get(dateKey);

    if (!current) {
      continue;
    }

    current.orders_count += 1;
    current.revenue += order.total_amount;

    if (order.total_amount > highValueThreshold) {
      current.high_value_orders += 1;
    }
  }

  return Array.from(metricsByDate.values());
}

function buildGraphsDataForRange(
  orders: OperationalOrderRow[],
  range: DateRangeValue,
  highValueThreshold: number,
  reportTitle: string,
): GraphsData {
  const summary = summarizeMetrics(orders, highValueThreshold);

  return {
    report_title: reportTitle,
    report_period_label: formatPeriodLabel(range),
    sales_summary: {
      total_orders: summary.totalOrders,
      total_revenue: summary.totalRevenue,
      average_order_value: summary.totalOrders ? summary.totalRevenue / summary.totalOrders : 0,
      high_value_share: summary.totalOrders ? (summary.highValueOrders / summary.totalOrders) * 100 : 0,
    },
    sales_trend: buildTrend(orders, range, highValueThreshold),
    top_products: buildTopProducts(orders, summary.totalRevenue),
    top_cities: buildTopCities(orders, summary.totalRevenue),
    source_mix: buildSourceMetrics(
      orders.map((order) => ({
        utm_source: order.utm_source,
        total_amount: order.total_amount,
      })),
    ),
    segment_mix: buildSegmentMix(orders, summary.totalRevenue),
  };
}

export function GraphsTab({ data, orders, highValueThreshold }: GraphsTabProps) {
  const bounds = useMemo(() => getOrdersDateBounds(orders), [orders]);
  const defaultRange = useMemo(() => buildDefaultRange(bounds), [bounds]);
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [draftRange, setDraftRange] = useState<DateRangeValue>(defaultRange);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const normalizedRange = useMemo(
    () => normalizeRange(range, bounds.min, bounds.max),
    [bounds.max, bounds.min, range],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const key = getDateKey(order.created_at);

        return key >= normalizedRange.start && key <= normalizedRange.end;
      }),
    [normalizedRange.end, normalizedRange.start, orders],
  );

  const filteredData = useMemo(
    () => buildGraphsDataForRange(filteredOrders, normalizedRange, highValueThreshold, data.report_title),
    [data.report_title, filteredOrders, highValueThreshold, normalizedRange],
  );

  const applyDraftRange = () => {
    setRange(normalizeRange(draftRange, bounds.min, bounds.max));
    setIsPickerOpen(false);
  };

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-sm">
      <div className="flex flex-col gap-3 bg-zinc-900 px-6 py-4 text-zinc-50 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="border-r border-zinc-700 pr-4 text-sm font-semibold uppercase tracking-[0.18em]">
            Tomyris
          </div>
          <div className="text-sm text-zinc-300">Показатели продаж</div>
        </div>

        <Popover
          open={isPickerOpen}
          onOpenChange={(nextOpen) => {
            setIsPickerOpen(nextOpen);

            if (nextOpen) {
              setDraftRange(normalizedRange);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="justify-start border-zinc-700 bg-zinc-900/50 text-zinc-50 hover:bg-zinc-800 hover:text-zinc-50"
            >
              <CalendarDaysIcon className="size-4" />
              {filteredData.report_period_label}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[23rem]">
            <PopoverHeader>
              <PopoverTitle>Период графиков</PopoverTitle>
              <PopoverDescription>
                По умолчанию выбран текущий месяц от первого доступного дня месяца. Кастомный
                диапазон ограничен датами заказов: с {bounds.min} по {bounds.max}.
              </PopoverDescription>
            </PopoverHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <label htmlFor="graphs-range-start" className="text-xs font-medium text-muted-foreground">
                  От
                </label>
                <Input
                  id="graphs-range-start"
                  type="date"
                  min={bounds.min}
                  max={bounds.max}
                  value={draftRange.start}
                  onChange={(event) =>
                    setDraftRange((current) => ({
                      ...current,
                      start: event.target.value || current.start,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="graphs-range-end" className="text-xs font-medium text-muted-foreground">
                  До
                </label>
                <Input
                  id="graphs-range-end"
                  type="date"
                  min={bounds.min}
                  max={bounds.max}
                  value={draftRange.end}
                  onChange={(event) =>
                    setDraftRange((current) => ({
                      ...current,
                      end: event.target.value || current.end,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraftRange(defaultRange)}
              >
                Текущий месяц
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraftRange({ start: bounds.min, end: bounds.max })}
              >
                Весь период
              </Button>
              <Button type="button" size="sm" className="ml-auto" onClick={applyDraftRange}>
                Применить
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <CardHeader className="border-b border-border/70 pb-6">
        <CardTitle className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {filteredData.report_title}
        </CardTitle>
        <CardDescription className="max-w-3xl text-base leading-7">
          Отчётный экран по реальным данным Tomyris: динамика продаж, топ товаров, города и
          структура выручки. Период можно переключать через диапазон дат сверху.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 p-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <GraphsKpiColumn data={filteredData} className="xl:row-span-2" />
        <GraphsSalesTrend
          key={filteredData.report_period_label}
          points={filteredData.sales_trend}
          orders={filteredOrders}
          highValueThreshold={highValueThreshold}
        />
        <GraphsTopProducts rows={filteredData.top_products} />
        <GraphsTopCities rows={filteredData.top_cities} />
        <GraphsSegmentMix segments={filteredData.segment_mix} sources={filteredData.source_mix} />
      </CardContent>
    </Card>
  );
}
