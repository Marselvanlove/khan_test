import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyKzt } from "@/shared/orders";
import type { SourceMetric } from "@/shared/types";

interface SourceBreakdownProps {
  rows: SourceMetric[];
  title?: string;
  caption?: string;
  description?: string;
}

export function SourceBreakdown({
  rows,
  title = "Источники заказов",
  caption = "Acquisition",
  description = "Tomyris строит спрос через social-driven каналы, поэтому `utm_source` здесь ключевой.",
}: SourceBreakdownProps) {
  const maxOrders = Math.max(...rows.map((row) => row.orders), 1);

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{caption}</p>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rows.length ? (
          rows.slice(0, 8).map((row) => (
            <div key={row.source} className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{row.source}</p>
                  <Badge variant="outline">{row.orders} заказов</Badge>
                </div>
                <p className="font-mono text-sm">{formatCurrencyKzt(row.revenue)}</p>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.max((row.orders / maxOrders) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            После sync здесь появится разбивка по каналам.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
