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
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">{caption}</p>
          <h2>{title}</h2>
        </div>
        <p className="panel-caption">{description}</p>
      </div>

      {rows.length ? (
        <div className="ops-grid">
          {rows.map((row) => (
            <OpsOrderCard key={`${row.retailcrm_id}-${row.crm_number}`} order={row} />
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <p>{emptyText}</p>
        </div>
      )}
    </section>
  );
}

