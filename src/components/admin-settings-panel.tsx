import { updateAdminSettings } from "@/app/actions";
import { getAlertTypeLabel, TIMEZONE_OPTIONS } from "@/shared/admin-settings";
import type { AdminSettings, NotificationOverview } from "@/shared/types";

interface AdminSettingsPanelProps {
  settings: AdminSettings;
  overview: NotificationOverview;
}

const HOURS = Array.from({ length: 25 }, (_, index) => index);

function formatHourOption(value: number): string {
  return `${String(value).padStart(2, "0")}:00`;
}

export function AdminSettingsPanel({ settings, overview }: AdminSettingsPanelProps) {
  const activeLabels = overview.activeAlerts.map((type) => getAlertTypeLabel(type));

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-eyebrow">Admin Panel</p>
          <h2>Настройки уведомлений бота</h2>
        </div>
        <p className="panel-caption">
          Здесь управляются правила отправки: порог суммы, рабочее окно, часовой пояс и
          дополнительные операционные алерты.
        </p>
      </div>

      <div className="admin-grid">
        <form action={updateAdminSettings} className="settings-form">
          <label className="settings-toggle">
            <input
              type="checkbox"
              name="notifications_enabled"
              defaultChecked={settings.notifications_enabled}
            />
            <span>Включить отправку уведомлений</span>
          </label>

          <div className="settings-section">
            <div className="settings-section-heading">
              <h3>Триггеры</h3>
              <p>Какие события бот должен отправлять владельцу или менеджеру.</p>
            </div>

            <label className="settings-toggle">
              <input
                type="checkbox"
                name="high_value_enabled"
                defaultChecked={settings.high_value_enabled}
              />
              <span>Крупные заказы по сумме</span>
            </label>

            <label className="settings-field">
              <span>Порог суммы заказа, ₸</span>
              <input
                type="number"
                min="0"
                step="1000"
                name="high_value_threshold"
                defaultValue={String(settings.high_value_threshold)}
              />
            </label>

            <label className="settings-toggle">
              <input
                type="checkbox"
                name="missing_contact_enabled"
                defaultChecked={settings.missing_contact_enabled}
              />
              <span>Нет телефона или email</span>
            </label>

            <label className="settings-toggle">
              <input
                type="checkbox"
                name="unknown_source_enabled"
                defaultChecked={settings.unknown_source_enabled}
              />
              <span>Потерян `utm_source`</span>
            </label>

            <label className="settings-toggle">
              <input
                type="checkbox"
                name="cancelled_enabled"
                defaultChecked={settings.cancelled_enabled}
              />
              <span>Отменённые заказы</span>
            </label>
          </div>

          <div className="settings-section">
            <div className="settings-section-heading">
              <h3>Рабочее окно</h3>
              <p>По умолчанию уведомления уходят по времени Алматы, с 10:00 до 19:00.</p>
            </div>

            <label className="settings-toggle">
              <input
                type="checkbox"
                name="working_hours_enabled"
                defaultChecked={settings.working_hours_enabled}
              />
              <span>Ограничивать отправку по рабочему графику</span>
            </label>

            <div className="settings-inline-grid">
              <label className="settings-field">
                <span>С</span>
                <select name="workday_start_hour" defaultValue={String(settings.workday_start_hour)}>
                  {HOURS.slice(0, 24).map((hour) => (
                    <option key={`start-${hour}`} value={hour}>
                      {formatHourOption(hour)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span>До</span>
                <select name="workday_end_hour" defaultValue={String(settings.workday_end_hour)}>
                  {HOURS.slice(1).map((hour) => (
                    <option key={`end-${hour}`} value={hour}>
                      {formatHourOption(hour)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="settings-field">
              <span>Часовой пояс</span>
              <select name="timezone" defaultValue={settings.timezone}>
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="settings-submit" type="submit">
            Сохранить настройки
          </button>
        </form>

        <aside className="settings-summary">
          <div className="settings-summary-card">
            <p className="panel-eyebrow">Сейчас</p>
            <h3>{overview.windowOpen ? "Окно отправки открыто" : "Сейчас вне окна отправки"}</h3>
            <p>{overview.scheduleLabel}</p>
          </div>

          <div className="settings-summary-card">
            <p className="panel-eyebrow">Активные правила</p>
            <h3>{activeLabels.length ? activeLabels.join(", ") : "Нет активных триггеров"}</h3>
            <p>
              В очереди сейчас {overview.pendingOrders} заказов и {overview.pendingEvents} событий.
            </p>
          </div>

          <div className="settings-summary-card">
            <p className="panel-eyebrow">Что ещё держать в админке</p>
            <ul className="insight-list compact-list">
              <li>SLA первого ответа менеджера по новым и крупным заказам.</li>
              <li>Причины отмен и доля отмен по источникам трафика.</li>
              <li>Повторные покупки и LTV по клиентам и городам.</li>
              <li>План-факт по выручке за день и неделе.</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
