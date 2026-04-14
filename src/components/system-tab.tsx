import { AdminSettingsPanel } from "@/components/admin-settings-panel";
import { NotificationLogList } from "@/components/notification-log-list";
import { OrderEventList } from "@/components/order-event-list";
import { SyncHealthPanel } from "@/components/sync-health-panel";
import type {
  AdminSettings,
  NotificationLogItem,
  NotificationOverview,
  OrderEventItem,
  SyncHealthOverview,
} from "@/shared/types";

interface SystemTabProps {
  settings: AdminSettings;
  overview: NotificationOverview;
  notificationLogs: NotificationLogItem[];
  orderEvents: OrderEventItem[];
  syncHealth: SyncHealthOverview;
}

export function SystemTab({
  settings,
  overview,
  notificationLogs,
  orderEvents,
  syncHealth,
}: SystemTabProps) {
  return (
    <div className="grid gap-6">
      <AdminSettingsPanel settings={settings} overview={overview} editable={false} />
      <SyncHealthPanel overview={syncHealth} />
      <OrderEventList rows={orderEvents} />
      <NotificationLogList rows={notificationLogs} />
    </div>
  );
}
