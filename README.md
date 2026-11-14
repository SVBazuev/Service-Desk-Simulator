# Service Desk Simulator | ООО «Про.Софт»

Обучающий веб-симулятор для инженеров технической поддержки. Симулирует
работу Service Desk и помогает отработать навыки регистрации обращений,
распределения задач и решения инцидентов (по методологии ITIL).

> Внутри используется schema-driven form/workflow runtime — Ludus core.

## 🎮 Уровни (сценарии симулятора)

Симулятор собран из четырёх сценариев. Пользователь проходит их
независимо, прогресс сохраняется в `localStorage`.

- **Уровень 1 — Регистрация обращений.** Разбор входящих, заполнение
  карточки, определение типа, категории, важности и срочности по
  матрице приоритетов.
- **Уровень 2 — Распределение (Тимлид).** Назначение ответственных
  с учётом загруженности и специализации, эскалации менеджеру.
- **Уровень 3 — Решение инцидентов (Инженер 2-й линии).** Диагностика
  (логи, конфигурация, лицензии), поиск первопричины, обходное и
  радикальное решение, Known Error / Problem Management.
- **Уровень 4 — Problem Manager.** Расследование корневых причин и
  управление Problem Records. Использует шаблон `engineer`, но
  собственную схему полей (`card-l4.json`).

## 🧩 Из чего состоит проект

Симулятор = **данные + core + бизнес-логика приложения**.

```text
data/                ← чистые данные симулятора
├── common/          ← справочники (орг., сотрудники, матрица SLA)
├── levels/          ← манифесты уровней (queue, intro, workflow)
├── schemas/         ← схемы карточек (fields + template)
├── tickets/         ← задачи по уровням
├── problems.json    ← Problem Records
└── kb-l3.json       ← статьи базы знаний

templates/           ← HTML-шаблоны (shell, panels, readonly, widgets)
themes/              ← цветовые токены (default.json)
css/style.css        ← CSS-правила (без :root — токены в themes/)

js/                  ← код
├── core/            ← runtime (state, dataStore, formRenderer,
│                       templateRenderer, validator, progressStore)
├── service-desk/    ← бизнес-логика Service Desk
│   ├── app/         ← router, submits, forms, levels, reference, kb
│   └── *.js         ← workflows, panels, validators, middleware
├── app.js           ← entry: DOMContentLoaded → init()
└── autotests.js     ← встроенные автотесты

scripts/             ← build-time assembly
├── build-data.js    ← data/*.json      → dist/data.js
├── build-templates.js ← templates/*.html → dist/ludus-templates.js
└── build-css.js     ← themes/ + css/   → dist/ludus.css
```

**Данные полностью отделены от кода**: добавление новой задачи,
нового уровня или новой роли в существующее приложение сводится к
правке JSON + `npm run build`.

## 🧭 Как это устроено (термины)

- **Runtime** (`js/core/`) — binder. Связывает данные с шаблонами,
  переключает токены, обслуживает extension points. Не генерирует
  CSS, не собирает HTML.
- **Build-time assembly** (`scripts/build-*.js`) — сериализует
  данные, конкатенирует шаблоны, эмитит CSS.
- **Packager** (в планах, `Commit H`): `ludus build` будет собирать
  `dist/<app>/` из core + config + app-кода. Аналог
  `spring-boot:repackage`, а не компилятора: источники уже
  исполнимы, задача — собрать их в одну папку.

Сейчас packager ещё не выделен: deployable — это корневая папка
(`index.html` + `js/` + `dist/`). Serve через локальный сервер
(см. «Быстрый старт»).

## ✨ Особенности

- **Данные в JSON.** Справочники, задачи, схемы, манифесты уровней —
  всё в `data/`. `npm run build` собирает их в один `dist/data.js`
  (ESM-модуль с именованными экспортами).
- **HTML-шаблоны в `templates/`.** Структура панелей, readonly-блоков
  и виджетов живёт в HTML-шаблонах; `npm run build` эмитит их в
  `dist/ludus-templates.js`. Приложение их только биндит через
  `TemplateRenderer.bind(...)`.
