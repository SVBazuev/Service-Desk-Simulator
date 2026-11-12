# TODO / Roadmap

Проект содержит **основное приложение** (Service Desk Simulator) и
**data-driven runtime** (schema-driven form/workflow engine), на
котором оно работает.

Runtime пока в разработке и не выделен в отдельный репозиторий;
приложение и core живут в одном репозитории с общей сборкой и
общими тестами.

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
  (`localStorage`-`ProgressStore`). App-код ходит только
  через шов — ни одного прямого `ProgressStore.*`.
- **[Core] Commit G.1d — split app.js.**
  `js/app.js` (≈890 строк) → 7 модулей в
  `js/service-desk/app/`: `init` (bootstrap + DOM wiring),
  `router` (navigation + work screen), `submits`
  (submitLevel + showSuccess), `forms` (populate/prefill/
  cascade/validate/clarify), `levels` (snapshot + startLevel),
  `reference` (справочники + Problem Records), `kb`
  (статьи + меню). `app.js` — 5-строчный entry.
- **[Core] Commit G.1e — ESM migration.**
  `package.json` → `"type": "module"`.
  `scripts/build-data.js` генерирует `export const`.
  Все `js/core/*` и `js/service-desk/*` — именованные
  экспорты + импорты. `index.html`: 22 `<script>` → один
  `<script type="module">`. `tests/smoke-test-dom.js`
  переписан без `vm.runInContext`.
- **[Core] Commit H.1 — parameterize build-data.js.**
  `data/manifest.json` — единая точка входа для источников.
  Build-data без hardcoded путей.
- **[Core] Commit H.2 — dist/data.js as artifact.**
  `js/data-bundle.js` удалён; `dataStore.js` импортирует
  `dist/data.js`. `pretest: npm run build`.
- **[Core] Commit H.3a — binder + dist/ludus-templates.js.**
  `TemplateRenderer.bind / bindElement / registerTemplates`.
  Шаблоны для `shell/panel`, `shell/panel-no-footer`,
  `shell/form-grid`, readonly-блоков.
- **[Core] Commit H.3b — widget templates.**
  `widget-versions`, `widget-prio-hint`, `widget-auto-calc`.
  Фикс `_widgets[w].call(this, …)`.
- **[Core] Commit H.3c — panels templates.**
  `panel-incoming`, `panel-diagnostics` через binder.
  `TemplateRenderer._createPanel` удалён. `_esc` удалён
  (заменён `escapeHtml` из `js/utils.js`).
- **[Core] Commit H.4 — dist/ludus.css.**
  `themes/default.json` — единственный источник токенов.
  `scripts/build-css.js` эмитит `:root` + `@layer ludus.components`.
  `css/style.css` без `:root`. `index.html` грузит
  `dist/ludus.css`.

### Приложение Service Desk Simulator

- **[App]** Четыре уровня: L1 registrar, L2 dispatcher, L3 engineer,
  L4 problem manager.
- **[App]** Набор справочников, тикетов, базы знаний.
- **[App]** Встроенные автотесты: позитивные + негативные сценарии
  для L1/L2/L3.

### Общее

- Смоук-тест покрывает L1, L2, L3, L4 manifest, middleware
  audit log, pluggable progress store, build-артефакты
  (data, templates, css).
- `FormRenderer.render` вешает слушатели `change`/`input`
  один раз (guard через `dataset.frbBound`).
- `fillSelect` принимает только объекты `{value, label}`.
- `npm test` после H.4: L1 22 / L2 16 / L3 12 / L4 manifest
  + middleware + progressStore + templates + css — PASS.

**Фазы 1 и 1.5 (runtime + build-time assembly) закрыты.**
Ludus = generic core + явные швы + build-артефакты. Приложение —
в `js/service-desk/`, ядро — в `js/core/`, артефакты — в `dist/`.

---

## 🔥 Высокий приоритет (Next)

### Core

