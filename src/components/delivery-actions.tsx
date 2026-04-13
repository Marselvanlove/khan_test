"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, PackageCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { OperationalOrderRow } from "@/shared/types";
import type { OrderStatusAction } from "@/shared/orders";

interface DeliveryActionsProps {
  url: string | null;
  retailcrmId: number;
  statusCode: string | null;
  statusGroup: string;
  onOrderUpdated?: (order: OperationalOrderRow) => void;
}

interface ActionResponse {
  ok?: boolean;
  error?: string;
  changed?: boolean;
  order?: OperationalOrderRow;
}

export function DeliveryActions({
  url,
  retailcrmId,
  statusCode,
  statusGroup,
  onOrderUpdated,
}: DeliveryActionsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<OrderStatusAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const handoffDisabled =
    !url || isPending || pendingAction !== null || statusGroup === "complete" || statusGroup === "cancel";
  const completeDisabled =
    isPending || pendingAction !== null || statusGroup === "complete" || statusGroup === "cancel";

  function syncOrder(order: OperationalOrderRow | undefined) {
    if (order && onOrderUpdated) {
      onOrderUpdated(order);
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function runAction(action: OrderStatusAction) {
    const response = await fetch(`/api/orders/${retailcrmId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json().catch(() => null)) as ActionResponse | null;

    if (!response.ok || !payload?.ok || !payload.order) {
      throw new Error(payload?.error ?? "Не удалось обновить заказ.");
    }

    return payload;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={handoffDisabled}
        onClick={() => {
          if (!url) {
            toast.error("APP_BASE_URL не задан, логистическую ссылку пока нельзя собрать.");
            return;
          }

          setPendingAction("handoff");
          startTransition(() => {
            void runAction("handoff")
              .then(async (payload) => {
                let copiedSuccessfully = false;

                try {
                  await navigator.clipboard.writeText(url);
                  copiedSuccessfully = true;
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  copiedSuccessfully = false;
                }

                syncOrder(payload.order);

                if (copiedSuccessfully) {
                  toast.success(
                    payload.changed
                      ? "Ссылка скопирована, заказ передан курьеру."
                      : "Ссылка скопирована. Заказ уже в доставке.",
                  );
                  return;
                }

                toast.error(
                  payload.changed
                    ? "Заказ переведён в доставку, но ссылку не удалось скопировать."
                    : "Не удалось скопировать ссылку.",
                );
              })
              .catch((error) => {
                toast.error(error instanceof Error ? error.message : "Не удалось передать заказ курьеру.");
              })
              .finally(() => {
                setPendingAction(null);
              });
          });
        }}
      >
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {pendingAction === "handoff" ? "Передаём..." : "Передать курьеру"}
      </Button>

      <Button
        variant="outline"
        disabled={completeDisabled}
        onClick={() => {
          setPendingAction("complete");
          startTransition(() => {
            void runAction("complete")
              .then((payload) => {
                syncOrder(payload.order);
                toast.success(
                  payload.changed ? "Заказ переведён в выполненные." : "Заказ уже завершён.",
                );
              })
              .catch((error) => {
                toast.error(error instanceof Error ? error.message : "Не удалось завершить заказ.");
              })
              .finally(() => {
                setPendingAction(null);
              });
          });
        }}
      >
        <PackageCheckIcon data-icon="inline-start" />
        {statusCode === "complete"
          ? "Сделка завершена"
          : pendingAction === "complete"
            ? "Завершаем..."
            : "Завершить сделку"}
      </Button>
    </div>
  );
}
