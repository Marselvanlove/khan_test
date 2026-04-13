"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyKzt, formatOrderDateTime, formatPaymentStatusLabel } from "@/shared/orders";
import type {
  FinanceAccountingExceptionRow,
  FinanceCancellationLosses,
  FinanceKpiItem,
  FinanceOrderFact,
  FinancePaymentSummaryRow,
  FinanceSegmentRevenueRow,
  FinanceTabData,
  PaymentStatus,
} from "@/shared/types";

interface FinanceTabProps {
  data: FinanceTabData;
}

type PeriodValue = "all" | "7d" | "14d" | "28d";
type PaymentFilter = "all" | PaymentStatus;

function applyPeriodFilter<T extends { created_at: string }>(rows: T[], period: PeriodValue) {
  if (period === "all") {
    return rows;
  }

  const days = period === "7d" ? 7 : period === "14d" ? 14 : 28;
  const boundary = Date.now() - days * 24 * 60 * 60 * 1000;

  return rows.filter((row) => Date.parse(row.created_at) >= boundary);
}

function buildKpis(
  rows: FinanceOrderFact[],
  hasReliablePaymentData: boolean,
): FinanceKpiItem[] {
  const totalOrders = rows.length;
  const gmv = rows.reduce((sum, row) => sum + row.total_amount, 0);
  const cancelledAmount = rows
    .filter((row) => row.status_group === "cancel")
    .reduce((sum, row) => sum + row.total_amount, 0);
  const paidAmount = rows.reduce((sum, row) => sum + row.paid_amount, 0);
  const unpaidAmount = rows.reduce((sum, row) => sum + row.outstanding_amount, 0);
  const ordersWithPaymentData = rows.filter((row) => row.has_payment_data).length;
  const paidOrders = rows.filter((row) => row.payment_status === "paid").length;

  return [
    {
      key: "gmv",
      label: "GMV",
      value: gmv,
      hint: "Валовая выручка по заказам в текущем финансовом срезе.",
    },
    {
      key: "paid-amount",
      label: "Оплачено",
      value: hasReliablePaymentData ? paidAmount : null,
      hint: "Подтверждённые оплаты из RetailCRM.",
    },
    {
      key: "unpaid-amount",
      label: "Не оплачено",
      value: hasReliablePaymentData ? unpaidAmount : null,
      hint: "Остаток по заказам, где деньги ещё не закрыты полностью.",
    },
    {
      key: "average-order-value",
      label: "Средний чек",
      value: totalOrders ? gmv / totalOrders : 0,
      hint: "Средняя сумма заказа без подмены операционными метриками.",
    },
    {
      key: "cancel-losses",
      label: "Потери на отменах",
      value: cancelledAmount,
      hint: "Сумма заказов, ушедших в отмену или возврат.",
    },
    {
      key: "paid-rate",
      label: "Доля оплаченных",
      value:
        hasReliablePaymentData && ordersWithPaymentData
          ? (paidOrders / ordersWithPaymentData) * 100
          : null,
      hint: "Доля полностью оплаченных заказов среди заказов с платёжными данными.",
    },
  ];
}

function buildPaymentSummary(rows: FinanceOrderFact[]): FinancePaymentSummaryRow[] {
  const statuses: PaymentStatus[] = ["unpaid", "partial", "paid", "refunded", "unknown"];

  return statuses.map((status) => {
    const facts = rows.filter((row) => row.payment_status === status);

    return {
      status,
      label: formatPaymentStatusLabel(status),
      count: facts.length,
      amount: facts.reduce((sum, fact) => sum + fact.total_amount, 0),
    };
  });
}

function buildSegmentRevenue(rows: FinanceOrderFact[]): FinanceSegmentRevenueRow[] {
  const totalRevenue = rows.reduce((sum, row) => sum + row.total_amount, 0);
  const summary = new Map<string, FinanceSegmentRevenueRow>();

  for (const row of rows) {
    const current = summary.get(row.segment_code) ?? {
      segment: row.segment_code,
      label: row.segment_label,
      orders: 0,
      gmv: 0,
      paid_amount: 0,
      share_of_revenue: 0,
    };

    current.orders += 1;
    current.gmv += row.total_amount;
    current.paid_amount += row.paid_amount;
    summary.set(row.segment_code, current);
  }

  return Array.from(summary.values())
    .map((row) => ({
      ...row,
      share_of_revenue: totalRevenue ? (row.gmv / totalRevenue) * 100 : 0,
    }))
    .sort((left, right) => right.gmv - left.gmv);
}

