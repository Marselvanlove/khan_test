import { headers } from "next/headers";
import { MessageCircleIcon } from "lucide-react";
import { AddressMapChooser } from "@/components/address-map-chooser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyLogisticsToken } from "@/shared/order-links";
import {
  extractOrderAddress,
  extractOrderItemDetails,
  extractOrderPhone,
  formatCurrencyKzt,
  formatOrderDateTime,
  formatOrderItemUnitLine,
} from "@/shared/orders";
import { loadOrderPresentation, resolveAppBaseUrl } from "@/lib/orders-server";

export const dynamic = "force-dynamic";

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 md:px-6">
      <Card className="border-destructive/20 bg-card/90">
        <CardHeader>
          <CardTitle>Логистическая ссылка недействительна</CardTitle>
          <CardDescription>
            Сгенерируйте новую ссылку из менеджерской карточки заказа.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

export default async function LogisticsOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ retailcrmId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { retailcrmId } = await params;
  const query = await searchParams;
  const token = readQueryValue(query.token);
  const retailcrmIdNumber = Number(retailcrmId);
  const linkSecret = process.env.LINK_SIGNING_SECRET?.trim() ?? null;

  if (
    !Number.isFinite(retailcrmIdNumber) ||
    !token ||
    !linkSecret ||
    !(await verifyLogisticsToken({
      retailcrmId: retailcrmIdNumber,
      secret: linkSecret,
      token,
    }))
  ) {
    return <AccessDenied />;
  }

  const requestHeaders = await headers();
  const { adminSettings, order, rawOrder } = await loadOrderPresentation(retailcrmIdNumber, {
    baseUrl: resolveAppBaseUrl(requestHeaders),
  });
  const items = extractOrderItemDetails(rawOrder);
  const address = extractOrderAddress(rawOrder) ?? order.address;
  const phone = extractOrderPhone(rawOrder, order.phone);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 md:px-6">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              Заказ <code>{order.crm_number}</code>
            </Badge>
            <Badge variant="outline">{order.status_label}</Badge>
          </div>
          <CardTitle className="text-3xl font-semibold">{order.customer_name}</CardTitle>
          <CardDescription className="text-base leading-7">
            Логистическая карточка для сборщика и курьера: товары, адрес, контакт и сумма.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Контакты и доставка</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p><strong>ФИО:</strong> {order.customer_name}</p>
            <p><strong>Телефон:</strong> {phone ?? "не указан"}</p>
            <p><strong>Дата:</strong> {formatOrderDateTime(order.created_at, adminSettings.timezone)}</p>
            <p><strong>Сумма:</strong> <i>{formatCurrencyKzt(order.total_amount)}</i></p>
            <AddressMapChooser address={address} city={order.city} />
            {order.whatsapp_url ? (
              <Button asChild variant="outline" className="justify-start">
                <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
                  <MessageCircleIcon data-icon="inline-start" />
                  Написать в WhatsApp
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Товары к сборке</CardTitle>
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
      </div>
    </main>
  );
}
