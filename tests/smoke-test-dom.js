import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const dom = new JSDOM(html, { url: "http://localhost/" });

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const { State } = await import("../js/core/state.js");
const { ProgressStore } = await import("../js/core/progressStore.js");
const { Extension } = await import("../js/core/extensions.js");
const { init } = await import("../js/service-desk/app/init.js");
const { submitLevel } = await import("../js/service-desk/app/submits.js");
const { openWork, renderQueue } = await import("../js/service-desk/app/router.js");
const { requestEngineerClarify, validateCurrentForm } = await import("../js/service-desk/app/forms.js");
const { runAutotests, runAutotestsL2, runAutotestsEngineer } = await import("../js/autotests.js");
const { hideModal } = await import("../js/utils.js");
const bundle = await import("../js/data-bundle.js");
const { DataStore } = await import("../js/core/dataStore.js");

let fail = 0;
const err = (m) => { console.error("FAIL:", m); fail++; };

function applyFields(fields) {
  for (const id of Object.keys(fields)) {
    const el = State.currentForm && State.currentForm.fields[id];
    if (!el) continue;
    el.value = fields[id];
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function checkIncidents(all) {
  const list = State.currentForm && State.currentForm.slots && State.currentForm.slots.incidents;
  if (!list) return;
  list.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = !!all; });
}

function setDup(value) {
  const el = document.querySelector('[data-slot="dup-select"]');
  if (el) el.value = value;
}

