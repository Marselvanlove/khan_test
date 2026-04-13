import { headers } from "next/headers";
import { ExternalLinkIcon, MessageCircleIcon } from "lucide-react";
import { AddressMapChooser } from "@/components/address-map-chooser";
import { DeliveryActions } from "@/components/delivery-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { resolveAppBaseUrl, loadOrderPresentation } from "@/lib/orders-server";
import { buildSignedLogisticsLink, verifySignedManagerLink } from "@/shared/order-links";
import {
  extractOrderAddress,
  extractOrderEmail,
  extractOrderItemDetails,
  extractOrderPhone,
  formatCurrencyKzt,
  formatOrderDateTime,
  formatOrderItemUnitLine,
  toNumber,
} from "@/shared/orders";

export const dynamic = "force-dynamic";

function readQueryValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function readPaymentSummary(rawOrder: Record<string, unknown>) {
  const payments = Array.isArray(rawOrder.payments)
    ? rawOrder.payments.filter((payment): payment is Record<string, unknown> => Boolean(payment))
    : [];

  return payments.map((payment, index) => ({
    id: String(payment.id ?? `payment-${index + 1}`),
    type: String(payment.type ?? payment.paymentType ?? "Платёж"),
    status: String(payment.status ?? "unknown"),
    amount: toNumber(
      (payment.amount as number | string | null | undefined) ??
        (payment.paidAmount as number | string | null | undefined) ??
        (payment.sum as number | string | null | undefined) ??
        0,
    ),
    paidAt: payment.paidAt ? String(payment.paidAt) : null,
  }));
}

