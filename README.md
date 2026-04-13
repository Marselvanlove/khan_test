# GBC Analytics Dashboard for Tomyris

Мини-дашборд для тестового задания `AI Tools Specialist`: импорт заказов из `mock_orders.json` в RetailCRM, синк RetailCRM -> Supabase, веб-дашборд на Next.js и Telegram-алерты для заказов дороже `50 000 ₸`. Подача адаптирована под контекст `Tomyris` как казахстанского fashion / shapewear e-commerce бренда.

## Что внутри

- `src/app` — публичный дашборд на Next.js App Router.
- `scripts/import-mock-orders.ts` — первичный импорт `mock_orders.json` в RetailCRM.
- `scripts/sync-retailcrm.ts` — ручной запуск синка RetailCRM -> Supabase + Telegram.
- `supabase/migrations` — схема таблицы `orders` и view `daily_order_metrics`.
- `supabase/functions/sync-retailcrm` — Edge Function для автосинка и уведомлений.
- `supabase/cron.sql.example` — шаблон SQL для cron-запуска Edge Function раз в минуту.

## Архитектура

```text
mock_orders.json
  -> RetailCRM API
  -> Supabase orders
  -> Next.js dashboard on Vercel

Supabase Cron
  -> Edge Function sync-retailcrm
  -> RetailCRM API
  -> Supabase upsert
  -> Telegram Bot API
```

## Почему это связано с Tomyris

- На сайте Tomyris видно казахстанский e-commerce контекст: цены в `₸`, free shipping threshold и social-heavy acquisition.
- Поэтому в дашборде сохранён alert `> 50 000 ₸` из ТЗ, но добавлены бизнес-сегменты `35 000 ₸+` и `60 000 ₸+`.
- `utm_source` вынесен в отдельный аналитический слой, чтобы видеть вклад `Instagram`, `direct`, `Google`, `referral` и других источников.

## Переменные окружения

Скопируй `.env.example` в `.env.local` и заполни значения:

```bash
cp .env.example .env.local
```

Ключевые переменные:

- `RETAILCRM_BASE_URL` — домен CRM, например `https://demo.retailcrm.ru`
- `RETAILCRM_API_KEY`
- `RETAILCRM_SITE_CODE` — код магазина в RetailCRM
- `RETAILCRM_ORDER_TYPE`, `RETAILCRM_ORDER_METHOD`, `RETAILCRM_STATUS` — коды справочников; для текущего аккаунта `xmamyrov` это `main`, `shopping-cart`, `new`
- `RETAILCRM_UTM_FIELD_CODE` — код кастомного поля, если хочешь сохранять `utm_source` в отдельное поле CRM
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PUBLISHABLE_KEY` — опционально, если позже появится публичный клиент
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` — для текущего решения `-1003953849238`
- `SYNC_ENDPOINT_SECRET`

## Локальный запуск

```bash
npm install
npm run dev
```

Дашборд поднимется на [http://localhost:3000](http://localhost:3000).

## Импорт заказов в RetailCRM

Сначала проверь, что в RetailCRM существуют корректные коды `site`, `orderType`, `orderMethod`, `status`.

Пробный прогон:

```bash
npm run import:retailcrm -- --dry-run
```

Боевой импорт:

```bash
npm run import:retailcrm
```

Скрипт:

- назначает внешние ID `mock-001 ... mock-050`
- импортирует заказы последовательно с безопасной задержкой
- не плодит дубли при повторном запуске, если RetailCRM возвращает ошибку о существующем `externalId`

## Supabase

### 1. Выполни миграцию

Через SQL Editor выполни файл:

- `supabase/migrations/20260413182000_init_orders.sql`

### 2. Ручной синк

```bash
npm run sync:retailcrm
```

Скрипт:

- забирает все страницы заказов из RetailCRM
- нормализует данные
- делает `upsert` в `public.orders`
- отправляет Telegram-уведомления для заказов дороже `50 000 ₸`, если они ещё не были отправлены

### 3. Edge Function

Если используешь Supabase CLI:

```bash
supabase functions deploy sync-retailcrm
supabase secrets set \
  SUPABASE_URL="..." \
  SUPABASE_SECRET_KEY="..." \
  RETAILCRM_BASE_URL="..." \
  RETAILCRM_API_KEY="..." \
  RETAILCRM_SITE_CODE="..." \
  TELEGRAM_BOT_TOKEN="..." \
  TELEGRAM_CHAT_ID="..." \
  SYNC_ENDPOINT_SECRET="..."
```

Функция ожидает заголовок `x-sync-secret`.

Пример ручного вызова:

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/sync-retailcrm" \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: $SYNC_ENDPOINT_SECRET" \
  -d '{"source":"manual"}'
```

### 4. Cron

Шаблон SQL лежит в:

- `supabase/cron.sql.example`

Он настраивает запуск Edge Function каждую минуту через `pg_cron + pg_net`.

## Дашборд и деплой на Vercel

В проекте нет клиентского доступа к backend secret: Supabase читается на сервере в App Router через `SUPABASE_SECRET_KEY`.

Рабочий flow под сдачу:

```bash
git init
git remote add origin https://github.com/Marselvanlove/khan_test.git
git add .
git commit -m "feat: finish tomyris analytics dashboard"
git push -u origin main
```

Дальше через Vercel Dashboard:

1. Подключи GitHub-репозиторий.
2. Добавь env vars из `.env.local`.
3. Задеплой проект.

## Что показать в результате

- `Vercel URL`: `TODO`
- `GitHub URL`: `https://github.com/Marselvanlove/khan_test`
- `Telegram screenshot`: `TODO`

## Промпты для AI-инструмента

Ниже список основных запросов, которыми велась реализация через AI-инструмент:

1. `Проанализируй тестовое задание, выбери стек и разложи реализацию на этапы.`
2. `Собери новый Next.js проект под дашборд заказов с серверной интеграцией Supabase.`
3. `Напиши скрипт импорта mock_orders.json в RetailCRM с идемпотентным externalId.`
4. `Сделай Edge Function для синка RetailCRM -> Supabase и Telegram-алертов.`
5. `Подготовь README с архитектурой, командами и инструкцией по cron.`

## Где застрял и как решил

- `RetailCRM item payload`: неочевидно, как безопасно передавать товары без заранее заведённого каталога. Решение: отправлять `productName`, `quantity`, `initialPrice` и детерминированный `offer.externalId`.
- `utm_source`: нельзя полагаться на наличие кастомного поля в демо-аккаунте. Решение: поддержать опциональный `RETAILCRM_UTM_FIELD_CODE`, а без него сохранять `utm_source` в `customerComment`.
- `Автоуведомления`: на `Vercel Hobby` cron не подходит для near-real-time. Решение: использовать `Supabase Edge Function + pg_cron`.
- `Tomyris context`: ТЗ выглядит общим, но реальный сайт бренда даёт более правильные бизнес-ориентиры. Решение: добавить сегменты `35k+` и `60k+`, не ломая основной alert `50k+`.

## Что ещё нужно сделать руками

- Подставить реальные ключи и URL в `.env.local`
- Выполнить миграцию в Supabase
- Загрузить 50 заказов в RetailCRM
- Запустить первый sync
- Задеплоить фронт на Vercel
- Добавить финальные ссылки и скриншот в этот README
