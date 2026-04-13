import { OrderChart } from "@/components/order-chart";
import { NotificationLogList } from "@/components/notification-log-list";
import { OrderQueue } from "@/components/order-queue";
import { SourceBreakdown } from "@/components/source-breakdown";
import { StatCard } from "@/components/stat-card";
import { StatusBreakdown } from "@/components/status-breakdown";
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
              eyebrow="Всего заказов"
              value={String(data.summary.totalOrders)}
              hint="Все заказы, подтянутые из RetailCRM."
            />
            <StatCard
              eyebrow="Выручка"
              value={formatCurrencyKzt(data.summary.totalRevenue)}
              hint="Суммарная выручка по всем заказам."
            />
            <StatCard
              eyebrow="Крупные 50k+"
              value={String(data.summary.highValueOrders)}
              hint="Заказы с суммой выше 50 000 ₸."
              tone="accent"
            />
            <StatCard
              eyebrow="Порог 35k+"
              value={String(data.summary.freeShippingOrders)}
              hint="Заказы, которые уже дотягивают до бесплатной доставки."
            />
            <StatCard
              eyebrow="Premium 60k+"
              value={String(data.summary.premiumExpressOrders)}
              hint="Премиум-сегмент, где можно дать бесплатный экспресс."
            />
            <StatCard
              eyebrow="Неизвестный источник"
              value={String(data.summary.unknownSourceOrders)}
              hint="Заказы, где маркетинг теряет атрибуцию."
            />
            <StatCard
              eyebrow="Без контакта"
              value={String(data.summary.ordersWithoutContact)}
              hint="Заказы без телефона и email. Это оперативный риск."
            />
          </section>

          <OrderChart metrics={data.metrics} />

          <section className="grid-2">
            <SourceBreakdown
              rows={data.sourceMetrics}
              title="Источники всех заказов"
              caption="Источники"
              description="Весь поток заказов по каналам. Нужен владельцу и маркетингу."
            />
            <StatusBreakdown rows={data.statusSummary} />
          </section>

          <NotificationLogList rows={data.notificationLogs} />

          <section className="grid-2">
            <SourceBreakdown
              rows={data.highValueSourceMetrics}
              title="Источники крупных заказов"
              caption="Крупные источники"
              description="Показывает, какие каналы приводят дорогую корзину."
            />
            <OrderQueue
              title="Последние заказы"
              caption="Лента"
              description="Короткая лента для менеджера: кого брать в работу первым."
              rows={data.recentOrders}
              emptyText="Последних заказов пока нет."
            />
          </section>

          <OrderQueue
            title="Очередь крупных заказов"
            caption="Приоритет"
            description="Главная очередь для менеджера: клиент, товары, адрес, канал и быстрые действия."
            rows={data.highValueOrders.slice(0, 8)}
            emptyText="Крупных заказов выше 50 000 ₸ сейчас нет."
          />

          <section className="grid-2">
            <OrderQueue
              title="Апселл до high-value"
              caption="Апселл"
              description="Клиенты уже близко к порогу. Здесь менеджер может увеличить средний чек."
              rows={data.upsellOrders.slice(0, 6)}
              emptyText="Кандидатов на апселл сейчас нет."
            />
            <OrderQueue
              title="Premium / Express"
              caption="Premium"
              description="Премиальный сегмент. Здесь важны скорость реакции и качество сервиса."
              rows={data.premiumOrders.slice(0, 6)}
              emptyText="Премиальных заказов сейчас нет."
            />
          </section>

          <section className="grid-2">
            <OrderQueue
              title="Заказы без контакта"
              caption="Риск"
              description="Операционный риск: менеджер не сможет быстро связаться с клиентом."
              rows={data.ordersWithoutContact.slice(0, 6)}
              emptyText="Во всех заказах есть телефон или email."
            />
            <OrderQueue
              title="Потерянная атрибуция"
              caption="Маркетинг"
              description="Сюда попадают заказы без понятного источника. Это дыра в маркетинговой аналитике."
              rows={data.unknownSourceOrders.slice(0, 6)}
              emptyText="Во всех заказах источник определён."
            />
          </section>
        </>
      )}
    </main>
  );
}