try {
  init();

  document.getElementById("btn-to-level-select").click();
  document.querySelector('[data-level="3"]').click();
  hideModal("modal-intro");

  if (!document.getElementById("screen-queue").classList.contains("active")) {
    err("не открыт экран очереди L3");
  }

  const tickets = bundle.TICKETS_L3;

  for (const t of tickets) {
    openWork(t.id);
    requestEngineerClarify();

    applyFields({
      root: "причина: " + t.rootKeywords.join(", "),
      workaround: String(t.workaroundCorrect),
      radical: String(t.radicalCorrect),
      outcome: t.outcome.correct
    });

    if (t.problem) {
      checkIncidents(true);
      const rfcText = (bundle.PROBLEMS.find(p => p.id === t.problem.record) || {}).rfc
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

    validateCurrentForm();
    submitLevel();
    hideModal("modal-reg");

    const res = State.resultsEngineer[t.id];
    if (!res) {
      err(t.id + ": результат не сохранён");
    } else if (!res.ok) {
      err(t.id + ": эталонный ответ не прошёл. Ошибки: " + res.errs.join(", "));
      for (const c of res.comparison) {
        if (c.isError) console.error("   - " + c.field + ": " + c.value + " | нужно: " + c.expected);
      }
    }
  }

  renderQueue();
  const done = document.querySelector("[data-queue-done]").textContent;
  if (done !== String(tickets.length)) {
    err(`счётчик очереди: ${done} вместо ${tickets.length}`);
  }

  document.querySelector("[data-queue-finish]").click();
  if (!document.getElementById("screen-res").classList.contains("active")) {
    err("не открыт экран результатов");
  }
  const rows = document.querySelectorAll("#res-table tbody tr").length;
  if (rows !== tickets.length) {
    err(`в итоговой таблице строк: ${rows} вместо ${tickets.length}`);
  }
  const okCount = document.querySelectorAll("#res-table .tag.ok").length;
  console.log(`INFO: 'Успех' в итогах: ${okCount} / ${tickets.length}`);

  document.querySelector('[data-close="modal-problems"]')?.click();
  const { openProblems } = await import("../js/service-desk/app/reference.js");
  openProblems();
  const probCards = document.querySelectorAll("#problems-body > div").length;
  if (probCards !== 3) {
    err(`карточек проблем: ${probCards} вместо 3`);
  }
  hideModal("modal-problems");

  State.level = 3;
  openWork('TK-302');
  applyFields({
    root: "неизвестно",
    workaround: "1",
    radical: "1",
    outcome: "new_problem"
  });
  validateCurrentForm();
  submitLevel();
  hideModal("modal-reg");

  const res2 = State.resultsEngineer['TK-302'];
  if (!res2 || res2.errs.length < 2) {
    err(`негативный тест: сломанный ответ не пойман (errs=${res2 ? res2.errs.length : 0})`);
  }

  runAutotestsEngineer();
  hideModal("modal-autotest");
  const atOk = document.querySelectorAll("#autotest-report-body .tag.ok").length;
  const atBad = document.querySelectorAll("#autotest-report-body .tag.bad").length;
  const expectedAutotests = tickets.length * 2;
  console.log(`Автотесты L3: ${atOk} OK / ${atBad} BAD (ожидалось ${expectedAutotests} OK / 0 BAD)`);
  if (atBad > 0) err(`автотесты L3 провалились: ${atBad} BAD`);

  runAutotests();
  hideModal("modal-autotest");
  const l1Ok = document.querySelectorAll("#autotest-report-body .tag.ok").length;
  const l1Bad = document.querySelectorAll("#autotest-report-body .tag.bad").length;
  const expectedL1 = bundle.TICKETS.length * 2;
  console.log(`Автотесты L1: ${l1Ok} OK / ${l1Bad} BAD (ожидалось ${expectedL1} OK / 0 BAD)`);
  if (l1Bad > 0) err(`автотесты L1 провалились: ${l1Bad} BAD`);

  runAutotestsL2();
  hideModal("modal-autotest");
  const l2Ok = document.querySelectorAll("#autotest-report-body .tag.ok").length;
  const l2Bad = document.querySelectorAll("#autotest-report-body .tag.bad").length;
  const expectedL2 = bundle.TICKETS_L2.length * 2;
  console.log(`Автотесты L2: ${l2Ok} OK / ${l2Bad} BAD (ожидалось ${expectedL2} OK / 0 BAD)`);
  if (l2Bad > 0) err(`автотесты L2 провалились: ${l2Bad} BAD`);

  // G.1b: middleware — audit log grows on every submit
  State.level = 3;
  openWork('TK-302');
  requestEngineerClarify();
  applyFields({
    root: "объем данных, таймаут, индекс",
    workaround: "0",
    radical: "0",
    outcome: "resolved"
  });
  const mwLogBefore = State.submitLog.length;
  submitLevel();
  hideModal("modal-reg");
  const mwLogAfter = State.submitLog.length;
  if (mwLogAfter !== mwLogBefore + 1) {
    err(`middleware: submitLog ${mwLogBefore} -> ${mwLogAfter} (expected +1)`);
  }
  const lastMwLog = State.submitLog[State.submitLog.length - 1];
  if (!lastMwLog || lastMwLog.ticketId !== "TK-302") {
    err(`middleware: last log ticketId=${lastMwLog && lastMwLog.ticketId}, expected TK-302`);
  }
  if (lastMwLog.level !== 3 || lastMwLog.workflow !== "engineer") {
    err(`middleware: level/workflow mismatch: ${lastMwLog.level}/${lastMwLog.workflow}`);
  }
  console.log("G.1b middleware: audit log populated — OK");

  // G.1c: pluggable ProgressStore — mock overrides default
  const __progressCalls__ = [];
  Extension.setProgressStore({
    load: (l) => { __progressCalls__.push(['load', l]); return null; },
    save: (l, s) => { __progressCalls__.push(['save', l, !!(s && s.level === l)]); },
    reset: () => { __progressCalls__.push(['reset']); },
    getSummary: () => {
      __progressCalls__.push(['getSummary']);
      return { level1: null, level2: null, level3: null };
    }
  });

  try {
    Extension.setProgressStore({});
    err("G.1c: setProgressStore({}) should throw");
  } catch (e) { /* expected */ }

  try {
    Extension.setProgressStore({ load: function(){}, save: function(){} });
    err("G.1c: setProgressStore missing methods should throw");
  } catch (e) { /* expected */ }

  const { startLevel, renderLevelCards } = await import("../js/service-desk/app/levels.js");

  __progressCalls__.length = 0;
  startLevel(3);
  hideModal("modal-intro");
  if (!__progressCalls__.some(c => c[0] === 'load' && c[1] === 3)) {
    err("G.1c: startLevel(3) didn't call store.load(3)");
  }

  __progressCalls__.length = 0;
  openWork('TK-302');
  requestEngineerClarify();
  applyFields({
    root: "объем данных, таймаут, индекс",
    workaround: "0",
    radical: "0",
    outcome: "resolved"
  });
  submitLevel();
  hideModal("modal-reg");
  if (!__progressCalls__.some(c => c[0] === 'save' && c[1] === 3 && c[2] === true)) {
    err("G.1c: submitLevel didn't call store.save(3, snapshot with level=3)");
  }

  __progressCalls__.length = 0;
  renderLevelCards();
  if (!__progressCalls__.some(c => c[0] === 'getSummary')) {
    err("G.1c: renderLevelCards didn't call store.getSummary()");
  }

  Extension.setProgressStore(null);
  if (Extension.getProgressStore() !== ProgressStore) {
    err("G.1c: setProgressStore(null) should restore default ProgressStore");
  }

  console.log("G.1c progressStore: pluggable store — OK");

  // L4 manifest
  const l4Ids = DataStore.getLevels().map(l => l.id);
  if (!Array.isArray(l4Ids) || !l4Ids.includes(4)) {
    err("LEVELS должен содержать уровень 4");
  }
  const l4Tickets = DataStore.getTickets(4);
  if (!Array.isArray(l4Tickets) || l4Tickets.length !== 1) {
    err("DataStore.getTickets(4) должен вернуть 1 тикет");
  }
  const l4Schema = DataStore.getSchema(4);
  if (!l4Schema || !Array.isArray(l4Schema.fields) || l4Schema.fields.length !== 2) {
    err("DataStore.getSchema(4) должен вернуть {fields: [2 поля]}");
  }
  const l4SchemasMap = DataStore.getSchemas();
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
