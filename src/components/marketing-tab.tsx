"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyKzt, formatOrderDate } from "@/shared/orders";
import type { MarketingGeoRow, MarketingKpiItem, MarketingOrderFact, MarketingSourceRow, MarketingTabData } from "@/shared/types";

interface MarketingTabProps {
  data: MarketingTabData;
}

type PeriodValue = "all" | "7d" | "14d" | "28d";
type FilterValue = "all" | string;

function isHighValue(order: MarketingOrderFact): boolean {
  return order.segment_code === "high-value" || order.segment_code === "premium-express";
}

function applyPeriodFilter<T extends { created_at: string }>(rows: T[], period: PeriodValue) {
  if (period === "all") {
    return rows;
  }

  const days = period === "7d" ? 7 : period === "14d" ? 14 : 28;
  const boundary = Date.now() - days * 24 * 60 * 60 * 1000;

  return rows.filter((row) => Date.parse(row.created_at) >= boundary);
}

function buildKpis(rows: MarketingOrderFact[]): MarketingKpiItem[] {
  const totalOrders = rows.length;
  const totalRevenue = rows.reduce((sum, row) => sum + row.total_amount, 0);
  const highValueOrders = rows.filter(isHighValue).length;
  const unknownSourceOrders = rows.filter((row) => row.unknown_source).length;
  const cancelledOrders = rows.filter((row) => row.status_group === "cancel").length;

  return [
    {
      key: "orders",
      label: "Заказы",
      value: totalOrders,
      hint: "Количество заказов в выбранном маркетинговом срезе.",
    },
    {
      key: "revenue",
      label: "Выручка",
      value: totalRevenue,
      hint: "Валовая выручка по выбранным каналам и географии.",
    },
    {
      key: "average-order-value",
      label: "Средний чек",
      value: totalOrders ? totalRevenue / totalOrders : 0,
      hint: "Показывает, какие каналы приводят качественную корзину.",
    },
    {
      key: "high-value-share",
      label: "Доля high-value",
      value: totalOrders ? (highValueOrders / totalOrders) * 100 : 0,
      hint: "Какой процент потока даёт дорогую корзину.",
    },
    {
      key: "unknown-source-rate",
      label: "Потеря атрибуции",
      value: totalOrders ? (unknownSourceOrders / totalOrders) * 100 : 0,
      hint: "Где маркетинг теряет атрибуцию заказа.",
    },
    {
      key: "cancel-rate",
      label: "Отмены по каналам",
      value: totalOrders ? (cancelledOrders / totalOrders) * 100 : 0,
      hint: "Помогает видеть качество лидов после привлечения, а не только верх воронки.",
    },
  ];
}

function buildSourceRows(rows: MarketingOrderFact[]): MarketingSourceRow[] {
  const summary = new Map<string, MarketingSourceRow>();

  for (const row of rows) {
    const current = summary.get(row.source_label) ?? {
      source: row.source_label,
      orders: 0,
      revenue: 0,
      average_order_value: 0,
      high_value_orders: 0,
      high_value_share: 0,
      cancel_rate: 0,
    };

    current.orders += 1;
    current.revenue += row.total_amount;

    if (isHighValue(row)) {
      current.high_value_orders += 1;
    }

    if (row.status_group === "cancel") {
      current.cancel_rate += 1;
    }

    summary.set(row.source_label, current);
  }

  return Array.from(summary.values())
    .map((row) => ({
      ...row,
      average_order_value: row.orders ? row.revenue / row.orders : 0,
      high_value_share: row.orders ? (row.high_value_orders / row.orders) * 100 : 0,
      cancel_rate: row.orders ? (row.cancel_rate / row.orders) * 100 : 0,
    }))
    .sort((left, right) => {
      if (right.orders !== left.orders) {
        return right.orders - left.orders;
      }

      return right.revenue - left.revenue;
    });
}

function buildGeoRows(rows: MarketingOrderFact[]): MarketingGeoRow[] {
  const summary = new Map<
    string,
    { city: string; orders: number; revenue: number; sources: Map<string, { orders: number; revenue: number }> }
  >();

  for (const row of rows) {
    const city = row.city?.trim() || "Не указан";
    const current = summary.get(city) ?? {
      city,
      orders: 0,
      revenue: 0,
      sources: new Map<string, { orders: number; revenue: number }>(),
    };
    const sourceStats = current.sources.get(row.source_label) ?? { orders: 0, revenue: 0 };

    current.orders += 1;
    current.revenue += row.total_amount;
    sourceStats.orders += 1;
    sourceStats.revenue += row.total_amount;
    current.sources.set(row.source_label, sourceStats);
    summary.set(city, current);
  }

  return Array.from(summary.values())
    .map((row) => {
      const topSource =
        Array.from(row.sources.entries()).sort((left, right) => {
          if (right[1].orders !== left[1].orders) {
            return right[1].orders - left[1].orders;
          }

          return right[1].revenue - left[1].revenue;
        })[0]?.[0] ?? "unknown source";

      return {
        city: row.city,
        orders: row.orders,
        revenue: row.revenue,
        top_source: topSource,
      };
    })
    .sort((left, right) => {
      if (right.orders !== left.orders) {
        return right.orders - left.orders;
      }

      return right.revenue - left.revenue;
    });
}

function formatKpiValue(item: MarketingKpiItem): string {
  if (item.key === "revenue" || item.key === "average-order-value") {
    return formatCurrencyKzt(item.value);
  }

  if (
    item.key === "high-value-share" ||
    item.key === "unknown-source-rate" ||
    item.key === "cancel-rate"
  ) {
    return `${item.value.toFixed(1)}%`;
  }

  return String(item.value);
}

