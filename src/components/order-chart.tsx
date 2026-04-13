"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DailyMetric } from "@/shared/types";

interface OrderChartProps {
  metrics: DailyMetric[];
}

const chartConfig = {
  orders_count: {
    label: "Заказы",
    color: "var(--chart-1)",
  },
  revenue: {
    label: "Выручка",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function OrderChart({ metrics }: OrderChartProps) {
  if (!metrics.length) {
    return (
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Динамика заказов</CardTitle>
          <CardDescription>
            После первого sync здесь появится график по `daily_order_metrics`.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = metrics.map((metric) => ({
    ...metric,
    day: new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
    }).format(new Date(metric.order_date)),
  }));

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>Динамика заказов</CardTitle>
        <CardDescription>
          Рабочий график по дням. Используется для менеджерского ритма и оценки темпа продаж.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[320px] w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => `Дата: ${label}`}
                  formatter={(value) => [
                    <span key="value">{value}</span>,
                    "Заказы",
                  ]}
                />
              }
            />
            <Bar
              dataKey="orders_count"
              fill="var(--color-orders_count)"
              radius={[10, 10, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
