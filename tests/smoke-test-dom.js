const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const { window } = dom;
const doc = window.document;

// 1. Список всех JS файлов, включая сгенерированный бандл данных и новые модули
const jsFiles = [
  "js/data-bundle.js",
  "js/core/state.js",
  "js/core/dataStore.js",
  "js/core/formRenderer.js",
  "js/core/validator.js",
  "js/core/progressStore.js",
  "js/utils.js",
  "js/app.js",
  "js/autotests.js" // переименованный test.js
];

const allJs = jsFiles
  .map(f => fs.readFileSync(path.join(ROOT, f), "utf8"))
  .join("\n;\n");

// 2. Настраиваем контекст (песочницу)
const sandbox = {
  window,
  document: doc,
  navigator: window.navigator,
  location: window.location,
  localStorage: {
    // Мокаем localStorage, чтобы ProgressStore не падал при тестах
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = String(value); },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
  },
  alert: () => {},
  confirm: () => true,
  prompt: () => "",
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  JSON,
  Math,
  Date,
  Set,
  Map,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  parseInt,
  parseFloat,
  isNaN,
  Event: window.Event,
  CustomEvent: window.CustomEvent
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(allJs, sandbox, { filename: "game.js" });

// Доступ к переменным из хоста
const ev = (code) => vm.runInContext(code, sandbox);

let fail = 0;
const err = (m) => { console.error("FAIL:", m); fail++; };

