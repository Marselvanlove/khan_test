"use client";

import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import {
  ActivityIcon,
  BarChart3Icon,
  CircleDollarSignIcon,
  MenuIcon,
  Settings2Icon,
  WorkflowIcon,
} from "lucide-react";
import { FinanceTab } from "@/components/finance-tab";
import { GraphsTab } from "@/components/graphs-tab";
import { MarketingTab } from "@/components/marketing-tab";
import { OperationsTab } from "@/components/operations-tab";
import { SummaryToggleSection } from "@/components/summary-toggle-section";
import { SystemTab } from "@/components/system-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AdminSettings,
  DashboardSummary,
  FinanceTabData,
  GraphsData,
  MarketingTabData,
  NotificationLogItem,
  NotificationOverview,
  OrderEventItem,
  OperationsTabData,
  OperationalOrderRow,
  OwnerMetrics,
  SyncHealthOverview,
} from "@/shared/types";

type DashboardTabValue = "graphs" | "operations" | "marketing" | "finance" | "system";

const TAB_ITEMS = [
  { value: "graphs", label: "Графики", icon: ActivityIcon },
  { value: "operations", label: "Операции", icon: WorkflowIcon },
  { value: "marketing", label: "Маркетинг", icon: BarChart3Icon },
  { value: "finance", label: "Финансы", icon: CircleDollarSignIcon },
  { value: "system", label: "Система", icon: Settings2Icon },
] as const satisfies ReadonlyArray<{
  value: DashboardTabValue;
  label: string;
  icon: ComponentType<{ className?: string }>;
}>;

interface DashboardTabsShellProps {
  summary: DashboardSummary;
  ownerMetrics: OwnerMetrics;
  adminSettings: AdminSettings;
  initialVisible: boolean;
  graphsData: GraphsData;
  allOrders: OperationalOrderRow[];
  operationsData: OperationsTabData;
  marketingData: MarketingTabData;
  financeData: FinanceTabData;
  notificationOverview: NotificationOverview;
  notificationLogs: NotificationLogItem[];
  orderEvents: OrderEventItem[];
  syncHealth: SyncHealthOverview;
}

export function DashboardTabsShell({
  summary,
  ownerMetrics,
  adminSettings,
  initialVisible,
  graphsData,
  allOrders,
  operationsData,
  marketingData,
  financeData,
  notificationOverview,
  notificationLogs,
  orderEvents,
  syncHealth,
}: DashboardTabsShellProps) {
  const [activeTab, setActiveTab] = useState<DashboardTabValue>("graphs");
  const [menuOpen, setMenuOpen] = useState(false);

  const activeTabItem = useMemo(
    () => TAB_ITEMS.find((item) => item.value === activeTab) ?? TAB_ITEMS[0],
    [activeTab],
  );

  function handleTabChange(nextValue: DashboardTabValue) {
    setActiveTab(nextValue);
    setMenuOpen(false);
  }

  const ActiveTabIcon = activeTabItem.icon;

  return (
    <>
      <SummaryToggleSection
        summary={summary}
        ownerMetrics={ownerMetrics}
        adminSettings={adminSettings}
        initialVisible={initialVisible}
      />

      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as DashboardTabValue)} className="gap-6">
        <Card className="sticky top-3 z-20 border-border/70 bg-card/85 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-md md:py-6">
          <CardContent className="flex flex-col gap-3 py-0 md:gap-4 md:py-4">
            <Separator className="hidden md:block" />

            <div className="flex items-center justify-between gap-3 md:hidden">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/8 text-primary">
                  <ActiveTabIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary/75">
                    Раздел
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">{activeTabItem.label}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 rounded-full border-border/70 bg-background/80 px-4"
                onClick={() => setMenuOpen(true)}
              >
                <MenuIcon className="size-4" />
                Меню
              </Button>
            </div>

            <TabsList
              className="hidden w-full grid-cols-2 gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid md:grid-cols-3 lg:grid-cols-5"
              variant="line"
            >
              {TAB_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="h-auto min-h-11 w-full justify-start gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 data-active:border-primary/40 data-active:bg-card"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </CardContent>
        </Card>

        <TabsContent value="graphs">
          <GraphsTab
            data={graphsData}
            orders={allOrders}
            highValueThreshold={adminSettings.high_value_threshold}
          />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsTab data={operationsData} />
        </TabsContent>

        <TabsContent value="marketing">
          <MarketingTab data={marketingData} />
        </TabsContent>

        <TabsContent value="finance">
          <FinanceTab data={financeData} />
        </TabsContent>

        <TabsContent value="system">
          <SystemTab
            settings={adminSettings}
            overview={notificationOverview}
            notificationLogs={notificationLogs}
            orderEvents={orderEvents}
            syncHealth={syncHealth}
          />
        </TabsContent>
      </Tabs>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="top" className="rounded-b-3xl border-border/70 bg-card/95 pt-14 pb-6 md:hidden">
          <SheetHeader className="px-4 pt-0 pb-2">
            <SheetTitle>Разделы дашборда</SheetTitle>
            <SheetDescription>
              Выберите нужный раздел и закройте меню, не перекрывая половину экрана.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 px-4">
            {TAB_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.value === activeTab;

              return (
                <Button
                  key={item.value}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  className="min-h-12 justify-start rounded-2xl"
                  onClick={() => handleTabChange(item.value)}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
