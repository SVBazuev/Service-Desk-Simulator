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
  `intro` в манифестах; `"template"` объявлен в схемах
  (рантайм читает — в Commit E). DOM-anchor'ы `-l3` →
  `-engineer`.

### Приложение Service Desk Simulator

- **[App]** Четыре уровня: L1 registrar, L2 dispatcher, L3 engineer,
  L4 problem manager.
- **[App]** Набор справочников, тикетов, базы знаний.
- **[App]** Встроенные автотесты: позитивные + негативные сценарии
  для L1/L2/L3.

### Общее

- Смоук-тест покрывает L1, L2, L3 и L4 manifest.
- `FormRenderer.render` вешает слушатели
  `change`/`input` один раз (guard через
  `dataset.frbBound`).
- `fillSelect` принимает только объекты `{value, label}`.
- `renderLevelCards` больше не проверяет устаревший
  `lvl.queueScreen`.

---

## 🔥 Высокий приоритет (Next)

### Core

☑ **Commit E: Schema-Driven UI (TemplateRenderer) — Done**
  - `js/core/templateRenderer.js` создан. Декларативные шаблоны
    `registrar`, `dispatcher`, `engineer`:
    `{ panels: [{ kind, title?, readonly?, after?, submitLabel? }] }`.
  - Виджеты переехали в `TemplateRenderer._widgets`:
    `versions`, `prio-hint`, `auto-calc`.
    Readonly-блоки — `TemplateRenderer._readonly`.
    Incoming и Diagnostics — `_renderIncomingPanel` /
    `_renderDiagnosticsPanel`.
  - `openWork` сокращён до: шапка → `TemplateRenderer.render`
    → монтирование панелей в `[data-slot="work-grid"]` →
    populate/prefill → validate.
  - Из `app.js` удалены `renderIncoming`,
    `renderDiagnostics`, `buildReadonlyBlock`,
    `buildVersionsWidget`, `buildPriorityHint`,
    `buildAutoCalcBlock`.
  - `escapeHtml` переехал в `js/utils.js` (общий для
    `showResults` и `autotests.js`).
  - Кнопки submit/cancel рендерит `TemplateRenderer`; `init()`
    их больше не подключает, ловятся через делегирование по
    `data-action="submit" | "cancel"`.
  - `handleFieldChange` читает `registry` из
    `state.currentForm` и использует `registry.container`
    вместо устаревшего `q('[data-slot="form-body"]')`.
  - `index.html`: `screen-work` сокращён до topbar + пустой
    `[data-slot="work-grid"]`. `<script templateRenderer.js>`
    добавлен **после** `utils.js`, **до** `app.js` (обязательный
    порядок: TemplateRenderer зависит от `utils`).
  - `tests/smoke-test-dom.js`: добавлен
    `js/core/templateRenderer.js` в `jsFiles` (тот же
    порядок).
  - Rename правила: `l3_logic` → `problem_logic`
    (`card-l3.json`, `card-l4.json`, `validator.js`,
    `data-bundle.js`). Тело правила не менялось.
  - `npm test`: L1 22 / L2 16 / L3 12 / L4 manifest — PASS.
  - **Отложено (не блокирует):** три комментария
    `// для L3` в `validator.js` остались не
    переименованными — косметический follow-up.

☐ **Commit F: Collapse physical queues (Next)**
  - ☐ Убрать `queue.screen/list/done/total/finish` из
    манифестов — оставить только строки `title`,
    `doneLabel`, `finishLabel`, `showProblems`.
  - ☐ Одна `<section id="screen-queue" data-queue-for>` в
    `index.html`.
  - ☐ `renderQueue` через `data-queue-*` атрибуты.
  - ☐ Intro-модалка коллапсируется в `<div data-intro-for>`;
    `intro.modal` / `intro.startBtn` уходят из
    манифестов, вместо них `intro.title` / `intro.body`
    (HTML).

### App

- ☐ После E и F — переоценить: что ещё можно вынести в JSON. Пока
  приложение в основном **готово**.

---

## ⚙️ Технический долг и архитектура

### Core

- ☐ **Commit G — ESM + extension points.**
  Тот коммит, где core перестаёт быть монолитом и становится
  **точками расширения** для приложений.
  - ☐ Миграция на ES-модули (`import`/`export`),
    прощание с `var` и `window.*`.
  - ☐ `registerWorkflow(name, template)` — API для регистрации
    шаблонов.
  - ☐ `registerValidator(name, fn)` — для правил валидации.
  - ☐ `use(middleware)` — middleware на `submit`.
  - ☐ `setProgressStore({ load, save, reset, getSummary })`.
  - ☐ Переписать `smoke-test-dom.js` без
    `vm.runInContext`.
  - ☐ Разбить `app.js`: бизнес-логика переезжает в
    `service-desk/app/*.js`, core остаётся в `js/core/`.

- ☐ **Null-guard'ы.** В `FormRenderer` и `runAutotests*`
  при работе с `getElementById(…)` без проверки на `null`.
  Ввести привычку: `const el = document.getElementById(...);
  if (!el) return;`.

- ☐ **Линтинг.** ESLint + Prettier.

- ☐ **Восстановить декларативные tabs/actions** в `card-l3.json`.
  В D.5 они временно заменены на hardcoded `renderIncoming` /
  `renderDiagnostics`; вернуть data-driven подход через
  `TemplateRenderer` (задача E).

### App

- ☐ **Commit H — рефакторинг `autotests.js`.**
  Убрать ручную сборку HTML и прямые манипуляции с DOM. Использовать
  `FormRenderer`, `Validator` и `TemplateRenderer`.

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
- ☐ Локализация (i18n) — задачи + UI.

## 🚀 Features / Backend

- ☐ **Мультиплеер (Backend).** Node.js (Express/Fastify) + WebSocket.
  L2 (Тимлид) назначает задачу реальному пользователю на L3.
  → Требует от core отдельный hook: `onSubmit(ticket, formData)`.
- ☐ **Сохранение прогресса на сервере.** Замена `localStorage`
  на API-бэкенд. → В терминах core — plug-in для
  `ProgressStore`.