export function MarketingTab({ data }: MarketingTabProps) {
  const [period, setPeriod] = useState<PeriodValue>("28d");
  const [source, setSource] = useState<FilterValue>("all");
  const [city, setCity] = useState<FilterValue>("all");

  const filteredFacts = useMemo(() => {
    let rows = applyPeriodFilter(data.facts, period);

    if (source !== "all") {
      rows = rows.filter((row) => row.source_label === source);
    }

    if (city !== "all") {
      rows = rows.filter((row) => (row.city?.trim() || "Не указан") === city);
    }

    return rows;
  }, [city, data.facts, period, source]);

  const attributionIssues = useMemo(() => {
    let rows = applyPeriodFilter(data.attributionIssues, period);

    if (city !== "all") {
      rows = rows.filter((row) => (row.city?.trim() || "Не указан") === city);
    }

    if (source !== "all" && source !== "unknown source") {
      return [];
    }

    return rows;
  }, [city, data.attributionIssues, period, source]);

  const kpis = useMemo(() => buildKpis(filteredFacts), [filteredFacts]);
  const sourceTable = useMemo(() => buildSourceRows(filteredFacts), [filteredFacts]);
  const highValueSources = useMemo(
    () => buildSourceRows(filteredFacts.filter(isHighValue)),
    [filteredFacts],
  );
  const geoBreakdown = useMemo(() => buildGeoRows(filteredFacts), [filteredFacts]);

  return (
    <div className="grid gap-6">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Маркетинговый срез</CardTitle>
          <CardDescription>
            Вкладка отвечает только за эффективность каналов и потери атрибуции. Текущий отчётный период: {data.report_period_label}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodValue)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Период" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Весь период</SelectItem>
              <SelectItem value="7d">Последние 7 дней</SelectItem>
              <SelectItem value="14d">Последние 14 дней</SelectItem>
              <SelectItem value="28d">Последние 28 дней</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Источник" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все источники</SelectItem>
              {data.sourceOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Город" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все города</SelectItem>
              <SelectItem value="Не указан">Не указан</SelectItem>
              {data.cityOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="lg:col-span-3 flex flex-wrap gap-2">
            <Badge variant="outline">Период: {period === "all" ? "весь" : period}</Badge>
            {source !== "all" ? <Badge variant="secondary">{source}</Badge> : null}
            {city !== "all" ? <Badge variant="secondary">{city}</Badge> : null}
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
            <CardTitle>Источники заказов</CardTitle>
            <CardDescription>
              Основной срез по каналам: объём, выручка, средний чек и качество корзины.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Источник</TableHead>
                  <TableHead>Заказы</TableHead>
                  <TableHead>Выручка</TableHead>
                  <TableHead>Ср. чек</TableHead>
                  <TableHead>Дорогая корзина</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceTable.length ? sourceTable.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell>
                      <Button variant="link" className="h-auto px-0" onClick={() => setSource(row.source)}>
                        {row.source}
                      </Button>
                    </TableCell>
                    <TableCell>{row.orders}</TableCell>
                    <TableCell>{formatCurrencyKzt(row.revenue)}</TableCell>
                    <TableCell>{formatCurrencyKzt(row.average_order_value)}</TableCell>
                    <TableCell>{row.high_value_orders} / {row.high_value_share.toFixed(1)}%</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      По текущему фильтру источников нет.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Источники дорогих заказов</CardTitle>
            <CardDescription>
              Какие каналы приводят дорогую корзину, а не просто дешёвый объём.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Источник</TableHead>
                  <TableHead>Крупные заказы</TableHead>
                  <TableHead>Выручка</TableHead>
                  <TableHead>Ср. чек</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highValueSources.length ? highValueSources.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell>
                      <Button variant="link" className="h-auto px-0" onClick={() => setSource(row.source)}>
                        {row.source}
                      </Button>
                    </TableCell>
                    <TableCell>{row.high_value_orders}</TableCell>
                    <TableCell>{formatCurrencyKzt(row.revenue)}</TableCell>
                    <TableCell>{formatCurrencyKzt(row.average_order_value)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      По текущему фильтру дорогих заказов нет.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>География каналов</CardTitle>
          <CardDescription>
            Где именно появляется спрос и какой источник доминирует в каждом городе.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Город</TableHead>
                <TableHead>Заказы</TableHead>
                <TableHead>Выручка</TableHead>
                <TableHead>Ведущий источник</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {geoBreakdown.length ? geoBreakdown.map((row) => (
                <TableRow key={row.city}>
                  <TableCell>
                    <Button variant="link" className="h-auto px-0" onClick={() => setCity(row.city)}>
                      {row.city}
                    </Button>
                  </TableCell>
                  <TableCell>{row.orders}</TableCell>
                  <TableCell>{formatCurrencyKzt(row.revenue)}</TableCell>
                  <TableCell>{row.top_source}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    По текущему фильтру географии нет.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Потерянная атрибуция</CardTitle>
          <CardDescription>
            Исключения, где маркетинг теряет источник и уже не может корректно читать канал.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Город</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attributionIssues.length ? attributionIssues.map((row) => (
                <TableRow key={row.retailcrm_id}>
                  <TableCell>{row.crm_number}</TableCell>
                  <TableCell>{formatOrderDate(row.created_at)}</TableCell>
                  <TableCell>{formatCurrencyKzt(row.total_amount)}</TableCell>
                  <TableCell>{row.city ?? "Не указан"}</TableCell>
                  <TableCell>{row.status_label}</TableCell>
                  <TableCell>{row.reason}</TableCell>
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
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    По текущему фильтру потерь атрибуции нет.
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
