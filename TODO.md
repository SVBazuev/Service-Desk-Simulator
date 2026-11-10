# TODO / Roadmap

Проект содержит **основное приложение** (Service Desk Simulator) и
**data-driven core** (schema-driven form/workflow runtime), на котором
оно работает.

Core пока в разработке и не выделен в отдельный репозиторий; приложение
и core живут в одном репозитории с общей сборкой и общими тестами.

Пункты ниже помечены `[Core]`, `[App]` или общие (без
префикса).

---

## ✅ Сделано

### Core

- **[Core]** Валидация в JSON-схемах (`field.validate.rule`,
  Commit A).
- **[Core]** Рендерер поддерживает `composite`,
  `checkboxGroup`, `showIf` (Commit B).
- **[Core]** Контракт `options` унифицирован, build-time
  валидация (Commit B.5).
- **[Core]** Манифесты уровней; `app.js` и `dataStore.js`
  без хардкода `if (level === N)` (Commit D).
- **[Core] Commit D.5 — Component Registry & Dynamic Anchors.**
  Поля рендерятся на лету; доступ через `state.currentForm`.
- **[Core] Commit D.6 — Naming & Contract Prep.**
  `workflow: "l1"/"l2"/"l3"` →
  `"registrar"/"dispatcher"/"engineer"`;
  `state.l3` → `state.engineer`; `queue` /
  `intro` в манифестах; `"template"` объявлен в схемах.
  DOM-anchor'ы `-l3` → `-engineer`.
- **[Core] Commit E — Schema-Driven UI (TemplateRenderer).**
  Декларативные шаблоны `registrar` / `dispatcher` /
  `engineer`; виджеты, readonly, incoming / diagnostics
  регистрируются через Extension API. `openWork` сокращён
  до: шапка → `TemplateRenderer.render` → монтирование панелей
  → populate/prefill → validate. `escapeHtml` — в
  `js/utils.js`. Rename `l3_logic` → `problem_logic`.
- **[Core] Commit F — Collapse physical queues.** Манифест
  уровня не знает ни одного DOM-id. Одна `#screen-queue`,
  одна `#modal-intro`, `data-queue-*` lookups.
- **[Core] Commit F.5 — Intro через словарь данных.**
  `data/common/intros.json` + `DataStore.getIntro(def)`
  (строка или `{ template, title?, body? }` с override).
  Манифесты содержат только ключ.
- **[Core] Commit G.0 — Extract domain from core.** Фасад
  `Extension` (6 методов). Доменные регистрации
  (panel kinds, workflows, readonly, widgets, slots,
  `problem_logic`) переехали в `js/service-desk/`.
  `js/core/` содержит ноль workflow-имён и ноль
  app-specific правил валидации.
- **[Core] Commit G.1a — registerFieldFormatter.**
  `Extension.registerFieldFormatter(fieldId, fn)` закрыл
  4 domain-ветки в `validator.js` (`org` / `cont` /
  `assignee` / `comment`). Форматтеры — в
  `js/service-desk/validators.js`.
- **[Core] Commit G.1b — middleware hook.**
  `Extension.use(fn)` + `Extension.runMiddleware(ctx, terminal)`:
  chain вокруг submit. Middleware `(ctx, next)` может
  обогатить `ctx.formData`, обернуть результат или прервать
  submit. Три submit-пути (`register` / `assignL2` /
  `submitEngineer`) унифицированы в `submitLevel()`;
  alias'ы удалены. Живой потребитель — `service-desk/middleware.js`
  (audit в `State.submitLog`, слот через `registerSlot`).
- **[Core] Commit G.1c — pluggable ProgressStore.**
  `Extension.setProgressStore(store)` +
  `getProgressStore()`. Контракт: `load` / `save` /
  `reset` / `getSummary`. Валидация всех 4 методов;
  `setProgressStore(null)` возвращает дефолт
  (`localStorage`-`ProgressStore`). `app.js` ходит только
  через шов — ни одного прямого `ProgressStore.*` в
  app-коде.
- **[Core] Commit G.1d — split app.js.**
  `js/app.js` (≈890 строк) → 7 модулей в
  `js/service-desk/app/`: `init` (bootstrap + DOM wiring),
  `router` (navigation + work screen), `submits`
  (submitLevel + showSuccess), `forms` (populate/prefill/
  cascade/validate/clarify), `levels` (snapshot + startLevel),
  `reference` (справочники + Problem Records), `kb`
  (статьи + меню). `app.js` — 5-строчный entry
  (`DOMContentLoaded` → `init`). Промежуточный `handleSubmit`
  и три submit-alias'а удалены; `submitLevel()` — единственный
  путь.
