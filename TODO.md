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
- **[Core] Commit E — Schema-Driven UI (TemplateRenderer).**
  `js/core/templateRenderer.js` с декларативными шаблонами
  `registrar` / `dispatcher` / `engineer`:
  `{ panels: [{ kind, title?, readonly?, after?, submitLabel? }] }`.
  Виджеты в `TemplateRenderer._widgets` (`versions`,
  `prio-hint`, `auto-calc`); readonly-блоки в
  `_readonly`; incoming / diagnostics в
  `_renderIncomingPanel` / `_renderDiagnosticsPanel`.
  `openWork` сокращён до: шапка → `TemplateRenderer.render`
  → монтирование панелей → populate/prefill → validate. Из
  `app.js` удалены `renderIncoming`,
  `renderDiagnostics`, `buildReadonlyBlock`,
  `buildVersionsWidget`, `buildPriorityHint`,
  `buildAutoCalcBlock`. `escapeHtml` вынесен в
  `js/utils.js`. Кнопки submit/cancel рендерит шаблон
  (`data-action="submit" | "cancel"`). Rename правила
  `l3_logic` → `problem_logic` в схемах,
  `validator.js`, `data-bundle.js`.
- **[Core] Commit F — Collapse physical queues.**
  Манифест уровня больше не знает ни одного DOM-id:
  `queue: { screen, list, done, total, finish }` заменён на
  `{ title, doneLabel, finishLabel, showProblems }`;
  `intro: { modal, startBtn }` заменён на
  `{ title, body }` (HTML). В `index.html` — одна
  `<section id="screen-queue">` с `data-queue-*`
  атрибутами и одна `<div id="modal-intro">` с
  `data-intro-title` / `data-intro-body` /
  `data-intro-start`. `renderQueue()` читает всё из
  единственной секции через `data-queue-*` lookups;
  `startLevel()` заполняет модалку из `lvl.intro`.
  `init()` больше не подключает кнопки по id — одна
  `data-queue-finish`, одна `data-intro-start`, одна
  `data-queue-problems`. Тесты используют
  `[data-queue-done]` / `[data-queue-finish]` /
  `modal-intro`. После F: `grep` по
  `screen-queue-l|screen-queue-engineer|queue-list-l|
  queue-list-engineer|q-done-l|q-done-engineer|btn-finish-l|
  btn-finish-engineer|modal-l2-intro|modal-engineer-intro`
  по `js/` и `data/levels/` — пусто.

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
- `npm test` после F: L1 22 / L2 16 / L3 12 / L4 manifest —
  PASS.

---

## 🔥 Высокий приоритет (Next)

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

- ☐ **Commit F.5 — Intro через словарь данных (data-lookup).**
  После F манифесты L3/L4 содержат идентичные `intro.body` с
  HTML — дублирование. HTML в JSON здесь допустим (intro — rich
  text, не layout), но дублирование — нет.
  Решение — **не в движке**, а в данных:
  - ☐ `data/common/intros.json`: именованные записи
    (`dispatcher`, `engineer`, …) с полями
    `title` / `body`.
  - ☐ `scripts/build-data.js`: добавить `INTROS` в
    `COMMON_JSON`.
  - ☐ `js/core/dataStore.js`: метод
    `getIntro(def)` — принимает строку (имя) или объект
    `{ template, title?, body? }` с override; возвращает
    `{ title, body }`.
  - ☐ Манифесты: `"intro": "dispatcher"` /
    `"engineer"`; L4 —
    `{ "template": "engineer", "title": "…" }`
    (переиспользует тело, переопределяет заголовок).
  - ☐ `startLevel()` в `app.js` вызывает
    `DataStore.getIntro(lvl.intro)` — 2 строки.
  - ☐ Тесты без изменений: интерфейс модалки
    (`[data-intro-title]` / `[data-intro-body]`)
    и её id (`modal-intro`) не меняются.
  - ☐ **Не входит**: i18n. Локализация — отдельная итерация:
    `intros-ru.json` / `intros-en.json` +
    параметр языка в `getIntro`.
  - ☐ **Осознанно НЕ в `TemplateRenderer`**: у него одна
    ответственность — work screen (panels + Registry + submit).
    Intro — content/lookup, не layout. Параллельный
    `TemplateRenderer.intros` / `renderIntro` раздувал
    бы API, вводя второй механизм с тем же контрактом.
  - ☐ **Когда**: сразу после merge F (долг маленький). I и G не
    пересекаются по файлам — если G начнётся первым, I можно
    сделать в новой раскладке файлов.

### App

- ☐ После E и F — переоценить: что ещё можно вынести в JSON. Пока
  приложение в основном **готово**.

---

## ⚙️ Технический долг и архитектура

### Core

- ☐ **Null-guard'ы.** В `FormRenderer` и `runAutotests*`
  при работе с `getElementById(…)` без проверки на `null`.
  Ввести привычку: `const el = document.getElementById(...);
  if (!el) return;`.

- ☐ **Линтинг.** ESLint + Prettier.

- ☐ **Восстановить декларативные tabs/actions** в `card-l3.json`.
  В D.5 они временно заменены на hardcoded `renderIncoming` /
  `renderDiagnostics`; вернуть data-driven подход через
  `TemplateRenderer` (задача E закрыта, но tabs/actions — нет).

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
- ☐ Локализация (i18n) — задачи + UI. Первый кандидат —
  intro-шаблоны из Commit F.5: `intros.engineer.ru` /
  `intros.engineer.en` по аналогии с `schema.template`.

## 🚀 Features / Backend

- ☐ **Мультиплеер (Backend).** Node.js (Express/Fastify) + WebSocket.
  L2 (Тимлид) назначает задачу реальному пользователю на L3.
  → Требует от core отдельный hook: `onSubmit(ticket, formData)`.
- ☐ **Сохранение прогресса на сервере.** Замена `localStorage`
  на API-бэкенд. → В терминах core — plug-in для
  `ProgressStore`.
