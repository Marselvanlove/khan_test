"use client";

import { startTransition, useState } from "react";
import { BellIcon, Clock3Icon, Settings2Icon } from "lucide-react";
import { updateAdminSettings } from "@/app/actions";
import { getAlertTypeLabel, TIMEZONE_OPTIONS } from "@/shared/admin-settings";
import type { AdminSettings, NotificationOverview } from "@/shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface AdminSettingsPanelProps {
  settings: AdminSettings;
  overview: NotificationOverview;
}

const HOURS = Array.from({ length: 25 }, (_, index) => index);

function formatHourOption(value: number): string {
  return `${String(value).padStart(2, "0")}:00`;
}

function boolToFormData(formData: FormData, key: string, value: boolean) {
  if (value) {
    formData.set(key, "on");
  }
}

export function AdminSettingsPanel({ settings, overview }: AdminSettingsPanelProps) {
  const [state, setState] = useState(settings);
  const [pending, setPending] = useState(false);
  const activeLabels = overview.activeAlerts.map((type) => getAlertTypeLabel(type));

  async function handleSubmit() {
    const formData = new FormData();

    boolToFormData(formData, "notifications_enabled", state.notifications_enabled);
    boolToFormData(formData, "high_value_enabled", state.high_value_enabled);
    boolToFormData(formData, "missing_contact_enabled", state.missing_contact_enabled);
    boolToFormData(formData, "unknown_source_enabled", state.unknown_source_enabled);
    boolToFormData(formData, "cancelled_enabled", state.cancelled_enabled);
    boolToFormData(formData, "working_hours_enabled", state.working_hours_enabled);

    formData.set("high_value_threshold", String(state.high_value_threshold));
    formData.set("workday_start_hour", String(state.workday_start_hour));
    formData.set("workday_end_hour", String(state.workday_end_hour));
    formData.set("timezone", state.timezone);

    setPending(true);
    startTransition(async () => {
      try {
        await updateAdminSettings(formData);
        toast.success("Настройки уведомлений сохранены");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось сохранить настройки";
        toast.error(message);
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              Система
            </p>
            <CardTitle className="text-2xl">Настройки уведомлений</CardTitle>
            <CardDescription>
              Управление правилами отправки: порог суммы, рабочее окно, часовой пояс и
              дополнительные операционные сигналы.
            </CardDescription>
          </div>
          <Settings2Icon className="size-5 text-primary" />
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="grid gap-5">
          <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Главный переключатель</p>
                <p className="text-sm text-muted-foreground">
                  Полностью включает или выключает исходящие уведомления бота.
                </p>
              </div>
              <Switch
                checked={state.notifications_enabled}
                onCheckedChange={(checked) =>
                  setState((prev) => ({ ...prev, notifications_enabled: checked }))
                }
                disabled={pending}
              />
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-5">
            <div className="space-y-1">
              <p className="font-medium">Триггеры</p>
              <p className="text-sm text-muted-foreground">
                Что именно бот должен присылать менеджеру или владельцу.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Крупные заказы</p>
                  <p className="text-sm text-muted-foreground">Сигнал по high-value корзинам.</p>
                </div>
                <Switch
                  checked={state.high_value_enabled}
                  onCheckedChange={(checked) =>
                    setState((prev) => ({ ...prev, high_value_enabled: checked }))
                  }
                  disabled={pending}
                />
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Порог суммы, ₸</span>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={String(state.high_value_threshold)}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      high_value_threshold: Number(event.target.value || 0),
                    }))
                  }
                  disabled={pending}
                />
              </label>

              {[
                ["missing_contact_enabled", "Нет телефона или email", "Операционный риск для менеджера"],
                ["unknown_source_enabled", "Потерян источник", "Маркетинговая атрибуция сломана"],
                ["cancelled_enabled", "Отменённые заказы", "Контроль потерь и причин отмен"],
              ].map(([key, title, hint]) => (
                <div className="flex items-center justify-between gap-4" key={key}>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{hint}</p>
                  </div>
                  <Switch
                    checked={state[key as keyof AdminSettings] as boolean}
                    onCheckedChange={(checked) =>
                      setState((prev) => ({ ...prev, [key]: checked }))
                    }
                    disabled={pending}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">Рабочее окно</p>
                <p className="text-sm text-muted-foreground">
                  Ограничивает шум в нерабочее время и не перегружает менеджеров.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    suppressHydrationWarning
                    className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
                  >
                    <Clock3Icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Сейчас система ориентируется на локальное рабочее окно и выбранный часовой пояс.
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Учитывать рабочие часы</p>
                <p className="text-sm text-muted-foreground">
                  Если выключить, бот будет слать уведомления круглосуточно.
                </p>
              </div>
              <Switch
                checked={state.working_hours_enabled}
                onCheckedChange={(checked) =>
                  setState((prev) => ({ ...prev, working_hours_enabled: checked }))
                }
                disabled={pending}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <span className="text-sm font-medium">С</span>
                <Select
                  value={String(state.workday_start_hour)}
                  onValueChange={(value) =>
                    setState((prev) => ({ ...prev, workday_start_hour: Number(value) }))
                  }
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.slice(0, 24).map((hour) => (
                      <SelectItem key={`start-${hour}`} value={String(hour)}>
                        {formatHourOption(hour)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">До</span>
                <Select
                  value={String(state.workday_end_hour)}
                  onValueChange={(value) =>
                    setState((prev) => ({ ...prev, workday_end_hour: Number(value) }))
                  }
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.slice(1).map((hour) => (
                      <SelectItem key={`end-${hour}`} value={String(hour)}>
                        {formatHourOption(hour)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">Часовой пояс</span>
                <Select
                  value={state.timezone}
                  onValueChange={(value) =>
                    setState((prev) => ({ ...prev, timezone: value }))
                  }
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Сохраняю..." : "Сохранить настройки"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="border-border/70 bg-background/80 shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BellIcon className="size-4 text-primary" />
                <CardTitle className="text-lg">Сейчас</CardTitle>
              </div>
              <CardDescription>{overview.scheduleLabel}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Badge variant={overview.windowOpen ? "secondary" : "destructive"} className="w-fit">
                {overview.windowOpen ? "Окно отправки открыто" : "Сейчас вне рабочего окна"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                В очереди {overview.pendingOrders} заказов и {overview.pendingEvents} событий.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Активные правила</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {activeLabels.length ? (
                activeLabels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)
              ) : (
                <p className="text-sm text-muted-foreground">Нет активных триггеров.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/80 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Что ещё держать в системе</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>SLA первого ответа менеджера по новым и крупным заказам.</p>
              <p>Причины отмен и доля отмен по источникам трафика.</p>
              <p>Повторные покупки и LTV по клиентам и городам.</p>
              <p>План-факт по выручке за день и неделю.</p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
