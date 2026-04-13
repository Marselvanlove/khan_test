import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyKzt } from "@/shared/orders";
import type { GraphsCityRow } from "@/shared/types";

interface GraphsTopCitiesProps {
  rows: GraphsCityRow[];
  className?: string;
}

export function GraphsTopCities({ rows, className }: GraphsTopCitiesProps) {
  return (
    <Card className={className}>
      <CardHeader className="border-b border-border/70">
        <CardTitle>Топ городов по выручке</CardTitle>
        <CardDescription>
          В текущих данных география узкая, поэтому честнее показывать города, а не декоративную карту.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Город</TableHead>
              <TableHead>Заказы</TableHead>
              <TableHead>Выручка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.city}>
                <TableCell>{row.city}</TableCell>
                <TableCell>{row.orders}</TableCell>
                <TableCell>{formatCurrencyKzt(row.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