function buildCancellationLosses(rows: FinanceOrderFact[]): FinanceCancellationLosses {
  const cancelledRows = rows.filter((row) => row.status_group === "cancel");

  return {
    cancelled_orders: cancelledRows.length,
    cancelled_amount: cancelledRows.reduce((sum, row) => sum + row.total_amount, 0),
    cancelled_after_payment_count: cancelledRows.filter((row) => row.is_cancelled_after_payment).length,
    potential_refund_amount: cancelledRows.reduce((sum, row) => sum + row.paid_amount, 0),
  };
}

function buildAccountingExceptions(rows: FinanceOrderFact[]): FinanceAccountingExceptionRow[] {
  return rows
    .filter(
      (row) =>
        row.payment_status === "unpaid" ||
        row.payment_status === "partial" ||
        row.payment_status === "refunded" ||
        row.is_cancelled_after_payment,
    )
    .map((row) => ({
      retailcrm_id: row.retailcrm_id,
      crm_number: row.crm_number,
      customer_name: row.customer_name,
      total_amount: row.total_amount,
      paid_amount: row.paid_amount,
      outstanding_amount: row.outstanding_amount,
      status_label: row.status_label,
      payment_status: row.payment_status,
      payment_paid_at: row.payment_paid_at,
      issue_label: row.is_cancelled_after_payment
        ? "Отменён после оплаты"
        : row.payment_status === "partial"
          ? "Частичная оплата"
          : row.payment_status === "unpaid"
            ? "Оплата не поступила"
            : "Требует проверки возврата",
      manager_url: row.manager_url,
      retailcrm_url: row.retailcrm_url,
    }))
    .sort((left, right) => {
      if (right.outstanding_amount !== left.outstanding_amount) {
        return right.outstanding_amount - left.outstanding_amount;
      }

      return right.total_amount - left.total_amount;
    });
}

function formatKpiValue(item: FinanceKpiItem): string {
  if (item.value == null) {
    return "нет данных";
  }

  if (
    item.key === "gmv" ||
    item.key === "paid-amount" ||
    item.key === "unpaid-amount" ||
    item.key === "average-order-value" ||
    item.key === "cancel-losses"
  ) {
    return formatCurrencyKzt(item.value);
  }

  return `${item.value.toFixed(1)}%`;
}

