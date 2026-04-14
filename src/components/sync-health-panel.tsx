import { formatOrderDateTime } from "@/shared/orders";
import type { SyncHealthOverview } from "@/shared/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SyncHealthPanelProps {
  overview: SyncHealthOverview;
}

export function SyncHealthPanel({ overview }: SyncHealthPanelProps) {
  const latestRun = overview.latestRun;

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Sync Health</p>
        <CardTitle>Состояние синка RetailCRM</CardTitle>
        <CardDescription>
          Последний run, текущий reconciliation state и заказы без зафиксированной реакции.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">Последний run</p>
          <p className="mt-2 text-lg font-semibold">
            {latestRun?.finished_at ? formatOrderDateTime(latestRun.finished_at) : "нет данных"}
          </p>
          <div className="mt-3">
            <Badge variant={latestRun?.status === "failed" ? "destructive" : "secondary"}>
              {latestRun?.status ?? "unknown"}
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">Синхронные snapshot’ы</p>
          <p className="mt-2 text-3xl font-semibold">{overview.syncedOrders}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Заказы, которые сейчас считаются синхронными с RetailCRM.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">Missing in RetailCRM</p>
          <p className="mt-2 text-3xl font-semibold">{overview.missingInRetailCrm}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Snapshot’ы, которые есть в Supabase, но не найдены в последнем pull из CRM.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">Без первой реакции</p>
          <p className="mt-2 text-3xl font-semibold">{overview.ordersWithoutFirstTouch}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Активные заказы, где ещё нет ни открытия карточки, ни смены статуса, ни действия из Telegram.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