function readCustomFields(rawOrder: Record<string, unknown>) {
  const customFields =
    rawOrder.customFields && typeof rawOrder.customFields === "object"
      ? rawOrder.customFields
      : {};

  return Object.entries(customFields)
    .filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
}

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      <Card className="border-destructive/20 bg-card/90">
        <CardHeader>
          <CardTitle>Ссылка недействительна</CardTitle>
          <CardDescription>
            Проверь подпись ссылки или сгенерируй новую карточку заказа из уведомления.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ retailcrmId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { retailcrmId } = await params;
  const query = await searchParams;
  const retailcrmIdNumber = Number(retailcrmId);
  const linkSecret = process.env.LINK_SIGNING_SECRET?.trim() ?? null;
  const signature = readQueryValue(query.sig);
  const expiresAt = Number(readQueryValue(query.exp) ?? 0);

  if (
    !Number.isFinite(retailcrmIdNumber) ||
    !linkSecret ||
    !signature ||
    !(await verifySignedManagerLink({
      retailcrmId: retailcrmIdNumber,
      secret: linkSecret,
      expiresAt,
      signature,
    }))
  ) {
    return <AccessDenied />;
  }

  const requestHeaders = await headers();
  const baseUrl = resolveAppBaseUrl(requestHeaders);
  const { adminSettings, order, rawOrder, snapshotRow, source } = await loadOrderPresentation(
    retailcrmIdNumber,
    { baseUrl },
  );
  const logisticsUrl = linkSecret
    ? (
        await buildSignedLogisticsLink({
          retailcrmId: retailcrmIdNumber,
          secret: linkSecret,
          baseUrl,
        })
      ).url
    : null;
  const items = extractOrderItemDetails(rawOrder);
  const phone = extractOrderPhone(rawOrder, order.phone);
  const email = extractOrderEmail(rawOrder, order.email);
  const address = extractOrderAddress(rawOrder) ?? order.address;
  const payments = readPaymentSummary(rawOrder as Record<string, unknown>);
  const customFields = readCustomFields(rawOrder as Record<string, unknown>);
  const customerComment =
    typeof rawOrder.customerComment === "string" ? rawOrder.customerComment : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-[1180px] flex-col gap-6 px-4 py-8 md:px-6">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  Заказ <code>{order.crm_number}</code>
                </Badge>
                <Badge variant="outline">{order.status_label}</Badge>
                <Badge variant="outline">{source === "retailcrm" ? "RetailCRM live" : "Supabase snapshot"}</Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold">{order.customer_name}</CardTitle>
                <CardDescription className="text-base leading-7">
                  Полная карточка сделки для менеджера, сборщика и курьера без перехода в RetailCRM.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <p className="text-3xl font-semibold italic text-foreground">
                {formatCurrencyKzt(order.total_amount)}
              </p>
              <div className="flex flex-wrap gap-2">
                <DeliveryActions
                  url={logisticsUrl}
                  retailcrmId={order.retailcrm_id}
                  statusCode={order.status_code}
                  statusGroup={order.status_group}
                />
                {order.whatsapp_url ? (
                  <Button asChild variant="outline">
                    <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
                      <MessageCircleIcon data-icon="inline-start" />
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
                {order.retailcrm_url ? (
                  <Button asChild variant="outline">
                    <a href={order.retailcrm_url} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon data-icon="inline-start" />
                      RetailCRM
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Клиент</CardTitle>
            <CardDescription>Контакты и адрес, которые менеджер может сразу передать дальше.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="grid gap-2">
              <p><strong>ФИО:</strong> {order.customer_name}</p>
              <p><strong>Телефон:</strong> {phone ?? "не указан"}</p>
              <p><strong>Email:</strong> {email ?? "не указан"}</p>
              <p><strong>Источник:</strong> {order.source_label}</p>
              <p><strong>Дата:</strong> {formatOrderDateTime(order.created_at, adminSettings.timezone)}</p>
            </div>
            <Separator />
            <div className="grid gap-2">
              <p className="font-medium">Доставка</p>
              <AddressMapChooser address={address} city={order.city} />
              {customerComment ? (
                <p className="text-muted-foreground">
                  <strong>Комментарий:</strong> {customerComment}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Служебное</CardTitle>
            <CardDescription>Идентификаторы и рабочий контекст сделки.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><strong>RetailCRM ID:</strong> {order.retailcrm_id}</p>
            <p><strong>External ID:</strong> {order.external_id ?? "не указан"}</p>
            <p><strong>Статус:</strong> {order.status_label}</p>
            <p><strong>SLA:</strong> {order.sla_label}</p>
            <p><strong>Сегмент:</strong> {order.segment_label}</p>
            <p><strong>Последний snapshot:</strong> {formatOrderDateTime(String(snapshotRow.updated_at ?? order.created_at), adminSettings.timezone)}</p>
            <p><strong>Таймзона:</strong> {adminSettings.timezone}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Товары</CardTitle>
            <CardDescription>Состав заказа для передачи в сборку и доставку.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {items.map((item) => (
                <div
                  key={`${order.crm_number}-${item.name}-${item.quantity}`}
                  className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm"
                >
                  <p className="font-medium">{formatOrderItemUnitLine(item)}</p>
                  <p className="text-muted-foreground">Итого: {formatCurrencyKzt(item.total_price)}</p>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Оплата</CardTitle>
            <CardDescription>Платежи и суммы из RetailCRM.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {payments.length ? (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm"
                >
                  <p className="font-medium">{payment.type}</p>
                  <p className="text-muted-foreground">Статус: {payment.status}</p>
                  <p className="text-muted-foreground">Сумма: {formatCurrencyKzt(payment.amount)}</p>
                  {payment.paidAt ? (
                    <p className="text-muted-foreground">
                      Дата оплаты: {formatOrderDateTime(payment.paidAt, adminSettings.timezone)}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Платежи в заказе не найдены.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Пользовательские поля</CardTitle>
            <CardDescription>Срез custom fields из RetailCRM.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {customFields.length ? (
              customFields.map((field) => (
                <div key={field.key} className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                  <p className="font-medium">{field.key}</p>
                  <p className="text-muted-foreground break-all">{field.value}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Пользовательские поля не заполнены.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Raw RetailCRM payload</CardTitle>
            <CardDescription>Полный payload для спорных случаев и ручной передачи.</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="group rounded-xl border border-border/70 bg-background/70 p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Показать JSON заказа
              </summary>
              <pre className="mt-4 overflow-x-auto text-xs leading-6 text-muted-foreground">
                {JSON.stringify(rawOrder, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
