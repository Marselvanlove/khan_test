# GBC Analytics Dashboard for Tomyris

Мини-инструмент для команды продаж и логистики: проект забирает заказы из `RetailCRM`, сохраняет их в `Supabase`, показывает общую картину в дашборде и отправляет важные заказы в `Telegram`.

Если совсем просто:

- клиент сделал заказ
- заказ появился в `RetailCRM`
- проект подтянул его в `Supabase`
- дашборд показал, что происходит с заказами
- если заказ крупный, бот написал в `Telegram`
- менеджер может открыть заказ или завершить его

Проект сделан как тестовое задание на роль `AI Tools Specialist`, но по объёму это уже не один график, а компактный внутренний инструмент с UI, sync-логикой, уведомлениями, write-back в CRM и тестами.

## Что решает проект

Без такого инструмента менеджеру приходится вручную:

- заходить в `RetailCRM`
- искать заказ
- проверять сумму, товары, контакт и адрес
- отдельно отслеживать крупные заказы
- отдельно понимать, что уже обработано, а что нет

Что даёт этот проект:

- крупные и проблемные заказы видны сразу
- Telegram работает как быстрый рабочий интерфейс, а не просто как алерт
- дашборд даёт общую картину по заказам, финансам, источникам и состоянию синка
- изменения по заказу можно безопасно отправлять обратно в `RetailCRM`

## Что реализовано

- импорт demo-заказов из `mock_orders.json` в `RetailCRM`
- sync `RetailCRM -> Supabase` через локальный скрипт и `Supabase Edge Function`
- публичный дашборд с 5 вкладками: `Графики`, `Операции`, `Маркетинг`, `Финансы`, `Система`
- автообновление дашборда каждые `45` секунд
- Telegram-уведомления для заказов выше порога
- manager flow: открыть заказ, изменить данные, передать в доставку, завершить
- logistics flow: безопасная упрощённая карточка для курьера / сборщика
- `kanban` по статусам с проверкой допустимых переходов
- `notification log`, `event stream`, `sync health`, `reconciliation`
- настройки правил уведомлений и рабочего окна
- unit tests, route tests и e2e smoke test

## Как работает поток

1. Скрипт импорта кладёт demo-заказы в `RetailCRM`.
2. Sync читает заказы из `RetailCRM`.
3. Данные нормализуются и сохраняются в `Supabase`.
4. Дашборд читает snapshot-слой и строит UI.
5. Если заказ подходит под правило уведомления, бот отправляет сообщение в `Telegram`.
6. Менеджер может:
   - нажать `Открыть` и перейти в карточку заказа
   - нажать `Выполнено` и завершить заказ
7. Изменение статуса уходит обратно в `RetailCRM` и отражается в дашборде.

## Режимы доступа и безопасность

### 1. Публичный дашборд

- маршрут: `/`
- режим: `read-only`
- показывает сводку, очереди, аналитику, логи и состояние синка

### 2. Manager access

- маршрут: `/orders/[retailcrmId]?exp=...&sig=...`
- доступ по signed manager-link
- даёт право на рабочие действия по заказу

### 3. Logistics access

- маршрут: `/orders/[retailcrmId]/logistics?token=...`
- доступ по signed logistics-link
- показывает безопасную логистическую карточку

### 4. Private operator access

- доступ через `DASHBOARD_OPERATOR_TOKEN`
- нужен для server-side write-операций и изменения правил уведомлений

Дополнительная защита:

- Telegram webhook защищён через `TELEGRAM_WEBHOOK_SECRET`
- sync endpoint защищён через `SYNC_ENDPOINT_SECRET`
- параллельные sync-запуски блокируются advisory lock в `Supabase`

## Что видно в интерфейсе

### Главный экран

![Главный экран дашборда](docs/дашборд%20главная.jpg)

### Графики

- количество заказов
- выручка
- top products
- top cities
- сегменты заказов

![Вкладка графиков](docs/Графики.jpg)

### Операции

- KPI оператора
- очереди заказов
- поток high-value заказов
- проблемные заказы
- `kanban` по статусам

![Операции: список](docs/операции%201.jpg)
![Операции: kanban](docs/Операции%202%20кабан%20доска.jpg)

### Маркетинг

- источники заказов
- средний чек по источникам
- доля дорогих заказов
- потери атрибуции

![Вкладка маркетинга](docs/маркетинг.jpg)

### Финансы

- GMV
- оплачено / не оплачено
- частичные оплаты
- возвраты
- потери на отменах

![Вкладка финансов](docs/финансы.jpg)

### Профиль заказа

Менеджерская карточка показывает полный контекст заказа и даёт действия по нему.

![Профиль заказа](docs/Профиль%20заказа.jpg)

### Telegram

Сообщение в `Telegram` показывает:

- номер заказа
- имя клиента
- телефон
- товары
- сумму
- источник
- дату

Кнопки:

- `Открыть` — ведёт в manager flow, если доступен публичный URL
- `Выполнено` — переводит заказ в `complete`
- после подтверждения сообщение помечается как завершённое

![Telegram уведомления](docs/Уведомления.jpg)

## Стек и интеграции

### Стек приложения

- `Next.js 16`
- `React 19`
- `TypeScript`
- `App Router`
- `Tailwind CSS v4`
- `shadcn/ui`
- `Recharts`

