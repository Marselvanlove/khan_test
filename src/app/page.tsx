import { cookies } from "next/headers";
import { DashboardTabsShell } from "@/components/dashboard-tabs-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard";
import { verifySignedManagerLink } from "@/shared/order-links";

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isDashboardTab(value: string | null): value is "graphs" | "operations" | "marketing" | "finance" | "system" {
  return value === "graphs" || value === "operations" || value === "marketing" || value === "finance" || value === "system";
}

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const query = await searchParams;
  const data = await getDashboardData();
  const summaryVisibleCookie = cookieStore.get("dashboard-summary-visible")?.value;
  const isSummaryVisible = summaryVisibleCookie !== "0";
  const requestedTab = readQueryValue(query.tab);
  const requestedOrderRaw = readQueryValue(query.order);
  const requestedOrderId = requestedOrderRaw ? Number(requestedOrderRaw) : Number.NaN;
  const signature = readQueryValue(query.sig);
  const expiresAt = Number(readQueryValue(query.exp) ?? 0);
  const initialSelectedOrderId = Number.isFinite(requestedOrderId) ? requestedOrderId : null;
  const linkSecret = process.env.LINK_SIGNING_SECRET?.trim() ?? null;
  const manageAccess =
    initialSelectedOrderId != null &&
    linkSecret &&
    signature &&
    (await verifySignedManagerLink({
      retailcrmId: initialSelectedOrderId,
      secret: linkSecret,
      expiresAt,
      signature,
    }))
      ? {
          manager_signature: signature,
          manager_expires_at: expiresAt,
        }
      : null;
  const initialTab = isDashboardTab(requestedTab)
    ? requestedTab
    : initialSelectedOrderId != null
      ? "operations"
      : "graphs";

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
          initialTab={initialTab}
          selectedOrderId={initialSelectedOrderId}
          manageAccess={manageAccess}
        />
      )}
    </main>
  );
}
