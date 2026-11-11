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
  return this.bindElement("ro-registrar", { slots: { id: ticket.id } });
});

Extension.registerReadonly("dispatcher", function(ticket) {
  return this.bindElement("ro-dispatcher", { slots: { id: ticket.id } });
});

Extension.registerReadonly("engineer", function(ticket) {
  const m = calcPriority(ticket.imp, ticket.urg);
  return this.bindElement("ro-engineer", {
    slots: {
      id: ticket.id,
      ver: ticket.ver,
      "imp-urg": ticket.imp + " / " + ticket.urg,
      sla: m ? m.react + " / " + m.sol : "-"
    }
  });
});

Extension.registerWidget("versions", function(ticket, context, result) {
  return this.bindElement("widget-versions");
});

Extension.registerWidget("prio-hint", function(ticket, context, result) {
  return this.bindElement("widget-prio-hint");
});

Extension.registerWidget("auto-calc", function(ticket, context, result) {
  return this.bindElement("widget-auto-calc");
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
