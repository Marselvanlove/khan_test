"use client";

import { useEffect, useState, useTransition } from "react";
import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, MessageCircleIcon, PencilIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { AddressMapChooser } from "@/components/address-map-chooser";
import { DeliveryActions } from "@/components/delivery-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCurrencyKzt,
  formatOrderDateTime,
  formatOrderItemUnitLine,
  getKnownStatusOptions,
  splitCustomerName,
} from "@/shared/orders";
import type { OperationalOrderRow, OrderWriteAccessPayload } from "@/shared/types";
import { cn } from "@/lib/utils";

interface OpsOrderCardProps {
  order: OperationalOrderRow;
  variant?: "queue" | "kanban";
  onOrderUpdated?: (order: OperationalOrderRow) => void;
  onRequestStatusChange?: () => void;
  manageAccess?: OrderWriteAccessPayload | null;
}

interface EditableOrderState {
  customer_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  status_code: string;
  customer_comment: string;
}

const STATUS_OPTIONS = getKnownStatusOptions();

function toEditableState(order: OperationalOrderRow): EditableOrderState {
  const splitName = splitCustomerName(order.customer_name);

  return {
    customer_name: order.customer_name,
    first_name: order.first_name ?? splitName.firstName,
    last_name: order.last_name ?? splitName.lastName,
    phone: order.phone ?? "",
    email: order.email ?? "",
    city: order.city ?? "",
    address: order.address ?? "",
    status_code: order.status_code ?? "new",
    customer_comment: order.customer_comment ?? "",
  };
}

function LinkButton({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href) {
    return null;
  }

  return (
    <Button asChild size="sm" variant="outline" className="min-w-0">
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    </Button>
  );
}

function syncOrderState(
  nextOrder: OperationalOrderRow,
  setOrder: React.Dispatch<React.SetStateAction<OperationalOrderRow>>,
  setDraft: React.Dispatch<React.SetStateAction<EditableOrderState>>,
) {
  setOrder(nextOrder);
  setDraft(toEditableState(nextOrder));
}

