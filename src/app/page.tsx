import { ActivityIcon, BarChart3Icon, CircleDollarSignIcon, Settings2Icon, WorkflowIcon } from "lucide-react";
import { cookies } from "next/headers";
import { FinanceTab } from "@/components/finance-tab";
import { GraphsTab } from "@/components/graphs-tab";
import { MarketingTab } from "@/components/marketing-tab";
import { OperationsTab } from "@/components/operations-tab";
import { SummaryToggleSection } from "@/components/summary-toggle-section";
import { SystemTab } from "@/components/system-tab";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        <>
          <SummaryToggleSection
            summary={data.summary}
            ownerMetrics={data.ownerMetrics}
            adminSettings={data.adminSettings}
            initialVisible={isSummaryVisible}
          />

          <Tabs defaultValue="graphs" className="gap-6">
            <Card className="sticky top-3 z-20 border-border/70 bg-card/85 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
              <CardContent className="flex flex-col gap-4 py-4">
                <Separator />
                <TabsList
                  className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-3 lg:grid-cols-5"
                  variant="line"
                >
                  <TabsTrigger value="graphs" className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 data-active:border-primary/40 data-active:bg-card">
                    <ActivityIcon className="size-4" />
                    Графики
                  </TabsTrigger>
                  <TabsTrigger value="operations" className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 data-active:border-primary/40 data-active:bg-card">
                    <WorkflowIcon className="size-4" />
                    Операции
                  </TabsTrigger>
                  <TabsTrigger value="marketing" className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 data-active:border-primary/40 data-active:bg-card">
                    <BarChart3Icon className="size-4" />
                    Маркетинг
                  </TabsTrigger>
                  <TabsTrigger value="finance" className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 data-active:border-primary/40 data-active:bg-card">
                    <CircleDollarSignIcon className="size-4" />
                    Финансы
                  </TabsTrigger>
                  <TabsTrigger value="system" className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 data-active:border-primary/40 data-active:bg-card">
                    <Settings2Icon className="size-4" />
                    Система
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>

            <TabsContent value="graphs">
              <GraphsTab
                data={data.graphsData}
                orders={data.allOrders}
                highValueThreshold={data.adminSettings.high_value_threshold}
              />
            </TabsContent>

            <TabsContent value="operations">
              <OperationsTab
                data={data.operationsData}
              />
            </TabsContent>

            <TabsContent value="marketing">
              <MarketingTab data={data.marketingData} />
            </TabsContent>

            <TabsContent value="finance">
              <FinanceTab data={data.financeData} />
            </TabsContent>

            <TabsContent value="system">
              <SystemTab
                settings={data.adminSettings}
                overview={data.notificationOverview}
                notificationLogs={data.notificationLogs}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  );
}
