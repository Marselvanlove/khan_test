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
import type { OperationalOrderRow } from "@/shared/types";

interface OpsOrderCardProps {
  order: OperationalOrderRow;
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
    <Button asChild size="sm" variant="outline">
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

export function OpsOrderCard({ order: initialOrder }: OpsOrderCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [order, setOrder] = useState(initialOrder);
  const [draft, setDraft] = useState<EditableOrderState>(() => toEditableState(initialOrder));
  const [isPending, startUiTransition] = useTransition();

  useEffect(() => {
    setOrder(initialOrder);
    setDraft(toEditableState(initialOrder));
  }, [initialOrder]);

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
      <Card className="border-border/70 bg-card/90 shadow-sm">
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
              : "Быстрый боковой просмотр заказа. Из этого же окна можно перейти в режим редактирования."}
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
                <Button
                  onClick={() => {
                    setDraft(toEditableState(order));
                    setIsEditing(true);
                  }}
                >
                  <PencilIcon data-icon="inline-start" />
                  Редактировать
                </Button>
                <DeliveryActions
                  url={order.logistics_url}
                  retailcrmId={order.retailcrm_id}
                  statusCode={order.status_code}
                  statusGroup={order.status_group}
                  onOrderUpdated={(nextOrder) => syncOrderState(nextOrder, setOrder, setDraft)}
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
                    body: JSON.stringify(draft),
                  })
                    .then(async (response) => {
                      const payload = (await response.json().catch(() => null)) as
                        | { ok?: boolean; error?: string; order?: OperationalOrderRow }
                        | null;

                      if (!response.ok || !payload?.ok || !payload.order) {
                        throw new Error(payload?.error ?? "Не удалось сохранить заказ.");
                      }

                      setOrder(payload.order);
                      setDraft(toEditableState(payload.order));
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
                  onOrderUpdated={(nextOrder) => syncOrderState(nextOrder, setOrder, setDraft)}
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
