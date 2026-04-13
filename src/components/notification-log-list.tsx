import { getAlertTypeLabel } from "@/shared/admin-settings";
import { formatOrderDate } from "@/shared/orders";
import type { NotificationLogItem } from "@/shared/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface NotificationLogListProps {
  rows: NotificationLogItem[];
}

export function NotificationLogList({ rows }: NotificationLogListProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Audit Log</p>
        <CardTitle>Лог уведомлений</CardTitle>
        <CardDescription>
          Видно, что ушло, где был retry, где словили rate limit и какие события ждут расследования.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Попытка</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.order_retailcrm_id}-${row.created_at}-${row.attempt}`}>
                  <TableCell><code>{row.order_number ?? row.order_retailcrm_id}</code></TableCell>
                  <TableCell>{getAlertTypeLabel(row.event_type)}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "sent" ? "secondary" : "destructive"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.attempt}</TableCell>
                  <TableCell>{formatOrderDate(row.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            Лог уведомлений появится после первой отправки в новой схеме.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