export function OpsOrderCard({
  order: initialOrder,
  variant = "queue",
  onOrderUpdated,
  onRequestStatusChange,
  manageAccess = null,
}: OpsOrderCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [order, setOrder] = useState(initialOrder);
  const [draft, setDraft] = useState<EditableOrderState>(() => toEditableState(initialOrder));
  const [isPending, startUiTransition] = useTransition();
  const isKanban = variant === "kanban";
  const canManage = Boolean(manageAccess);

  useEffect(() => {
    setOrder(initialOrder);
    setDraft(toEditableState(initialOrder));
  }, [initialOrder]);

  function applyOrderUpdate(nextOrder: OperationalOrderRow) {
    syncOrderState(nextOrder, setOrder, setDraft);
    onOrderUpdated?.(nextOrder);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          setIsEditing(false);
          setDraft(toEditableState(order));
        }
      }}
    >
      <Card className={cn("border-border/70 bg-card/90 shadow-sm", isKanban && "w-full overflow-hidden")}>
        {isKanban ? (
          <>
            <CardContent className="grid gap-3 p-4">
              <SheetTrigger asChild>
                <button type="button" className="grid w-full gap-3 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                        <code>{order.crm_number}</code>
                      </p>
                      <CardTitle className="break-words text-base font-semibold">{order.customer_name}</CardTitle>
                    </div>
                    <p className="shrink-0 text-right text-sm font-semibold italic text-foreground">
                      {formatCurrencyKzt(order.total_amount)}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {formatOrderDateTime(order.created_at)}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="max-w-full break-words whitespace-normal">
                      {order.status_label}
                    </Badge>
                    {order.sync_state === "missing_in_retailcrm" ? (
                      <Badge variant="destructive" className="max-w-full break-words whitespace-normal">
                        Нет в RetailCRM
                      </Badge>
                    ) : null}
                    {order.alert_reasons.slice(0, 2).map((reason) => (
                      <Badge
                        key={`${order.crm_number}-${reason}`}
                        variant="destructive"
                        className="max-w-full break-words whitespace-normal"
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </button>
              </SheetTrigger>

              <div className="grid gap-2 overflow-hidden">
                {order.items.slice(0, 2).map((item) => (
                  <p
                    key={`${order.crm_number}-${item.name}`}
                    className="line-clamp-2 break-words text-xs leading-5 text-foreground/80"
                  >
                    {formatOrderItemUnitLine(item)}
                  </p>
                ))}
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-2 border-t border-border/70 px-4 py-3">
              {canManage ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-w-0"
                  onClick={() => onRequestStatusChange?.()}
                >
                  Сменить статус
                </Button>
              ) : null}
              <LinkButton href={order.whatsapp_url}>
                <MessageCircleIcon data-icon="inline-start" />
                WhatsApp
              </LinkButton>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                    <code>{order.crm_number}</code>
                  </p>
                  <CardTitle className="text-xl font-semibold">{order.customer_name}</CardTitle>
                </div>
                <p className="text-right text-lg font-semibold italic text-foreground">
                  {formatCurrencyKzt(order.total_amount)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{order.segment_label}</Badge>
                <Badge variant="outline">{order.status_label}</Badge>
                <Badge>{order.sla_label}</Badge>
                <Badge variant={order.unknown_source ? "destructive" : "outline"}>
                  {order.source_label}
                </Badge>
                {order.alert_reasons.map((reason) => (
                  <Badge key={`${order.crm_number}-${reason}`} variant="destructive">
                    {reason}
                  </Badge>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-2 text-muted-foreground">
                <p><strong>Телефон:</strong> {order.phone ?? "не указан"}</p>
                <p><strong>Email:</strong> {order.email ?? "не указан"}</p>
                <div className="flex flex-col gap-1">
                  <span><strong>Адрес:</strong></span>
                  <AddressMapChooser address={order.address} city={order.city} compact />
                </div>
                <p><strong>Дата:</strong> {formatOrderDateTime(order.created_at)}</p>
                <p>
                  <strong>Первая реакция:</strong>{" "}
                  {order.first_touch_at
                    ? `${formatOrderDateTime(order.first_touch_at)}${
                        order.first_touch_minutes == null ? "" : ` (${order.first_touch_minutes} мин)`
                      }`
                    : "ещё не зафиксирована"}
                </p>
                <p>
                  <strong>Sync:</strong>{" "}
                  {order.sync_state === "missing_in_retailcrm" ? "нет в RetailCRM" : "synced"}
                </p>
              </div>

              <Separator />

              <div className="grid gap-2">
                {order.items.slice(0, 2).map((item) => (
                  <p
                    key={`${order.crm_number}-${item.name}`}
                    className="text-sm leading-6 text-foreground/80"
                  >
                    {formatOrderItemUnitLine(item)}
                  </p>
                ))}
                {order.items.length > 2 ? (
                  <p className="text-xs text-muted-foreground">Ещё {order.items.length - 2} позиций</p>
                ) : null}
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-2">
              <SheetTrigger asChild>
                <Button size="sm">Детали</Button>
              </SheetTrigger>
              <LinkButton href={order.whatsapp_url}>
                <MessageCircleIcon data-icon="inline-start" />
                WhatsApp
              </LinkButton>
              <LinkButton href={order.retailcrm_url}>
                <ExternalLinkIcon data-icon="inline-start" />
                RetailCRM
              </LinkButton>
            </CardFooter>
          </>
        )}
      </Card>

      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Редактирование заказа " : "Заказ "}
            <code>{order.crm_number}</code>
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Правки применяются в RetailCRM и сразу обновляют локальный snapshot."
              : canManage
                ? "Быстрый боковой просмотр заказа. Из этого же окна можно перейти в режим редактирования."
                : "Быстрый боковой просмотр заказа. Публичный dashboard остаётся read-only, без прямых правок CRM."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-9rem)] px-4">
          {!isEditing ? (
            <div className="grid gap-5 pb-8">
              <div className="grid gap-2">
                <p className="text-lg font-semibold">{order.customer_name}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{order.segment_label}</Badge>
                  <Badge variant="outline">{order.status_label}</Badge>
                  <Badge>{order.sla_label}</Badge>
                  <Badge variant={order.unknown_source ? "destructive" : "outline"}>
                    {order.source_label}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <p><strong>Сумма:</strong> <i>{formatCurrencyKzt(order.total_amount)}</i></p>
                <p><strong>Дата:</strong> {formatOrderDateTime(order.created_at)}</p>
                <p><strong>Телефон:</strong> {order.phone ?? "не указан"}</p>
                <p><strong>Email:</strong> {order.email ?? "не указан"}</p>
                <div className="grid gap-1">
                  <span><strong>Адрес:</strong></span>
                  <AddressMapChooser address={order.address} city={order.city} />
                </div>
                {order.customer_comment ? (
                  <p><strong>Комментарий:</strong> {order.customer_comment}</p>
                ) : null}
              </div>

              <Separator />

              <div className="grid gap-3">
                <p className="text-sm font-medium text-foreground">Состав заказа</p>
                {order.items.map((item) => (
                  <div
                    key={`${order.crm_number}-${item.name}`}
                    className="rounded-lg border border-border/70 bg-background/70 px-3 py-3 text-sm"
                  >
                    <p>{formatOrderItemUnitLine(item)}</p>
                    <p className="text-muted-foreground">
                      Итого по позиции: {formatCurrencyKzt(item.total_price)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <Button
                    onClick={() => {
                      setDraft(toEditableState(order));
                      setIsEditing(true);
                    }}
                  >
                    <PencilIcon data-icon="inline-start" />
                    Редактировать
                  </Button>
                ) : null}
                {canManage ? (
                  <DeliveryActions
                    url={order.logistics_url}
                    retailcrmId={order.retailcrm_id}
                    statusCode={order.status_code}
                    statusGroup={order.status_group}
                    onOrderUpdated={applyOrderUpdate}
                    access={manageAccess}
                  />
                ) : null}
                <LinkButton href={order.whatsapp_url}>
                  <MessageCircleIcon data-icon="inline-start" />
                  Написать в WhatsApp
                </LinkButton>
                <LinkButton href={order.retailcrm_url}>
                  <ExternalLinkIcon data-icon="inline-start" />
                  Открыть в RetailCRM
                </LinkButton>
              </div>
            </div>
          ) : (
            <form
              className="grid gap-5 pb-8"
              onSubmit={(event) => {
                event.preventDefault();

                startUiTransition(() => {
                  void fetch(`/api/orders/${order.retailcrm_id}`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      ...draft,
                      access: manageAccess,
                    }),
                  })
                    .then(async (response) => {
                      const payload = (await response.json().catch(() => null)) as
                        | { ok?: boolean; error?: string; order?: OperationalOrderRow }
                        | null;

                      if (!response.ok || !payload?.ok || !payload.order) {
                        throw new Error(payload?.error ?? "Не удалось сохранить заказ.");
                      }

                      applyOrderUpdate(payload.order);
                      setIsEditing(false);
                      toast.success("Изменения сохранены.");
                      startTransition(() => {
                        router.refresh();
                      });
                    })
                    .catch((error) => {
                      toast.error(error instanceof Error ? error.message : "Ошибка сохранения.");
                    });
                });
              }}
            >
              <div className="grid gap-2">
                <p className="text-lg font-semibold">{order.customer_name}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{order.segment_label}</Badge>
                  <Badge variant="outline">{order.status_label}</Badge>
                  <Badge>{order.sla_label}</Badge>
                  <Badge variant={order.unknown_source ? "destructive" : "outline"}>
                    {order.source_label}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span>Имя</span>
                  <Input
                    value={draft.first_name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, first_name: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Фамилия</span>
                  <Input
                    value={draft.last_name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, last_name: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Телефон</span>
                  <Input
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Email</span>
                  <Input
                    value={draft.email}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Город</span>
                  <Input
                    value={draft.city}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, city: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Статус</span>
                  <Select
                    value={draft.status_code}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, status_code: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выбери статус" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.code} value={status.code}>
                          {status.label} · {status.group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <label className="grid gap-2 text-sm">
                <span>Адрес</span>
                <Textarea
                  value={draft.address}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, address: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span>Комментарий</span>
                <Textarea
                  value={draft.customer_comment}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, customer_comment: event.target.value }))
                  }
                />
              </label>

              <div className="grid gap-3 text-sm">
                <p><strong>Сумма:</strong> <i>{formatCurrencyKzt(order.total_amount)}</i></p>
                <p><strong>Дата:</strong> {formatOrderDateTime(order.created_at)}</p>
                <div className="grid gap-1">
                  <span><strong>Адрес для просмотра:</strong></span>
                  <AddressMapChooser
                    address={draft.address || order.address}
                    city={draft.city || order.city}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-3">
                <p className="text-sm font-medium text-foreground">Состав заказа</p>
                {order.items.map((item) => (
                  <div
                    key={`${order.crm_number}-${item.name}`}
                    className="rounded-lg border border-border/70 bg-background/70 px-3 py-3 text-sm"
                  >
                    <p>{formatOrderItemUnitLine(item)}</p>
                    <p className="text-muted-foreground">
                      Итого по позиции: {formatCurrencyKzt(item.total_price)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isPending}>
                  <SaveIcon data-icon="inline-start" />
                  {isPending ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(toEditableState(order));
                    setIsEditing(false);
                  }}
                >
                  Отмена
                </Button>
                <DeliveryActions
                  url={order.logistics_url}
                  retailcrmId={order.retailcrm_id}
                  statusCode={order.status_code}
                  statusGroup={order.status_group}
                  onOrderUpdated={applyOrderUpdate}
                  access={manageAccess}
                />
                <LinkButton href={order.whatsapp_url}>
                  <MessageCircleIcon data-icon="inline-start" />
                  Написать в WhatsApp
                </LinkButton>
                <LinkButton href={order.retailcrm_url}>
                  <ExternalLinkIcon data-icon="inline-start" />
                  Открыть в RetailCRM
                </LinkButton>
              </div>
            </form>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
