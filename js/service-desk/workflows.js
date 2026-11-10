/**
 * workflows.js — Service Desk workflow descriptors, readonly blocks,
 * widgets, state slots, and helpers that operate on them.
 */
import { Extension } from "../core/extensions.js";
import { TemplateRenderer } from "../core/templateRenderer.js";
import { DataStore } from "../core/dataStore.js";
import { State } from "../core/state.js";
import { q, getOrg, getOrgVersions, calcPriority } from "../utils.js";
import { validateCurrentForm } from "./app/forms.js";

Extension.registerWorkflow("registrar", {
  panels: [
    { kind: "incoming" },
    { kind: "form",
      title: "Карточка обращения",
      readonly: "registrar",
      after: ["versions", "prio-hint", "auto-calc"],
      submitLabel: "Зарегистрировать" }
  ]
});

Extension.registerWorkflow("dispatcher", {
  panels: [
    { kind: "incoming" },
    { kind: "form",
      title: "Карточка обращения",
      readonly: "dispatcher",
      after: ["versions", "auto-calc"],
      submitLabel: "Изменить ответственного" }
  ]
});

Extension.registerWorkflow("engineer", {
  panels: [
    { kind: "incoming" },
    { kind: "diagnostics" },
    { kind: "form",
      title: "Карточка решения",
      readonly: "engineer",
      after: [],
      submitLabel: "Закрыть обращение" }
  ]
});

Extension.registerReadonly("registrar", function(ticket) {
  const grid = document.createElement("div");
  grid.className = "ro-grid";
  grid.style.marginBottom = "12px";
  grid.innerHTML = `
    <div class="ro-row"><span class="ro-key">Номер</span><span class="ro-val">${TemplateRenderer._esc(ticket.id)}</span></div>
    <div class="ro-row"><span class="ro-key">Ответственный</span><span class="ro-val">текущий регистратор</span></div>
    <div class="ro-row"><span class="ro-key">Состояние обращения</span><span class="ro-val">регистрация</span></div>
    <div class="ro-row"><span class="ro-key">Код закрытия</span><span class="ro-val"></span></div>`;
  return grid;
});

Extension.registerReadonly("dispatcher", function(ticket) {
  const grid = document.createElement("div");
  grid.className = "ro-grid";
  grid.style.marginBottom = "12px";
  grid.innerHTML = `
    <div class="ro-row"><span class="ro-key">Номер</span><span class="ro-val">${TemplateRenderer._esc(ticket.id)}</span></div>
    <div class="ro-row"><span class="ro-key">Ответственный</span><span class="ro-val">Тимлид команды Бета</span></div>
    <div class="ro-row"><span class="ro-key">Состояние обращения</span><span class="ro-val">регистрация</span></div>
    <div class="ro-row"><span class="ro-key">Код закрытия</span><span class="ro-val"></span></div>`;
  return grid;
});

Extension.registerReadonly("engineer", function(ticket) {
  const m = calcPriority(ticket.imp, ticket.urg);
  const grid = document.createElement("div");
  grid.className = "ro-grid";
  grid.style.marginBottom = "12px";
  grid.innerHTML = `
    <div class="ro-row"><span class="ro-key">Номер обращения</span><span class="ro-val">${TemplateRenderer._esc(ticket.id)}</span></div>
    <div class="ro-row"><span class="ro-key">Продукт / версия</span><span class="ro-val">${TemplateRenderer._esc(ticket.ver)}</span></div>
    <div class="ro-row"><span class="ro-key">Срочность / Важность</span><span class="ro-val">${TemplateRenderer._esc(ticket.imp)} / ${TemplateRenderer._esc(ticket.urg)}</span></div>
    <div class="ro-row"><span class="ro-key">SLA: реакция / решение</span><span class="ro-val">${m ? TemplateRenderer._esc(m.react + " / " + m.sol) : "-"}</span></div>`;
  return grid;
});

Extension.registerWidget("versions", function(ticket, context, result) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "12px";
  wrap.innerHTML = `
    <label class="form-field full">
      <span class="form-label">Продукты и версии</span>
      <div data-slot="ver-list" class="ver-list"></div>
      <div class="ver-add-wrap">
        <div class="ver-add-title">Добавить продукт</div>
        <div class="ver-add-row">
          <select data-slot="add-prod-select"></select>
          <button type="button" data-action="add-prod" class="btn">Добавить продукт</button>
        </div>
      </div>
    </label>`;
  return wrap;
});