- **Dynamic Anchors (core).** Поля формы рендерятся на лету с
  уникальными id; доступ к ним идёт через `Registry`
  (`state.currentForm`), а не через `getElementById`.
- **Schema-Driven UI (core).** Обвязка карточки (панели, кнопки,
  диагностика) определяется ключом `"template"` в JSON-схеме.
  Больше нет дублей `screen-work` для разных уровней.
- **Collapsed UI (core).** Очередь и intro-модалка существуют в
  единственном экземпляре (`#screen-queue`, `#modal-intro`).
  Манифест уровня не содержит ни одного DOM-id — только данные
  (title, labels) и ссылки на схемы/тикеты.
- **CSS-токены в `themes/default.json`.** `npm run build` эмитит
  `dist/ludus.css` с `:root` (токены) + `@layer ludus.components`
  (правила). Переключение темы — правка `themes/*.json` + пересборка.
- **Прогресс в `localStorage`.**
- **Встроенная база знаний** по ITIL, SLA и методам расследования.
- **Автотесты** прямо в UI: позитивные + негативные сценарии.

## 🚀 Быстрый старт

### Вариант 1: локальный сервер (рекомендуется)

```bash
npm install
npm run build
python -m http.server 8000
# или
npx serve .
```

Открой `http://localhost:8000`.

### Вариант 2: `file://` (двойной клик по `index.html`)

Сначала:

```bash
npm install
npm run build
```

Потом открой `index.html`.

## 🛠️ Для разработчиков и контент-менеджеров

### Как добавить задачу?

1. Открой `data/tickets/l1.json` (или `l2.json`,
   `l3.json`, `l4.json`).
2. Скопируй существующий тикет, измени `id`, `title`,
   `text`, `etalon`.
3. `npm run build`.
4. Обнови страницу.

### Как изменить поля карточки?

**Поля** → массив `fields` в `data/schemas/card-lX.json`.

### Как изменить UI-обвязку (панели, диагностика, кнопки)?

- **Структура** — HTML-шаблон в `templates/panels/`,
  `templates/shell/`, `templates/readonly/`, `templates/widgets/`.
  `npm run build` эмитит их в `dist/ludus-templates.js`.
- **Логика панели** (panel kind) — `js/service-desk/panels.js`.
- **Набор панелей для workflow** — `Extension.registerWorkflow`
  в `js/service-desk/workflows.js`.
- **Тема** — `themes/default.json`.

### Как добавить новый уровень?

1. Добавь `data/levels/lN.json` с манифестом (workflow, queue,
   intro, schema, tickets).
2. Добавь в `data/levels/index.json` →
   `"levels": […, "lN.json"]`.
3. Если нужен новый workflow — зарегистрируй его через
   `Extension.registerWorkflow` в `js/service-desk/workflows.js`
   и (если требуется новая структура панели) добавь HTML-шаблон
   в `templates/`.
4. `npm run build`.

### Как изменить тему?

1. Отредактируй `themes/default.json` (единственный источник
   правды о цветах).
2. `npm run build`.
3. Обнови страницу.

`css/style.css` содержит CSS-правила, но не токены (`:root`
эмитится build-step'ом из `themes/default.json`).

## 🧪 Тестирование

```bash
npm install
npm run build
npm test
```

Смоук-тест прогоняет все четыре уровня (L1 22 / L2 16 / L3 12 /
L4 manifest) и проверяет позитивные и негативные сценарии, а также
контракты build-артефактов (шаблоны, токены, middleware,
pluggable progress store).

## 🗺️ Roadmap

См. `TODO.md`. Там — карта из двух треков: *Application* и
*Core*. Ближайшие шаги: `Commit H.5` (выделение `@ludus/core`
в workspace-пакет) и `Commit H.6` (`ludus build` — упаковщик,
`dist/<app>/` как deployable артефакт).
