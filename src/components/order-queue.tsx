import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OpsOrderCard } from "@/components/ops-order-card";
import type { OperationalOrderRow } from "@/shared/types";

interface OrderQueueProps {
  title: string;
  caption: string;
  description: string;
  rows: OperationalOrderRow[];
  emptyText: string;
}

export function OrderQueue({ title, caption, description, rows, emptyText }: OrderQueueProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{caption}</p>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ScrollArea className="h-[32rem] pr-4">
            <div className="grid gap-4">
              {rows.map((row) => (
                <OpsOrderCard key={`${row.retailcrm_id}-${row.crm_number}`} order={row} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
