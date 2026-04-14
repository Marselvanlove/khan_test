import { cookies } from "next/headers";
import { DashboardTabsShell } from "@/components/dashboard-tabs-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const data = await getDashboardData();
  const summaryVisibleCookie = cookieStore.get("dashboard-summary-visible")?.value;
  const isSummaryVisible = summaryVisibleCookie !== "0";

  return (
    <main className="mx-auto flex min-h-screen max-w-[1480px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <section>
        <h1 className="max-w-5xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Дашборд заказов Tomyris
        </h1>
      </section>

      {!data.ok ? (
        <Card className="border-destructive/20 bg-card/90 shadow-sm">
          <CardHeader>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-destructive">
              Query failed
            </p>
            <CardTitle>{data.message}</CardTitle>
            <CardDescription>
              Проверь `Supabase`, локальные env vars и миграции. После этого экран снова наполнится
              данными.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <DashboardTabsShell
          summary={data.summary}
          ownerMetrics={data.ownerMetrics}
          adminSettings={data.adminSettings}
          initialVisible={isSummaryVisible}
          graphsData={data.graphsData}
          allOrders={data.allOrders}
          operationsData={data.operationsData}
          marketingData={data.marketingData}
          financeData={data.financeData}
          notificationOverview={data.notificationOverview}
          notificationLogs={data.notificationLogs}
          orderEvents={data.orderEvents}
          syncHealth={data.syncHealth}
        />
      )}
    </main>
  );
}
