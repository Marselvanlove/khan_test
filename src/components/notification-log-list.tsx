import { formatOrderDate } from "@/shared/orders";
import type { NotificationLogItem } from "@/shared/types";

interface NotificationLogListProps {
  rows: NotificationLogItem[];
}

export function NotificationLogList({ rows }: NotificationLogListProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">Audit Log</p>
          <h2>Лог уведомлений</h2>
        </div>
        <p className="panel-caption">
          Нужен, чтобы видеть rate limit, retries и факт доставки уведомления менеджеру.
        </p>
      </div>

      {rows.length ? (
        <div className="log-list">
          {rows.map((row) => (
            <article className="log-item" key={`${row.order_retailcrm_id}-${row.created_at}-${row.attempt}`}>
              <p>
                <code>{row.order_number ?? row.order_retailcrm_id}</code> · {row.status}
              </p>
              <p>
                Попытка {row.attempt} · {row.rate_limited ? "rate limit" : "без rate limit"}
              </p>
              <p>{formatOrderDate(row.created_at)}</p>
              {row.error_message ? <p>{row.error_message}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <p>Лог уведомлений появится после применения второй миграции для `notification_logs`.</p>
        </div>
      )}
    </section>
  );
}
