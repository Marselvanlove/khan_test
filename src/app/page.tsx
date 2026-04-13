import { OrderChart } from "@/components/order-chart";
import { OrdersTable } from "@/components/orders-table";
import { SourceBreakdown } from "@/components/source-breakdown";
import { StatCard } from "@/components/stat-card";
import { formatCurrencyKzt } from "@/shared/orders";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">Tomyris • RetailCRM → Supabase → Vercel</p>
          <h1>Операционный дашборд заказов для Tomyris</h1>
          <p className="hero-text">
            Серверная витрина по заказам fashion e-commerce бренда из Казахстана: social-channel
            acquisition, пороги доставки `35 000 ₸` и `60 000 ₸`, плюс Telegram-алерты для заказов
            дороже 50&nbsp;000 ₸.
          </p>
        </div>
      </section>

      {!data.ok ? (
        <section className="panel empty-panel">
          <p className="panel-eyebrow">{data.reason === "missing-env" ? "Setup required" : "Query failed"}</p>
          <h2>{data.message}</h2>
          <p>
            Для наполнения дашборда нужны рабочие переменные окружения Supabase и выполненная
            миграция из каталога `supabase/migrations`.
          </p>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            <StatCard
              eyebrow="Total Orders"
              value={String(data.summary.totalOrders)}
              hint="Все заказы, подтянутые из RetailCRM."
            />
            <StatCard
              eyebrow="Total Revenue"
              value={formatCurrencyKzt(data.summary.totalRevenue)}
              hint="Суммарная выручка по всем заказам."
            />
            <StatCard
              eyebrow="High Value > 50k"
              value={String(data.summary.highValueOrders)}
              hint="Заказы с суммой выше 50 000 ₸."
              tone="accent"
            />
            <StatCard
              eyebrow="Free Shipping 35k+"
              value={String(data.summary.freeShippingOrders)}
              hint="Заказы, которые уже дотягивают до бесплатной доставки."
            />
            <StatCard
              eyebrow="Express 60k+"
              value={String(data.summary.premiumExpressOrders)}
              hint="Премиум-сегмент, где можно дать бесплатный экспресс."
            />
          </section>

          <OrderChart metrics={data.metrics} />

          <section className="grid-2">
            <SourceBreakdown rows={data.sourceMetrics} />
            <OrdersTable
              title="Последние заказы"
              caption="Recent Orders"
              rows={data.recentOrders}
            />
          </section>

          <section className="grid-2">
            <OrdersTable
              title="High-value заказы"
              caption="Alert Queue"
              rows={data.highValueOrders}
            />
            <section className="panel insight-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-eyebrow">Tomyris Fit</p>
                  <h2>Почему это решение подходит бренду</h2>
                </div>
              </div>
              <div className="insight-list">
                <p>Суммы оформлены в ₸ и учитывают реальные пороги доставки Tomyris.</p>
                <p>Источники заказов показывают вклад Instagram, direct, Google и referral.</p>
                <p>Alert на `50k+` закрывает ТЗ, а сегменты `35k+` и `60k+` дают бизнес-контекст.</p>
              </div>
            </section>
          </section>
        </>
      )}
    </main>
  );
}
