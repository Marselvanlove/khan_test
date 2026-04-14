import type { NotificationLogItem } from "./types";

function buildNotificationLogKey(row: NotificationLogItem) {
  return [
    row.order_retailcrm_id,
    row.event_type,
    row.channel,
    row.recipient ?? "",
  ].join(":");
}

export function buildNotificationLogFeed(
  logs: NotificationLogItem[],
  limit = logs.length,
) {
  const finalizedLogKeys = new Set<string>();
  const visibleLogs: NotificationLogItem[] = [];

  for (const row of logs) {
    const key = buildNotificationLogKey(row);
    const isFinalStatus = row.status === "sent" || row.status === "failed";

    if (isFinalStatus) {
      finalizedLogKeys.add(key);
      visibleLogs.push(row);
    } else if (!(row.status === "rate_limited" && finalizedLogKeys.has(key))) {
      visibleLogs.push(row);
    }

    if (visibleLogs.length >= limit) {
      break;
    }
  }

  return visibleLogs;
}
