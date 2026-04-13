import { formatCurrencyKzt, formatOrderDate } from "@/shared/orders";
import type { DashboardOrderRow } from "@/shared/types";

interface OrdersTableProps {
  title: string;
  caption: string;
  rows: DashboardOrderRow[];
}

export function OrdersTable({ title, caption, rows }: OrdersTableProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">{caption}</p>
          <h2>{title}</h2>
        </div>
      </div>

      {rows.length ? (
        <div className="table-scroll">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Заказ</th>
                <th>Клиент</th>
                <th>Город</th>
                <th>Дата</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.retailcrm_id}-${row.created_at}`}>
                  <td>{row.external_id ?? row.retailcrm_id}</td>
                  <td>{row.customer_name}</td>
                  <td>{row.city ?? "Не указан"}</td>
                  <td>{formatOrderDate(row.created_at)}</td>
                  <td>{formatCurrencyKzt(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-panel">
          <p>Данных пока нет.</p>
        </div>
      )}
    </section>
  );
}

