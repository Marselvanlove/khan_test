import {
  formatCurrencyKzt,
  formatOrderDate,
} from "@/shared/orders";
import type { OperationalOrderRow } from "@/shared/types";

interface OpsOrderCardProps {
  order: OperationalOrderRow;
}

export function OpsOrderCard({ order }: OpsOrderCardProps) {
  return (
    <article className="ops-card">
      <div className="ops-card-header">
        <div>
          <p className="ops-order-number">
            <code>{order.crm_number}</code>
          </p>
          <p className="ops-customer-name">
            <strong>{order.customer_name}</strong>
          </p>
        </div>
        <p className="ops-amount">
          <i>{formatCurrencyKzt(order.total_amount)}</i>
        </p>
      </div>

      <div className="ops-badges">
        <span className="badge">{order.segment_label}</span>
        <span className="badge">{order.status_label}</span>
        <span className="badge badge-accent">{order.sla_label}</span>
        <span className="badge">{order.source_label}</span>
      </div>

      <div className="ops-meta">
        {order.whatsapp_url ? (
          <p>
            Телефон: <a href={order.whatsapp_url} target="_blank" rel="noreferrer">{order.phone}</a>
          </p>
        ) : order.phone ? (
          <p>Телефон: {order.phone}</p>
        ) : (
          <p>Телефон: не указан</p>
        )}

        {order.email ? <p>Email: {order.email}</p> : <p>Email: не указан</p>}
        {order.address ? <p>Адрес: {order.address}</p> : <p>Адрес: не указан</p>}
        <p>Дата: {formatOrderDate(order.created_at)}</p>
      </div>

      <div className="ops-items">
        {order.items.length ? (
          order.items.map((item) => (
            <p key={`${order.crm_number}-${item.name}`}>
              «{item.name}» ×{item.quantity}
            </p>
          ))
        ) : (
          <p>Товары не указаны</p>
        )}
      </div>

      <div className="ops-actions">
        {order.retailcrm_url ? (
          <a href={order.retailcrm_url} target="_blank" rel="noreferrer">
            Открыть в RetailCRM
          </a>
        ) : null}
        {order.whatsapp_url ? (
          <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
            Написать в WhatsApp
          </a>
        ) : null}
      </div>
    </article>
  );
}