### Внешние сервисы

- `RetailCRM API`
- `Supabase`
- `Supabase Edge Functions`
- `Telegram Bot API`

### Проверка и инструменты

- `node:test`
- `Playwright`
- `npm scripts`

## Какие данные хранятся в Supabase

- `orders` — snapshot заказа из `RetailCRM`
- `notification_logs` — журнал отправки уведомлений
- `telegram_message_states` — состояние сообщений в `Telegram`
- `order_events` — история событий по заказу
- `sync_runs` — журнал запусков синка
- `admin_settings` — правила уведомлений, пороги, рабочие часы и timezone

## Что было сложным и как решено

### 1. Не допустить дублей уведомлений

Проблема:
- при повторном sync или retry можно случайно отправить одно и то же уведомление несколько раз

Решение:
- введены `telegram_message_states`
- добавлен `notification log`
- учтён `rate limit` и retry-сценарии

### 2. Не запускать два sync одновременно

Проблема:
- параллельные sync-запуски ломают картину и могут дать дубли по событиям

Решение:
- добавлен advisory lock через `Supabase`
- каждый sync пишет состояние в `sync_runs`

### 3. Не открыть публичный write-доступ наружу

Проблема:
- read-only dashboard должен оставаться безопасным

Решение:
- изменение заказа разрешено только по signed manager-link или через `DASHBOARD_OPERATOR_TOKEN`
- логистическая карточка отделена и работает по отдельному токену

### 4. Удержать UI стабильным в реальном браузере

Проблема:
- браузерные расширения могут ломать hydration и давать шумные runtime-ошибки

Решение:
- добавлен scrubber расширенческих атрибутов
- добавлен `Playwright` smoke test на этот сценарий

## AI workflow, промпты и MCP

Проект делался в `AI-assisted` режиме. Ниже не маркетинг, а практический шаблон того, как такую задачу можно вести через AI-агент.

### Примеры рабочих промптов

1. `Предложи минимальную архитектуру для RetailCRM -> Supabase -> Dashboard -> Telegram с безопасным write-доступом.`
2. `Сделай idempotent импорт mock_orders.json в RetailCRM с детерминированным externalId.`
3. `Реализуй sync RetailCRM -> Supabase: нормализация, upsert, snapshot, events, reconciliation.`
4. `Добавь Telegram workflow для high-value заказов с кнопками Открыть и Выполнено.`
5. `Сделай manager flow, logistics flow и проверку signed links.`
6. `Добавь тесты на route handlers, Telegram workflow, status transitions и write access.`

### Что здесь можно утверждать честно

- в репозитории явно подтверждаются `RetailCRM API`, `Supabase`, `Telegram Bot API`, `Playwright`, `node:test`, `Next.js`, `React`
- в runtime-коде проекта нет явного использования `MCP`-протокола
- если при разработке использовались внешние MCP-серверы, это нужно дописать отдельно как факт процесса, а не как свойство runtime-проекта

Иными словами:

- `MCP` как часть кода приложения: **нет**
- AI-assisted workflow и prompt-driven разработка: **да**

## Что проверено

На момент последнего обновления README:

- `npm run typecheck`
- `npm test`
- `npm run build`

Что покрыто тестами:

- нормализация заказов
- правила уведомлений и timezone-логика
- signed links
- write access
- status transitions
- Telegram callback workflow
- smoke-проверка production-сборки

## Ограничения и честные рамки проекта

Это сильное тестовое решение, но не “большая платформа”.

Что пока не сделано:

- полноценная auth-модель с ролями пользователей
- ownership по менеджерам и персональные очереди
- полноценная Vercel/infra документация с публичной demo-ссылкой
- более глубокая аналитика по каналам поверх текущего snapshot-слоя
- богатый audit trail по всем типам write-операций

## Как запустить локально

### 1. Подготовить env

```bash
cp .env.example .env.local
```

Основные переменные:

- `RETAILCRM_BASE_URL`
- `RETAILCRM_API_KEY`
- `RETAILCRM_SITE_CODE`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `APP_BASE_URL`
- `LINK_SIGNING_SECRET`
- `DASHBOARD_OPERATOR_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `SYNC_ENDPOINT_SECRET`

### 2. Поднять БД-слой

Нужно применить SQL из `supabase/migrations/`.

Для полного сценария также нужны:

- `Supabase Edge Function` из `supabase/functions/sync-retailcrm`
- webhook secret для `Telegram`
- cron-конфигурация из `supabase/cron.sql.example`, если нужен автоматический polling

### 3. Установить зависимости и запустить UI

```bash
npm install
npm run dev
```

### 4. Прогнать demo-сценарий

```bash
npm run import:retailcrm
npm run sync:retailcrm
```

### 5. Проверить качество

```bash
npm run typecheck
npm test
npm run build
```

## Команды

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run import:retailcrm
npm run sync:retailcrm
npm run demo:reset
```

## Короткий вывод

Это компактный order-ops dashboard, который:

- связывает `RetailCRM`, `Supabase`, dashboard и `Telegram`
- показывает операционную картину по заказам
- помогает быстро отрабатывать крупные заказы
- безопасно меняет статус заказа обратно в CRM
- уже выглядит как рабочая база для дальнейшего развития