export function FinanceTab({ data }: FinanceTabProps) {
  const [period, setPeriod] = useState<PeriodValue>("28d");
  const [paymentStatus, setPaymentStatus] = useState<PaymentFilter>("all");

  const periodFilteredFacts = useMemo(
    () => applyPeriodFilter(data.facts, period),
    [data.facts, period],
  );
  const filteredFacts = useMemo(() => {
    if (paymentStatus === "all") {
      return periodFilteredFacts;
    }

    return periodFilteredFacts.filter((row) => row.payment_status === paymentStatus);
  }, [paymentStatus, periodFilteredFacts]);

  const kpis = useMemo(
    () => buildKpis(filteredFacts, data.has_reliable_payment_data),
    [data.has_reliable_payment_data, filteredFacts],
  );
  const paymentSummary = useMemo(
    () => (data.has_reliable_payment_data ? buildPaymentSummary(filteredFacts) : []),
    [data.has_reliable_payment_data, filteredFacts],
  );
  const segmentRevenue = useMemo(() => buildSegmentRevenue(filteredFacts), [filteredFacts]);
  const cancellationLosses = useMemo(() => buildCancellationLosses(filteredFacts), [filteredFacts]);
  const accountingExceptions = useMemo(
    () => (data.has_reliable_payment_data ? buildAccountingExceptions(filteredFacts) : []),
    [data.has_reliable_payment_data, filteredFacts],
  );

  return (
    <div className="grid gap-6">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Финансовый срез</CardTitle>
          <CardDescription>
            Вкладка отвечает за деньги, оплаты, отмены и сверку. Текущий отчётный период: {data.report_period_label}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodValue)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Период" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Весь период</SelectItem>
              <SelectItem value="7d">Последние 7 дней</SelectItem>
              <SelectItem value="14d">Последние 14 дней</SelectItem>
              <SelectItem value="28d">Последние 28 дней</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as PaymentFilter)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Статус оплаты" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы оплат</SelectItem>
              <SelectItem value="unpaid">Не оплачено</SelectItem>
              <SelectItem value="partial">Частично оплачено</SelectItem>
              <SelectItem value="paid">Оплачено</SelectItem>
              <SelectItem value="refunded">Возврат</SelectItem>
              <SelectItem value="unknown">Нет данных</SelectItem>
            </SelectContent>
          </Select>

          <div className="lg:col-span-2 flex flex-wrap gap-2">
            <Badge variant="outline">Период: {period === "all" ? "весь" : period}</Badge>
            {paymentStatus !== "all" ? <Badge variant="secondary">{formatPaymentStatusLabel(paymentStatus)}</Badge> : null}
            {!data.has_reliable_payment_data ? (
              <Badge variant="destructive">Нет достоверных платёжных данных</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item) => (
          <StatCard
            key={item.key}
            eyebrow={item.label}
            value={formatKpiValue(item)}
            hint={item.hint}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Статусы оплат</CardTitle>
            <CardDescription>
              Платёжный слой без смешения с операционными backlog’ами.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Статус</TableHead>
                  <TableHead>Заказы</TableHead>
                  <TableHead>GMV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentSummary.length ? paymentSummary.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      <Button variant="link" className="h-auto px-0" onClick={() => setPaymentStatus(row.status)}>
                        {row.label}
                      </Button>
                    </TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{formatCurrencyKzt(row.amount)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                      Платёжный статус появится после загрузки оплат из RetailCRM.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Отмены и потери</CardTitle>
            <CardDescription>
              Показывает, где деньги уже потеряны или требуют возврата/сверки.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Card size="sm" className="border-border/70 bg-background/70 shadow-none">
              <CardHeader>
                <CardDescription>Отменённые заказы</CardDescription>
                <CardTitle className="text-3xl">{cancellationLosses.cancelled_orders}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm" className="border-border/70 bg-background/70 shadow-none">
              <CardHeader>
                <CardDescription>Сумма отмен</CardDescription>
                <CardTitle className="text-3xl">{formatCurrencyKzt(cancellationLosses.cancelled_amount)}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm" className="border-border/70 bg-background/70 shadow-none">
              <CardHeader>
                <CardDescription>Отмены после оплаты</CardDescription>
                <CardTitle className="text-3xl">{cancellationLosses.cancelled_after_payment_count}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm" className="border-border/70 bg-background/70 shadow-none">
              <CardHeader>
                <CardDescription>Потенциальный возврат</CardDescription>
                <CardTitle className="text-3xl">{formatCurrencyKzt(cancellationLosses.potential_refund_amount)}</CardTitle>
              </CardHeader>
            </Card>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Выручка по сегментам</CardTitle>
          <CardDescription>
            Сегменты показывают, где сосредоточена валовая выручка и сколько из неё уже оплачено.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сегмент</TableHead>
                <TableHead>Заказы</TableHead>
                <TableHead>GMV</TableHead>
                <TableHead>Оплачено</TableHead>
                <TableHead>Доля</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segmentRevenue.length ? segmentRevenue.map((row) => (
                <TableRow key={row.segment}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>{row.orders}</TableCell>
                  <TableCell>{formatCurrencyKzt(row.gmv)}</TableCell>
                  <TableCell>
                    {data.has_reliable_payment_data ? formatCurrencyKzt(row.paid_amount) : "нет данных"}
                  </TableCell>
                  <TableCell>{row.share_of_revenue.toFixed(1)}%</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    По текущему фильтру сегментов нет.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Финансовые исключения</CardTitle>
          <CardDescription>
            Только заказы, где нужна бухгалтерская проверка: неоплата, частичная оплата, возврат или отмена после оплаты.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Оплачено</TableHead>
                <TableHead>Остаток</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Статус оплаты</TableHead>
                <TableHead>Дата оплаты</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountingExceptions.length ? accountingExceptions.map((row) => (
                <TableRow key={row.retailcrm_id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span>{row.crm_number}</span>
                      <span className="text-xs text-muted-foreground">{row.issue_label}</span>
                    </div>
                  </TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell>{formatCurrencyKzt(row.total_amount)}</TableCell>
                  <TableCell>{formatCurrencyKzt(row.paid_amount)}</TableCell>
                  <TableCell>{formatCurrencyKzt(row.outstanding_amount)}</TableCell>
                  <TableCell>{row.status_label}</TableCell>
                  <TableCell>{formatPaymentStatusLabel(row.payment_status)}</TableCell>
                  <TableCell>
                    {row.payment_paid_at ? formatOrderDateTime(row.payment_paid_at) : "нет данных"}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    {row.manager_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={row.manager_url} target="_blank" rel="noreferrer">
                          <SearchIcon data-icon="inline-start" />
                          Детали
                        </a>
                      </Button>
                    ) : null}
                    {row.retailcrm_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={row.retailcrm_url} target="_blank" rel="noreferrer">
                          <ExternalLinkIcon data-icon="inline-start" />
                          CRM
                        </a>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    {data.has_reliable_payment_data
                      ? "По текущему фильтру финансовых исключений нет."
                      : "Финансовые исключения появятся после загрузки оплат из RetailCRM."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
