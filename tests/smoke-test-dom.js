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

const { State } = await import("@ludus/core/js/state.js");
const { DataStore } = await import("@ludus/core/js/dataStore.js");
const { Extension } = await import("@ludus/core/js/extensions.js");
const { ProgressStore } = await import("@ludus/core/js/progressStore.js");
const { TemplateRenderer } = await import("@ludus/core/js/templateRenderer.js");
const { init } = await import("../js/service-desk/app/init.js");
const { submitLevel } = await import("../js/service-desk/app/submits.js");
const { openWork, renderQueue } = await import("../js/service-desk/app/router.js");
const { requestEngineerClarify, validateCurrentForm } = await import("../js/service-desk/app/forms.js");
const { runAutotests, runAutotestsL2, runAutotestsEngineer } = await import("../js/autotests.js");
const { hideModal } = await import("../js/utils.js");
const bundle = await import("../build/data.js");

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

  // H.3a: templates + binder
  if (!TemplateRenderer._templateSources["ro-registrar"]) {
    err("H.3a: ro-registrar template not registered from build artifact");
  }
  if (!TemplateRenderer._templateSources["panel"]) {
    err("H.3a: panel template not registered from build artifact");
  }

  TemplateRenderer.registerTemplates({
    "h3-test": '<div class="wrap"><span data-slot="label" hidden></span><a data-slot="link" href="#" data-x="a">x</a></div>'
  });

  // slots: string
  const frag1 = TemplateRenderer.bind("h3-test", {
    slots: { label: "hello", link: "go" }
  });
  if (frag1.firstElementChild.querySelector('[data-slot="label"]').textContent !== "hello") {
    err("H.3a: slots string not applied");
  }
  if (frag1.firstElementChild.querySelector('[data-slot="link"]').textContent !== "go") {
    err("H.3a: slots on <a> not applied");
  }

  // show: true removes hidden
  const frag2 = TemplateRenderer.bind("h3-test", { show: { label: true } });
  if (frag2.firstElementChild.querySelector('[data-slot="label"]').hidden !== false) {
    err("H.3a: show:true should remove hidden");
  }
  // show: false sets hidden
  const frag2b = TemplateRenderer.bind("h3-test", { show: { label: false } });
  if (frag2b.firstElementChild.querySelector('[data-slot="label"]').hidden !== true) {
    err("H.3a: show:false should set hidden");
  }

  // attrs
  const frag3 = TemplateRenderer.bind("h3-test", {
    attrs: { link: { "data-x": "b", "href": "/new" } }
  });
  const link3 = frag3.firstElementChild.querySelector('[data-slot="link"]');
  if (link3.getAttribute("data-x") !== "b") err("H.3a: attrs data-x");
  if (link3.getAttribute("href") !== "/new") err("H.3a: attrs href");

  // slots: { html }
  const frag4 = TemplateRenderer.bind("h3-test", {
    slots: { label: { html: "<b>bold</b>" } }
  });
  if (!frag4.firstElementChild.querySelector('[data-slot="label"]').innerHTML.includes("<b>bold</b>")) {
    err("H.3a: slots {html} not applied");
  }

  // unknown template throws
  try {
    TemplateRenderer.bind("nonexistent-h3a");
    err("H.3a: bind on unknown template should throw");
  } catch (e) { /* expected */ }

  // clone — два вызова дают независимые фрагменты
  const fragA = TemplateRenderer.bind("h3-test", { slots: { label: "A" } });
  const fragB = TemplateRenderer.bind("h3-test", { slots: { label: "B" } });
  if (fragA.firstElementChild.querySelector('[data-slot="label"]').textContent !== "A") {
    err("H.3a: clone A");
  }
  if (fragB.firstElementChild.querySelector('[data-slot="label"]').textContent !== "B") {
    err("H.3a: clone B");
  }

  // bindElement — ровно один корень
  const singleEl = TemplateRenderer.bindElement("h3-test");
  if (!singleEl || singleEl.tagName !== "DIV") err("H.3a: bindElement root");

  // bindElement на multi-root → throws (registerTemplates с одним корнем, поэтому
  // проверяем через invalid-шаблон)
  TemplateRenderer.registerTemplates({
    "h3-multi": '<div></div><div></div>'
  });
  try {
    TemplateRenderer.bindElement("h3-multi");
    err("H.3a: bindElement on multi-root should throw");
  } catch (e) { /* expected */ }

  console.log("H.3a templates: binder + registerTemplates — OK");

  // H.3b: widgets templates
  for (const id of ["widget-versions", "widget-prio-hint", "widget-auto-calc"]) {
    if (!TemplateRenderer._templateSources[id]) {
      err(`H.3b: ${id} template not registered from build artifact`);
    }
  }

  // widget-auto-calc — статичный, без слотов; bindElement даёт .auto-box
  const autoEl = TemplateRenderer.bindElement("widget-auto-calc");
  if (!autoEl.classList.contains("auto-box")) {
    err("H.3b: widget-auto-calc root should be .auto-box");
  }
  if (!autoEl.querySelector('[data-auto="prio"]')) {
    err("H.3b: widget-auto-calc missing data-auto=prio");
  }
  if (!autoEl.querySelector('[data-auto="react"]')) {
    err("H.3b: widget-auto-calc missing data-auto=react");
  }
  if (!autoEl.querySelector('[data-auto="sol"]')) {
    err("H.3b: widget-auto-calc missing data-auto=sol");
  }

  // widget-prio-hint — корень имеет data-slot="prio-hint"
  const hintEl = TemplateRenderer.bindElement("widget-prio-hint");
  if (hintEl.getAttribute("data-slot") !== "prio-hint") {
    err("H.3b: widget-prio-hint root should be [data-slot=prio-hint]");
  }
  if (!hintEl.hasAttribute("style") || !hintEl.getAttribute("style").includes("display:none")) {
    err("H.3b: widget-prio-hint should default hidden");
  }

  // widget-versions — контракты renderVerList
  const versionsEl = TemplateRenderer.bindElement("widget-versions");
  if (!versionsEl.querySelector('[data-slot="ver-list"]')) {
    err("H.3b: widget-versions missing data-slot=ver-list");
  }
  if (!versionsEl.querySelector('[data-slot="add-prod-select"]')) {
    err("H.3b: widget-versions missing data-slot=add-prod-select");
  }
  if (!versionsEl.querySelector('[data-action="add-prod"]')) {
    err("H.3b: widget-versions missing data-action=add-prod");
  }

  console.log("H.3b templates: widgets — OK");

  // H.3c: panels templates
  for (const id of ["panel-incoming", "panel-diagnostics"]) {
    if (!TemplateRenderer._templateSources[id]) {
      err(`H.3c: ${id} template not registered`);
    }
  }

  // panel-incoming — все контрактные слоты присутствуют в шаблоне
  const incEl = TemplateRenderer.bindElement("panel-incoming", {
    slots: { kv: { html: "" }, text: "", "dup-select": { html: "" }, "clarify-btn": "" },
    show: { "clarify-wrap": false, "clarify-block": false }
  });
  for (const slot of ["kv", "text", "dup-block", "dup-link", "dup-select", "dup-hint",
                      "clarify-wrap", "clarify-btn", "clarify-block", "clarify-text"]) {
    if (!incEl.querySelector(`[data-slot="${slot}"]`)) {
      err(`H.3c: panel-incoming missing [data-slot=${slot}]`);
    }
  }

  // panel-diagnostics — контракты и #diag-tabs id
  const diagEl = TemplateRenderer.bindElement("panel-diagnostics");
  if (!diagEl.querySelector("[data-slot='diag-tabs']")) err("H.3c: diag-tabs slot missing");
  if (!diagEl.querySelector("[data-slot='diag-title']")) err("H.3c: diag-title slot missing");
  if (!diagEl.querySelector("[data-slot='diag-content']")) err("H.3c: diag-content slot missing");
  if (!diagEl.querySelector("[id='diag-tabs']")) err("H.3c: #diag-tabs id missing");

  console.log("H.3c templates: panels — OK");

  // H.4: CSS artifact — tokens in :root, source rules inside @layer
  const cssPath = path.join(ROOT, "build/ludus.css");
  if (!fs.existsSync(cssPath)) {
    err("H.4: build/ludus.css not built");
  } else {
    const cssText = fs.readFileSync(cssPath, "utf8");
    if (!/:root\s*\{/.test(cssText)) {
      err("H.4: build/ludus.css missing :root block");
    }
    if (!cssText.includes("--bg: #f6f7f9")) {
      err("H.4: build/ludus.css missing --bg token");
    }
    if (!cssText.includes("--primary: #2563eb")) {
      err("H.4: build/ludus.css missing --primary token");
    }
    if (!/@layer\s+ludus\.components\s*\{/.test(cssText)) {
      err("H.4: build/ludus.css missing @layer ludus.components");
    }
    // Token block must precede the layer block: theme tokens
    // are the sole source of visual values; @layer only holds
    // rules that consume them.
    const rootIdx = cssText.indexOf(":root");
    const layerIdx = cssText.indexOf("@layer ludus.components");
    if (rootIdx === -1 || layerIdx === -1 || rootIdx > layerIdx) {
      err("H.4: :root must precede @layer ludus.components");
    }
  }

  // H.4: source css has no :root (single source of truth)
  const sourceCss = fs.readFileSync(path.join(ROOT, "css/style.css"), "utf8");
  if (/:root\s*\{/.test(sourceCss)) {
    err("H.4: css/style.css contains :root — tokens must live only in themes/default.json");
  }

  console.log("H.4 css: tokens + layer — OK");

  // H.6: packaged deployable under dist/<app>/
  const appDist = path.join(ROOT, "dist", "service-desk-simulator");
  if (!fs.existsSync(appDist)) {
    err("H.6: dist/service-desk-simulator not built");
  } else {
    const required = [
      "index.html",
      "build/data.js",
      "build/ludus-templates.js",
      "build/ludus.css",
      "js/app.js",
      "js/utils.js",
      "js/autotests.js",
      "js/service-desk/app/init.js",
      "packages/@ludus/js/state.js",
      "packages/@ludus/js/dataStore.js",
      "packages/@ludus/js/templateRenderer.js"
    ];
    for (const rel of required) {
      const abs = path.join(appDist, rel);
      if (!fs.existsSync(abs)) {
        err(`H.6: packaged file missing: ${rel}`);
      }
    }

    // index.html in the package must reference the packaged CSS,
    // the module entry, and expose the @ludus/core import map.
    const pkgIndex = fs.readFileSync(path.join(appDist, "index.html"), "utf8");
    if (!pkgIndex.includes('href="build/ludus.css"')) {
      err("H.6: packaged index.html must reference build/ludus.css");
    }
    if (!pkgIndex.includes('type="module"')) {
      err("H.6: packaged index.html must have type=\"module\" entry");
    }
    if (!pkgIndex.includes('type="importmap"')) {
      err("H.6: packaged index.html must include importmap");
    }
    if (!pkgIndex.includes('"@ludus/core/js/": "./packages/@ludus/js/"')) {
      err("H.6: packaged importmap must map @ludus/core/js/ → ./packages/@ludus/js/");
    }

    // Data artifact is ESM with named exports, not a var bundle.
    const pkgData = fs.readFileSync(path.join(appDist, "build", "data.js"), "utf8");
    if (!pkgData.includes("export const ORGS")) {
      err("H.6: packaged data.js must export ORGS");
    }

    // Templates artifact carries the same count as the source build.
    const pkgTemplates = fs.readFileSync(path.join(appDist, "build", "ludus-templates.js"), "utf8");
    const tplCount = (pkgTemplates.match(/^\s+"[^"]+":\s+"/gm) || []).length;
    if (tplCount < 11) {
      err(`H.6: packaged ludus-templates.js expected ≥11 templates, found ${tplCount}`);
    }

    // CSS artifact: tokens + layer, same invariant as H.4.
    const pkgCss = fs.readFileSync(path.join(appDist, "build", "ludus.css"), "utf8");
    if (!/:root\s*\{/.test(pkgCss) || !/@layer\s+ludus\.components\s*\{/.test(pkgCss)) {
      err("H.6: packaged ludus.css missing :root or @layer ludus.components");
    }
  }

  // H.6: ludus.config.json is valid and its output path is the one we check.
  const ludusConfig = JSON.parse(
    fs.readFileSync(path.join(ROOT, "ludus.config.json"), "utf8")
  );
  if (ludusConfig.output !== "dist/service-desk-simulator") {
    err(`H.6: ludus.config.json output expected "dist/service-desk-simulator", got "${ludusConfig.output}"`);
  }
  if (!ludusConfig.app || !ludusConfig.app.entry) {
    err("H.6: ludus.config.json missing app.entry");
  }

  console.log("H.6 packager: dist/service-desk-simulator — OK");

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
