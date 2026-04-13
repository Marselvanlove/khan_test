import type { StatusSummaryItem } from "@/shared/types";

interface StatusBreakdownProps {
  rows: StatusSummaryItem[];
}

export function StatusBreakdown({ rows }: StatusBreakdownProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">Status Flow</p>
          <h2>Срез по статусным группам</h2>
        </div>
        <p className="panel-caption">
          Помогает увидеть, где заказы застревают: новые, согласование, доставка, отмены.
        </p>
      </div>

      {rows.length ? (
        <div className="status-grid">
          {rows.map((row) => (
            <article className="status-card" key={row.group}>
              <p className="status-count">{row.count}</p>
              <p className="status-label">{row.label}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <p>Статусы пока не загружены.</p>
        </div>
      )}
    </section>
  );
}