Extension.registerWidget("prio-hint", function(ticket, context, result) {
  const hint = document.createElement("div");
  hint.className = "prio-hint";
  hint.dataset.slot = "prio-hint";
  hint.style.display = "none";
  hint.innerHTML = `<b>Внимание:</b> Для «Запрос на обслуживание» и «Консультация» по умолчанию устанавливается средний приоритет. Измените вручную, если заказчик указал срочность.`;
  return hint;
});

Extension.registerWidget("auto-calc", function(ticket, context, result) {
  const auto = document.createElement("div");
  auto.className = "auto-box";
  auto.innerHTML = `
    <div class="auto-title">Автоматический расчёт</div>
    <div class="auto-grid">
      <div class="auto-item"><div class="auto-l">Приоритет</div><div class="auto-v" data-auto="prio">-</div></div>
      <div class="auto-item"><div class="auto-l">Срок реакции</div><div class="auto-v" data-auto="react">-</div></div>
      <div class="auto-item"><div class="auto-l">Время решения</div><div class="auto-v" data-auto="sol">-</div></div>
    </div>`;
  return auto;
});

Extension.registerSlot("orgVersions", []);
Extension.registerSlot("engineer", { requestedClarify: false, clarified: false, diagOpen: null });

export function renderVerList() {
  const list = q('[data-slot="ver-list"]');
  if (!list) return;
  list.innerHTML = "";
  if (!State.orgVersions || State.orgVersions.length === 0) {
    list.innerHTML = "<div style='color:var(--sub);font-size:13px'>Нет данных</div>";
    renderAddProdSelect();
    return;
  }
  for (const v of State.orgVersions) {
    const row = document.createElement("div");
    row.className = "ver-row";
    row.innerHTML = `<div class="ver-name">${v.name}</div><select data-ver-id="${v.id}"><option value="${v.ver}">${v.ver}</option></select><button class="ver-del" data-del-id="${v.id}">×</button>`;
    list.appendChild(row);
  }
  list.querySelectorAll(".ver-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const idv = parseInt(btn.getAttribute("data-del-id"));
      State.orgVersions = State.orgVersions.filter(x => x.id !== idv);
      renderVerList();
      validateCurrentForm();
    });
  });
  renderAddProdSelect();
}

export function renderAddProdSelect() {
  const sel = q('[data-slot="add-prod-select"]');
  if (!sel) return;
  const added = new Set((State.orgVersions || []).map(v => v.name));
  const orgField = State.currentForm && State.currentForm.fields.org;
  const org = getOrg(orgField ? orgField.value : "");
  const full = getOrgVersions(org);
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = ""; def.textContent = "Выберите продукт из справочника"; sel.appendChild(def);
  for (const p of full) {
    if (!added.has(p.name)) {
      const opt = document.createElement("option");
      opt.value = p.name; opt.textContent = p.name + " " + p.ver; sel.appendChild(opt);
    }
  }
  const btn = q('[data-action="add-prod"]');
  if (btn) btn.disabled = (sel.options.length <= 1);
}

export function addProductToCard() {
  const sel = q('[data-slot="add-prod-select"]');
  if (!sel) return;
  const name = sel.value; if (!name) return;
  const orgField = State.currentForm && State.currentForm.fields.org;
  const org = getOrg(orgField ? orgField.value : "");
  const full = getOrgVersions(org);
  const p = full.find(x => x.name === name);
  if (!p || State.orgVersions.some(v => v.name === p.name)) return;
  State.orgVersions.push({ id: Date.now(), name: p.name, ver: p.ver });
  renderVerList();
  validateCurrentForm();
}

export function updateAutoCalc(registry) {
  if (!registry.fields.imp || !registry.fields.urg) return;
  const m = calcPriority(registry.fields.imp.value, registry.fields.urg.value);
  const prio = q('[data-auto="prio"]');
  const react = q('[data-auto="react"]');
  const sol = q('[data-auto="sol"]');
  if (prio) prio.textContent = m ? m.prio : "-";
  if (react) react.textContent = m ? m.react : "-";
  if (sol) sol.textContent = m ? m.sol : "-";
}