- **[Core] Commit G.1e — ESM migration.**
  `package.json` → `"type": "module"`.
  `scripts/build-data.js` генерирует `export const`.
  Все `js/core/*` и `js/service-desk/*` — именованные
  экспорты + импорты; `Extension` импортирует те модули,
  которые связывает. `const state = State` alias удалён,
  модули импортируют `State` напрямую (разрыв TDZ-циклов
  `init ↔ router ↔ forms ↔ workflows`). `index.html`:
  22 `<script>` → один `<script type="module">`.
  `tests/smoke-test-dom.js` переписан без `vm.runInContext`
  — прямые `import`, никаких `globalThis`-переключений.
  `var KB` в `kb.js` → `let`.

### Приложение Service Desk Simulator

- **[App]** Четыре уровня: L1 registrar, L2 dispatcher, L3 engineer,
  L4 problem manager.
- **[App]** Набор справочников, тикетов, базы знаний.
- **[App]** Встроенные автотесты: позитивные + негативные сценарии
  для L1/L2/L3.

### Общее

- Смоук-тест покрывает L1, L2, L3, L4 manifest, middleware
  audit log, pluggable progress store.
- `FormRenderer.render` вешает слушатели `change`/`input`
  один раз (guard через `dataset.frbBound`).
- `fillSelect` принимает только объекты `{value, label}`.
- `npm test` после G.1e: L1 22 / L2 16 / L3 12 / L4 manifest
  + middleware + progressStore — PASS.

**Фаза 1 (generic core + extension points) закрыта целиком.**
Ludus = generic core + явные швы. Приложение — в
`js/service-desk/`, ядро — в `js/core/`.

---

## 🔥 Высокий приоритет (Next)

### Core

- ☐ **Commit H — Ludus CLI / build pipeline.**
  Компилятор деклараций в статические артефакты:
  `dist/ludus.css`, `dist/ludus-templates.html`,
  `dist/ludus-runtime.js`, `dist/data.js`.
  - ☐ `scripts/build-data.js` расширяется до компилятора
    шаблонов и CSS.
  - ☐ `TemplateRenderer` из runtime-generator → runtime-binder
    (клонирование `<template>` + подстановка вместо сборки
    DOM с нуля).
  - ☐ Инварианты: детерминизм (один вход → один выход
    байт-в-байт), zero runtime CSS, zero runtime HTML,
    токены — единственный источник правды о визуальном.

  После G.1a–e — unblocked. Без generic core и extension API
  нечего компилировать; без компиляции шаблоны остаются
  JS-объектами, что не даёт преимуществ compile-time (кэш,
  детерминизм, статические артефакты).

### App

- ☐ **Рефакторинг `autotests.js`.**
  Убрать ручную сборку HTML (`generateFormHtml` /
  `generateDetailsHtml`) и прямые манипуляции с DOM.
  Использовать `TemplateRenderer`, `FormRenderer`,
  `Validator`. Позитивные/негативные сценарии должны
  описываться данными (JSON-описание тест-кейса → рантайм
  прогоняет через `submitLevel`).

---

## ⚙️ Технический долг и архитектура

### Core

- ☐ **Null-guard'ы.** В `FormRenderer` и `runAutotests*`
  при работе с `getElementById(…)` без проверки на `null`.
  Привычка: `const el = document.getElementById(...);
  if (!el) return;`.

- ☐ **Линтинг.** ESLint + Prettier (в ESM-режиме — flat
  config, `sourceType: "module"`).

- ☐ **Восстановить декларативные tabs/actions** в
  `card-l3.json`. В D.5 они временно заменены на hardcoded
  `renderIncoming` / `renderDiagnostics`; вернуть data-driven
  подход через `TemplateRenderer`.

### Общее

- ☐ **CI/CD (GitHub Actions).** `npm run build` +
  `npm test` на push в `main` и `develop`.
- ☐ **Scenario Packs.** Загрузка разных наборов задач через выбор
  манифеста.

---

## 🎨 UI/UX (App)

- ☐ Визуальная валидация полей (подсветка незаполненных/неверных).
- ☐ Фильтр и сворачивание блоков на экране результатов.
- ☐ Анимации переходов между экранами и модалками.
- ☐ Тёмная тема.

## 📚 Контент (App)

- ☐ Расширение Базы Знаний (SLA, эскалация, конфликтные клиенты).
- ☐ Больше карточек для L1 и L2 (вариативность).
- ☐ Локализация (i18n) — задачи + UI. Первый кандидат —
  intro-шаблоны: `intros.engineer.ru` / `intros.engineer.en`
  по аналогии с `schema.template`.

## 🚀 Features / Backend

- ☐ **Мультиплеер (Backend).** Node.js (Express/Fastify) +
  WebSocket. L2 (Тимлид) назначает задачу реальному
  пользователю на L3. → Шов готов: `Extension.use(fn)` —
  middleware на submit для синхронизации с сервером.
- ☐ **Сохранение прогресса на сервере.** Замена `localStorage`
  на API-бэкенд. → Шов готов: `Extension.setProgressStore(store)`
  — pluggable store без правок `app.js`.
