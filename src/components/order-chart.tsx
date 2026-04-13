import type { DailyMetric } from "@/shared/types";

interface OrderChartProps {
  metrics: DailyMetric[];
}

export function OrderChart({ metrics }: OrderChartProps) {
  if (!metrics.length) {
    return (
      <div className="panel empty-panel">
        <p>Пока нет синхронизированных заказов. После первого `npm run sync:retailcrm` здесь появится график.</p>
      </div>
    );
  }

  const maxOrders = Math.max(...metrics.map((metric) => metric.orders_count), 1);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">Order Volume</p>
          <h2>Динамика заказов по дням</h2>
        </div>
        <p className="panel-caption">Гистограмма строится по `daily_order_metrics` в Supabase.</p>
      </div>

      <div className="chart-grid" role="img" aria-label="График количества заказов по дням">
        {metrics.map((metric) => {
          const height = `${Math.max((metric.orders_count / maxOrders) * 100, 6)}%`;

          return (
            <div className="chart-column" key={metric.order_date}>
              <div className="chart-value">{metric.orders_count}</div>
              <div className="chart-bar-shell">
                <div className="chart-bar" style={{ height }} />
              </div>
              <div className="chart-label">
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "2-digit",
                  month: "short",
                }).format(new Date(metric.order_date))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

