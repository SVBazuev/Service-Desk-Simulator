const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const { window } = dom;
const doc = window.document;

const jsFiles = [
  "js/data-bundle.js",
  "js/core/state.js",
  "js/core/dataStore.js",
  "js/core/formRenderer.js",
  "js/core/validator.js",
  "js/core/progressStore.js",
  "js/utils.js",
  "js/core/templateRenderer.js",
  "js/core/extensions.js",
  "js/service-desk/panels.js",
  "js/service-desk/workflows.js",
  "js/service-desk/validators.js",
  "js/app.js",
  "js/autotests.js"
];

const allJs = jsFiles
  .map(f => fs.readFileSync(path.join(ROOT, f), "utf8"))
  .join("\n;\n");

const sandbox = {
  window,
  document: doc,
  navigator: window.navigator,
  location: window.location,
  localStorage: {
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

const ev = (code) => vm.runInContext(code, sandbox);

let fail = 0;
const err = (m) => { console.error("FAIL:", m); fail++; };

// Хелпер на стороне хоста: выполнить набор field-values в Registry
function applyFields(fields) {
  const json = JSON.stringify(fields);
  ev(`(function(){
    const data = ${json};
    for (const id of Object.keys(data)) {
      const el = state.currentForm && state.currentForm.fields[id];
      if (!el) continue;
      el.value = data[id];
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })();`);
}

function checkIncidents(all) {
  ev(`(function(){
    const list = state.currentForm && state.currentForm.slots && state.currentForm.slots.incidents;
    if (!list) return;
    list.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = ${all ? 'true' : 'false'});
  })();`);
}

function setDup(value) {
  ev(`(function(){
    const el = document.querySelector('[data-slot="dup-select"]');
    if (el) el.value = ${JSON.stringify(value)};
  })();`);
}

async function runTest() {
  try {
    ev("init()");

    doc.getElementById("btn-to-level-select").click();
    doc.querySelector('[data-level="3"]').click();
    ev("hideModal('modal-intro')");

    if (!doc.getElementById("screen-queue").classList.contains("active")) {
      err("не открыт экран очереди L3");
    }

    const tickets = ev("TICKETS_L3");

    // Прогон всех тикетов L3
    for (const t of tickets) {
      ev(`openWork('${t.id}')`);
      ev("requestEngineerClarify()");

      applyFields({
        root: "причина: " + t.rootKeywords.join(", "),
        workaround: String(t.workaroundCorrect),
        radical: String(t.radicalCorrect),
        outcome: t.outcome.correct
      });

      if (t.problem) {
        checkIncidents(true);
        const rfcText = (ev(`(PROBLEMS.find(p => p.id === ${JSON.stringify(t.problem.record)}) || {}).rfc`))
          || ("исправить: " + t.rootKeywords.join(", "));
        applyFields({
          impact: t.problem.impact,
          prob: t.problem.prob,
          owner: t.problem.owner,
          method: t.problem.method,
          rfc: rfcText
        });
      } else if (t.linkedProblemId) {
        applyFields({ linkedProb: t.linkedProblemId });
      }

      if (t.duplicateOf) setDup(t.duplicateOf);

      ev("validateCurrentForm()");
      ev("submitEngineer()");
      ev("hideModal('modal-reg')");

      const res = ev(`state.resultsEngineer['${t.id}']`);
      if (!res) {
        err(t.id + ": результат не сохранён");
      } else if (!res.ok) {
        err(t.id + ": эталонный ответ не прошёл. Ошибки: " + res.errs.join(", "));
        for (const c of res.comparison) {
          if (c.isError) console.error("   - " + c.field + ": " + c.value + " | нужно: " + c.expected);
        }
      }
    }

    // Счётчик
    ev("renderQueue()");
    const done = doc.querySelector("[data-queue-done]").textContent;
    if (done !== String(tickets.length)) {
      err(`счётчик очереди: ${done} вместо ${tickets.length}`);
    }

    // Итоги
    doc.querySelector("[data-queue-finish]").click();
    if (!doc.getElementById("screen-res").classList.contains("active")) {
      err("не открыт экран результатов");
    }
    const rows = doc.querySelectorAll("#res-table tbody tr").length;
    if (rows !== tickets.length) {
      err(`в итоговой таблице строк: ${rows} вместо ${tickets.length}`);
    }
    const okCount = doc.querySelectorAll("#res-table .tag.ok").length;
    console.log(`INFO: 'Успех' в итогах: ${okCount} / ${tickets.length}`);

    // Проблемы
    ev("openProblems()");
    const probCards = doc.querySelectorAll("#problems-body > div").length;
    if (probCards !== 3) {
      err(`карточек проблем: ${probCards} вместо 3`);
    }
    ev("hideModal('modal-problems')");

    // Негативный тест L3
    ev("state.level = 3");
    ev(`openWork('TK-302')`);
    applyFields({
      root: "неизвестно",
      workaround: "1",
      radical: "1",
      outcome: "new_problem"
    });
    ev("validateCurrentForm()");
    ev("submitEngineer()");
    ev("hideModal('modal-reg')");

    const res2 = ev(`state.resultsEngineer['TK-302']`);
    if (!res2 || res2.errs.length < 2) {
      err(`негативный тест: сломанный ответ не пойман (errs=${res2 ? res2.errs.length : 0})`);
    }

    // Встроенные автотесты L3
    ev("runAutotestsEngineer()");
    ev("hideModal('modal-autotest')");
    const atOk = doc.querySelectorAll("#autotest-report-body .tag.ok").length;
    const atBad = doc.querySelectorAll("#autotest-report-body .tag.bad").length;
    const expectedAutotests = tickets.length * 2;
    console.log(`Автотесты L3: ${atOk} OK / ${atBad} BAD (ожидалось ${expectedAutotests} OK / 0 BAD)`);
    if (atBad > 0) err(`автотесты L3 провалились: ${atBad} BAD`);

    // Автотесты L1
    ev("runAutotests()");
    ev("hideModal('modal-autotest')");
    const l1Ok = doc.querySelectorAll("#autotest-report-body .tag.ok").length;
    const l1Bad = doc.querySelectorAll("#autotest-report-body .tag.bad").length;
    const expectedL1 = ev("TICKETS.length") * 2;
    console.log(`Автотесты L1: ${l1Ok} OK / ${l1Bad} BAD (ожидалось ${expectedL1} OK / 0 BAD)`);
    if (l1Bad > 0) err(`автотесты L1 провалились: ${l1Bad} BAD`);

    // Автотесты L2
    ev("runAutotestsL2()");
    ev("hideModal('modal-autotest')");
    const l2Ok = doc.querySelectorAll("#autotest-report-body .tag.ok").length;
    const l2Bad = doc.querySelectorAll("#autotest-report-body .tag.bad").length;
    const expectedL2 = ev("TICKETS_L2.length") * 2;
    console.log(`Автотесты L2: ${l2Ok} OK / ${l2Bad} BAD (ожидалось ${expectedL2} OK / 0 BAD)`);
    if (l2Bad > 0) err(`автотесты L2 провалились: ${l2Bad} BAD`);

    // L4 manifest
    const l4Ids = ev("DataStore.getLevels().map(l => l.id)");
    if (!Array.isArray(l4Ids) || !l4Ids.includes(4)) {
      err("LEVELS должен содержать уровень 4");
    }
    const l4Tickets = ev("DataStore.getTickets(4)");
    if (!Array.isArray(l4Tickets) || l4Tickets.length !== 1) {
      err("DataStore.getTickets(4) должен вернуть 1 тикет");
    }
    const l4Schema = ev("DataStore.getSchema(4)");
    if (!l4Schema || !Array.isArray(l4Schema.fields) || l4Schema.fields.length !== 2) {
      err("DataStore.getSchema(4) должен вернуть {fields: [2 поля]}");
    }
    const l4SchemasMap = ev("DataStore.getSchemas()");
    if (!l4SchemasMap[4]) {
      err("DataStore.getSchemas()[4] должен существовать");
    }
    console.log(`L4 (manifest): tickets=${l4Tickets.length}, fields=${l4Schema.fields.length} — OK`);

    console.log(fail === 0 ? "PASS: все проверки L1/L2/L3 + L4-manifest пройдены" : `FAIL: ${fail} ошибок`);
    process.exit(fail === 0 ? 0 : 1);

  } catch (e) {
    console.error("КРИТИЧЕСКАЯ ОШИБКА ТЕСТА:", e);
    process.exit(1);
  }
}

runTest();
