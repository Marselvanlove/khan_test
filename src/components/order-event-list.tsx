import { getOrderEventTypeLabel, formatOrderEventPayloadPreview } from "@/shared/order-events";
import { formatOrderDateTime } from "@/shared/orders";
import type { OrderEventItem } from "@/shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface OrderEventListProps {
  rows: OrderEventItem[];
}

export function OrderEventList({ rows }: OrderEventListProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Event Stream</p>
        <CardTitle>Последние события заказов</CardTitle>
        <CardDescription>
          История реальных действий: sync, ручные статусы, открытия manager/logistics links и Telegram completion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ</TableHead>
                <TableHead>Событие</TableHead>
                <TableHead>Источник</TableHead>
                <TableHead>Payload</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><code>{row.order_retailcrm_id}</code></TableCell>
                  <TableCell>{getOrderEventTypeLabel(row.event_type)}</TableCell>
                  <TableCell>{row.event_source}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {formatOrderEventPayloadPreview(row.payload) || "—"}
                  </TableCell>
                  <TableCell>{formatOrderDateTime(row.event_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            Event stream появится после первой миграции и следующего sync-run.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