// 3. Запуск тестов
async function runTest() {
  try {
    // Инициализация приложения
    ev("init()");

    // Эмуляция перехода на 3-й уровень через экран выбора
    doc.getElementById("btn-to-level-select").click();
    doc.querySelector('[data-level="3"]').click();
    ev("hideModal('modal-l3-intro')");

    if (!doc.getElementById("screen-queue-l3").classList.contains("active")) {
      err("не открыт экран очереди L3");
    }

    const tickets = ev("TICKETS_L3");

    // Прогон всех тикетов
    for (const t of tickets) {
      ev(`openL3Work('${t.id}')`);
      ev("l3RequestClarify()");

      ev(`document.getElementById('card-root').value = ${JSON.stringify("причина: " + t.rootKeywords.join(", "))}`);
      ev(`document.getElementById('card-workaround').value = '${t.workaroundCorrect}'`);
      ev(`document.getElementById('card-radical').value = '${t.radicalCorrect}'`);
      ev(`document.getElementById('card-outcome').value = '${t.outcome.correct}'`);

      // Вызываем change, чтобы сработали showIf (видимость полей)
      ev(`document.getElementById('card-outcome').dispatchEvent(new Event('change', { bubbles: true }))`);

      if (t.problem) {
        ev(`
          document.querySelectorAll('.l3-prob-inc-check').forEach(c => c.checked = true);
          document.getElementById('card-impact').value = ${JSON.stringify(t.problem.impact)};
          document.getElementById('card-prob').value = ${JSON.stringify(t.problem.prob)};
          document.getElementById('card-owner').value = ${JSON.stringify(t.problem.owner)};
          document.getElementById('card-method').value = ${JSON.stringify(t.problem.method)};
          document.getElementById('card-rfc').value = (PROBLEMS.find(p => p.id === ${JSON.stringify(t.problem.record)})?.rfc) || ${JSON.stringify("исправить: " + t.rootKeywords.join(", "))};
        `);
      } else if (t.linkedProblemId) {
        ev(`document.getElementById('card-linkedProb').value = '${t.linkedProblemId}'`);
      }

      if (t.duplicateOf) {
        ev(`document.getElementById('l3-dup-of').value = '${t.duplicateOf}'`);
      }

      ev("l3Validate()");
      ev("l3Submit()");
      ev("hideModal('modal-reg')");

      const res = ev(`state.resultsL3['${t.id}']`);
      if (!res) {
        err(t.id + ": результат не сохранён");
      } else if (!res.ok) {
        err(t.id + ": эталонный ответ не прошёл. Ошибки: " + res.errs.join(", "));
        for (const c of res.comparison) {
          if (c.isError) console.error("   - " + c.field + ": " + c.value + " | нужно: " + c.expected);
        }
      }
    }

    // Проверка счетчиков
    ev("renderQueue()");
    const done = doc.getElementById("q-done-l3").textContent;
    if (done !== String(tickets.length)) {
      err(`счётчик очереди: ${done} вместо ${tickets.length}`);
    }

    // Переход к результатам
    doc.getElementById("btn-finish-l3").click();
    if (!doc.getElementById("screen-res").classList.contains("active")) {
      err("не открыт экран результатов");
    }
    const rows = doc.querySelectorAll("#res-table tbody tr").length;
    if (rows !== tickets.length) {
      err(`в итоговой таблице строк: ${rows} вместо ${tickets.length}`);
    }
    const okCount = doc.querySelectorAll("#res-table .tag.ok").length;
    console.log(`INFO: 'Успех' в итогах: ${okCount} / ${tickets.length}`);

    // Проверка реестра проблем
    ev("openProblems()");
    const probCards = doc.querySelectorAll("#problems-body > div").length;
    if (probCards !== 3) {
      err(`карточек проблем: ${probCards} вместо 3`);
    }
    ev("hideModal('modal-problems')");

    // Негативный тест
    ev("state.level = 3");
    ev(`openL3Work('TK-302')`);
    ev(`document.getElementById('card-root').value = 'неизвестно'`);
    ev(`document.getElementById('card-workaround').value = '1'`);
    ev(`document.getElementById('card-radical').value = '1'`);
    ev(`document.getElementById('card-outcome').value = 'new_problem'`);
    ev(`document.getElementById('card-outcome').dispatchEvent(new Event('change', { bubbles: true }))`);
    ev("l3Validate()");
    ev("l3Submit()");
    ev("hideModal('modal-reg')");

    const res2 = ev(`state.resultsL3['TK-302']`);
    if (!res2 || res2.errs.length < 2) {
      err(`негативный тест: сломанный ответ не пойман (errs=${res2 ? res2.errs.length : 0})`);
    }

    // Автотесты L3 (встроенные в игру)
    ev("runAutotestsL3()");
    ev("hideModal('modal-autotest')");
    const atOk = doc.querySelectorAll("#autotest-report-body .tag.ok").length;
    const atBad = doc.querySelectorAll("#autotest-report-body .tag.bad").length;
    const expectedAutotests = tickets.length * 2;
    console.log(`Автотесты L3: ${atOk} OK / ${atBad} BAD (ожидалось ${expectedAutotests} OK / 0 BAD)`);
    if (atBad > 0) {
      err(`автотесты L3 провалились: ${atBad} BAD`);
    }

    // Автотесты L1 (встроенные в игру)
    ev("runAutotests()");
    ev("hideModal('modal-autotest')");
    const l1Ok = doc.querySelectorAll("#autotest-report-body .tag.ok").length;
    const l1Bad = doc.querySelectorAll("#autotest-report-body .tag.bad").length;
    const expectedL1 = ev("TICKETS.length") * 2;
    console.log(`Автотесты L1: ${l1Ok} OK / ${l1Bad} BAD (ожидалось ${expectedL1} OK / 0 BAD)`);
    if (l1Bad > 0) {
      err(`автотесты L1 провалились: ${l1Bad} BAD`);
    }

    // Автотесты L2 (встроенные в игру)
    ev("runAutotestsL2()");
    ev("hideModal('modal-autotest')");
    const l2Ok = doc.querySelectorAll("#autotest-report-body .tag.ok").length;
    const l2Bad = doc.querySelectorAll("#autotest-report-body .tag.bad").length;
    const expectedL2 = ev("TICKETS_L2.length") * 2;
    console.log(`Автотесты L2: ${l2Ok} OK / ${l2Bad} BAD (ожидалось ${expectedL2} OK / 0 BAD)`);
    if (l2Bad > 0) {
      err(`автотесты L2 провалились: ${l2Bad} BAD`);
    }

    // --- Level manifests (D): L4 stub ---
    const l4Ids = ev("DataStore.getLevels().map(l => l.id)");
    if (!Array.isArray(l4Ids) || !l4Ids.includes(4)) {
      err("LEVELS должен содержать уровень 4 (stub)");
    }
    const l4Tickets = ev("DataStore.getTickets(4)");
    if (!Array.isArray(l4Tickets) || l4Tickets.length !== 0) {
      err("DataStore.getTickets(4) должен вернуть []");
    }
    const l4Schema = ev("DataStore.getSchema(4)");
    if (!l4Schema || !Array.isArray(l4Schema.fields) || l4Schema.fields.length !== 0) {
      err("DataStore.getSchema(4) должен вернуть {fields: []}");
    }
    const l4SchemasMap = ev("DataStore.getSchemas()");
    if (!l4SchemasMap[4]) {
      err("DataStore.getSchemas()[4] должен существовать");
    }

    console.log(fail === 0 ? "PASS: все проверки L1/L2/L3 пройдены" : `FAIL: ${fail} ошибок`);
    process.exit(fail === 0 ? 0 : 1);

  } catch (e) {
    console.error("КРИТИЧЕСКАЯ ОШИБКА ТЕСТА:", e);
    process.exit(1);
  }
}

runTest();
