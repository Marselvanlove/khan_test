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
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">{caption}</p>
          <h2>{title}</h2>
        </div>
        <p className="panel-caption">{description}</p>
      </div>

      {rows.length ? (
        <div className="source-list">
          {rows.slice(0, 6).map((row) => (
            <div className="source-item" key={row.source}>
              <div>
                <p className="source-name">{row.source}</p>
                <p className="source-meta">{row.orders} заказов</p>
              </div>
              <p className="source-revenue">{formatCurrencyKzt(row.revenue)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <p>После синка здесь появится разбивка по каналам.</p>
        </div>
      )}
    </section>
  );
}
