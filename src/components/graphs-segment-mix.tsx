import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyKzt } from "@/shared/orders";
import type { GraphsSegmentRow, SourceMetric } from "@/shared/types";

interface GraphsSegmentMixProps {
  segments: GraphsSegmentRow[];
  sources: SourceMetric[];
  className?: string;
}

export function GraphsSegmentMix({ segments, sources, className }: GraphsSegmentMixProps) {
  return (
    <Card className={className}>
      <CardHeader className="border-b border-border/70">
        <CardTitle>Структура выручки</CardTitle>
        <CardDescription>
          Сегменты корзины и каналы, которые формируют продажи в текущем периоде.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3">
          <p className="text-sm font-medium">Сегменты корзины</p>
          {segments.map((segment) => (
            <div key={segment.code} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{segment.label}</p>
                  <Badge variant="outline">{segment.orders}</Badge>
                </div>
                <p className="text-sm font-semibold">{formatCurrencyKzt(segment.revenue)}</p>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-slate-800"
                  style={{ width: `${Math.max(segment.share_of_revenue, 6)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid gap-3">
          <p className="text-sm font-medium">Источники</p>
          {sources.slice(0, 6).map((source) => (
            <div key={source.source} className="flex items-center justify-between gap-3 text-sm">
              <span>{source.source}</span>
              <span className="font-medium">{formatCurrencyKzt(source.revenue)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

