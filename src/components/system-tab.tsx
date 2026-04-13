import { AdminSettingsPanel } from "@/components/admin-settings-panel";
import { NotificationLogList } from "@/components/notification-log-list";
import type { AdminSettings, NotificationLogItem, NotificationOverview } from "@/shared/types";

interface SystemTabProps {
  settings: AdminSettings;
  overview: NotificationOverview;
  notificationLogs: NotificationLogItem[];
}

export function SystemTab({ settings, overview, notificationLogs }: SystemTabProps) {
  return (
    <div className="grid gap-6">
      <AdminSettingsPanel settings={settings} overview={overview} />
      <NotificationLogList rows={notificationLogs} />
    </div>
  );
}
