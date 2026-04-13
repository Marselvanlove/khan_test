import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyKzt } from "@/shared/orders";
import type { GraphsProductRow } from "@/shared/types";

interface GraphsTopProductsProps {
  rows: GraphsProductRow[];
  className?: string;
}

export function GraphsTopProducts({ rows, className }: GraphsTopProductsProps) {
  const maxRevenue = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <Card className={className}>
      <CardHeader className="border-b border-border/70">
        <CardTitle>Топ товаров по выручке</CardTitle>
        <CardDescription>
          Реальный рейтинг по данным `raw_payload.items`, без синтетических планов и прогнозов.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              key={row.name}
              className="grid gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {index + 1}
                  </div>
                  <div className="grid gap-0.5">
                    <p className="font-medium leading-tight">{row.name}</p>
                    <p className="text-sm text-muted-foreground">{row.qty} шт.</p>
                  </div>
                </div>
                <p className="whitespace-nowrap text-sm font-semibold">
                  {formatCurrencyKzt(row.revenue)}
                </p>
              </div>
              <div className="h-2 rounded-full bg-sky-100">
                <div
                  className="h-2 rounded-full bg-sky-300"
                  style={{ width: `${Math.max((row.revenue / maxRevenue) * 100, 8)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {row.share_of_revenue.toFixed(1)}% от выручки
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Товарные данные пока не загружены.</p>
        )}
      </CardContent>
    </Card>
  );
}

