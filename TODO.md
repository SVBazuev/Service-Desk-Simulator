# TODO / Roadmap проекта Service Desk Simulator

Этот файл содержит список идей и задач для дальнейшего развития симулятора.

## ✅ Сделано (Done)

☑ ## Архитектура (A, B, C, D, D.5)

- Валидация вынесена в JSON-схемы (`field.validate.rule`, Commit A).
- Рендерер поддерживает `composite`, `checkboxGroup`, `showIf` (Commit B).
- Контракт `options` унифицирован, добавлена build-time валидация (Commit B.5).
- Диагностика L3 вынесена в JSON (Commit C, *временно заменено на TemplateRenderer в D.5*).
- Внедрены манифесты уровней (Commit D). Добавлен L4-stub.
- **Commit D.5: Component Registry & Dynamic Anchors.** Удалены хардкодные ID для полей (`card-org` и т.д.). Внедрен `state.currentForm` (Registry). Смоук-тесты переведены на работу через Registry.

☑ ## Технический долг и багфиксы

Обработчик `#btn-start-l3-work` — кнопка «Приступить к работе» на L3-интро теперь закрывает модалку.

`runAutotestsL2` — исправлены id полей, убран несуществующий `fillAssigneeSelect() `.

`FormRenderer.render` — слушатели `change`/`input` вешаются на контейнер один раз (guard через `dataset.frbBound`).

`showResults` — экран результатов показывается до записи в `ProgressStore`.

`fillSelect` больше не принимает строки (только объекты `{value,label}`).

Смоук-тест покрывает L1, L2, L3 и L4-stub.

## 🔥 Высокий приоритет (Next Refactoring)

□ **Commit D.6: Naming & Contract Prep (Fast)**
  - Переименовать `workflow: "l3"` -> `"engineer"` (в `l3.json` и `l4.json`).
  - Переименовать `state.l3` -> `state.engineer`, `state.resultsL3` -> `state.resultsEngineer`.
  - Переименовать `l3Submit` -> `submitEngineer`, `l3RequestClarify` -> `requestEngineerClarify`.
  - Добавить `"template": "registrar" | "dispatcher" | "engineer"` в JSON-схемы (пока игнорируется рантаймом).
  - Добавить объект `queue` и `intro` в манифесты уровней (замена статичным ID).

□ **Commit E: Schema-Driven UI (TemplateRenderer)**
  - Создать `js/core/templateRenderer.js`.
  - Перенести рендеринг панелей (Diagnostics, Readonly, Form) из `app.js` в шаблоны.
  - Сократить `index.html` (убрать дубли `screen-work-l3`, статичные секции очередей заменить на `data-template` / `data-queue`).
  - `openWork` в `app.js` сокращается до вызова `TemplateRenderer.render()`.

□ **Commit F: Унификация очередей (QueueRenderer)**
  - Одна секция `#screen-queue` в HTML вместо `screen-queue`, `screen-queue-l2`, `screen-queue-l3`.
  - Ярлыки ("Зарегистрировано", "Решено") берутся из `level.queue.doneLabel`.
  - Удаление `queueScreen`, `queueList` из манифестов.

## ⚙️ Технический долг и архитектура (Остальное)
- Commit G: Миграция на ES-модули.
- Commit H: Рефакторинг `autotests.js` (убрать ручную сборку HTML).
- CI/CD (GitHub Actions) + ESLint.

? Восстановить декларативные tabs/actions в card-l3.json.
   В D.5 они временно заменены на hardcoded renderIncoming /
   renderDiagnostics в app.js. Вернуть data-driven подход с
   data-slot-lookup вместо getElementById (совместно с TemplateRenderer). **!?**

? Commit G: Миграция на ES-модули.
Избавиться от глобальных `var` и `window.*`. Перейти на `import/export`.
Требует внедрения сборщика (Vite или Webpack) и переписывания `smoke-test-dom.js` (отказ от `vm.runInContext` в пользу стандартных `import`).

? Commit H: Рефакторинг `autotests.js`.
Убрать ручную сборку HTML и прямые манипуляции с DOM. Перевести генерацию отчетов автотестов на использование `FormRenderer`, `Validator` и `TemplateRenderer`.

? Null-guard'ы в динамически рендерящихся обработчиках.
В `FormRenderer` и `runAutotests*` при работе с `getElementById(…)` без проверки на `null`. Ввести привычку: `const el = getElementById(...); if (!el) return;`.

? CI/CD (GitHub Actions).
Настроить автоматический запуск `npm run build` и `npm test` при каждом пуше в `main` и `develop`. Смоук-тест теперь покрывает все уровни, поэтому ценность CI высокая.

? Строгий линтинг.
Подключить ESLint и Prettier для поддержания единого стиля кода.

? Сценарии (Scenario Packs).
Возможность загружать разные наборы задач (например, «Онбординг новичка», «Продвинутый уровень: Интеграции») через выбор манифеста.

## 🎨 UI/UX Улучшения

□ Визуальная валидация полей.
Подсвечивать красным поля, которые не заполнены или заполнены неверно (сейчас просто блокируется кнопка).

□ Улучшение экрана результатов.
Добавить возможность фильтрации (показать только ошибки) и сворачивания блоков.

□ Анимации.
Добавить плавные переходы между экранами и модальными окнами.

□ Темная тема.
Добавить переключатель светлой/темной темы интерфейса.

## 📚 Контент и База знаний

□ Расширение Базы Знаний.
Добавить статьи про SLA, эскалацию и работу с конфликтными клиентами.

□ Больше задач.
Добавить больше карточек для L1 и L2, чтобы увеличить вариативность.

□ Локализация (i18n).
Подготовить возможность перевода интерфейса и задач на английский язык.

## 🚀 Высокий приоритет (Features) / Backend

□ Мультиплеер (Backend).
Добавление серверной части на Node.js (Express/Fastify) и WebSocket. Уровень 2 (Тимлид) должен иметь возможность назначать задачу реальному пользователю на Уровне 3 (Инженер).

□ Сохранение прогресса на сервере.
Замена `localStorage` на API бэкенда для кросс-устройственной синхронизации.
