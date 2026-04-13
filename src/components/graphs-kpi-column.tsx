import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyKzt } from "@/shared/orders";
import type { GraphsData } from "@/shared/types";

interface GraphsKpiColumnProps {
  data: GraphsData;
  className?: string;
}

export function GraphsKpiColumn({ data, className }: GraphsKpiColumnProps) {
  const stats = [
    {
      title: "Выручка",
      value: formatCurrencyKzt(data.sales_summary.total_revenue),
      description: "Общая выручка за выбранный период.",
    },
    {
      title: "Средний чек",
      value: formatCurrencyKzt(data.sales_summary.average_order_value),
      description: "Средняя стоимость одного заказа.",
    },
    {
      title: "Заказы",
      value: String(data.sales_summary.total_orders),
      description: "Количество заказов за период.",
    },
    {
      title: "Доля high-value",
      value: `${data.sales_summary.high_value_share.toFixed(0)}%`,
      description: "Доля заказов выше порога high-value.",
    },
  ];

  return (
    <Card className={className}>
      <CardHeader className="border-b border-border/70">
        <CardTitle>Продажи</CardTitle>
        <CardDescription>Ключевые KPI по текущему набору заказов.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {stats.map((stat, index) => (
          <div key={stat.title} className="grid gap-3">
            <div className="grid gap-1">
              <p className="text-xl font-semibold tracking-tight text-foreground/90 sm:text-2xl">
                {stat.value}
              </p>
              <p className="text-sm font-medium">{stat.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">{stat.description}</p>
            </div>
            {index !== stats.length - 1 ? <Separator /> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