- ☐ **Commit H.5 — extract `@ludus/core` workspace package.**
  Подготовить runtime к упаковке (шаг перед H.6).
  - ☐ `packages/@ludus/` — package.json (`@ludus/core`),
    `js/` (переезд `js/core/*.js` через `git mv`),
    `js/utils.js` (только `fillSelect` — единственный
    core-helper, который сейчас ошибочно лежит в app-utils).
  - ☐ `js/utils.js` — реэкспорт `fillSelect` из core;
    core больше не зависит от app-utils.
  - ☐ Все `js/service-desk/*` и `js/autotests.js` и
    `tests/smoke-test-dom.js` — bare specifier
    `@ludus/core/js/*` вместо relative `../../core/*`.
  - ☐ Корневой `package.json`: `workspaces: ["packages/*"]`,
    `dependencies: { "@ludus/core": "*" }`.
  - ☐ `index.html`: `<script type="importmap">` для
    разрешения `@ludus/core/js/*` в браузере.
  - ☐ `npm install` — symlink `node_modules/@ludus/core`.
  - ☐ **Чего ещё НЕ делает:** не вводит `ludus build`, не
    создаёт `dist/<app>/`. Runtime остаётся consumable
    пакетом, не packager'ом.

- ☐ **Commit H.6 — `ludus build` (packager).**
  Один очевидный способ собрать deployable — аналог
  `spring-boot:repackage`.
  - ☐ `ludus.config.json` — декларация «что откуда собирать»
    (app entry, data manifest, templates index, theme,
    css source, extensions, output dir). Отделяет build-config
    от `data/manifest.json` (там — только данные).
  - ☐ `bin/ludus.js` — оркестратор:
    `data` / `templates` / `css` / `package`.
  - ☐ `package` шаг: скопировать `@ludus/core/js/*` и app-код
    в `dist/<app>/`, сгенерировать `index.html` с import map
    и entry `<script type="module">`, аккумулировать
    артефакты H.1–H.4.
  - ☐ Итог: `dist/<app>/` — одна папка, готова к serve
    (`python -m http.server --directory dist/<app>`).
  - ☐ `npm run build` — алиас на `node bin/ludus.js build`.
  - ☐ Инварианты: детерминизм (один вход → один артефакт
    байт-в-байт), zero runtime CSS, zero runtime HTML,
    токены — единственный источник правды о визуальном.

- ☐ **Battle test в отдельном репозитории (`cheat_linux` fork).**
  Реальный второй продукт на `@ludus/core` — не имитация
  второго приложения в том же репо. Источник данных:
  `cheat_linux.html` (Debian Knowledge Base, ~15 секций ×
  ~100 команд, поиск, фильтр риска, тултип, copy).
  - ☐ Отдельный git-репозиторий (fork).
  - ☐ Данные из HTML → JSON (секции, команды, теги).
  - ☐ `@ludus/core` — через один из вариантов (решение —
    см. `PLAN-cheat-linux.md`, раздел «Как потреблять
    ядро»): copy `packages/@ludus`, `npm link`,
    submodule, или опубликовать как пакет.
  - ☐ `ludus.config.json`, шаблоны (toolbar / toc /
    section / row / empty-state / footer), тема
    (мягкий графит), `css/style.css` без `:root`,
    `js/app.js` — рендер + поиск + фильтр + copy +
    тултип.
  - ☐ `npm run build` → `dist/debian-kb/` —
    самодостаточная папка.
  - ☐ **Цель испытания:** найти, что в `@ludus/core`
    подразумевало Service Desk. Найденное — отдельные
    коммиты H.8/H.9 обратно в этот репо.
  - ☐ **Не покрывает:** полный 1-в-1 перенос cheat_linux
    (это будет следующий шаг после того, как ядро
    отработает battle test).

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

- ☐ **Commit H.3d/e/f — оставшиеся imperative renderer'ы.**
  Перевести на binder (опционально; не блокирует H.5/H.6):
  - ☐ `router.js`: `renderQueue`, `showResults`.
  - ☐ `reference.js`: `openOrgList`, `openEmpList`,
    `openContacts`, `openProblems`.
  - ☐ `kb.js`: `buildKb`, `switchKbTab`.
  - ☐ `workflows.js`: `renderVerList`, `renderAddProdSelect`.

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

- ☐ **DataStore: DI для data-dist.** `dataStore.js` сейчас
  хардкодит `../../../dist/data.js`. Заменить на
  init-time инъекцию, когда появится второй потребитель
  `@ludus/core` (сейчас второго нет — правка преждевременна).

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
