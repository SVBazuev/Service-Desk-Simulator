/**
 * forms.js — form population, cascade handlers, per-field side effects,
 * and clarify helpers.
 */
import { State } from "@ludus/core/js/state.js";
import { DataStore } from "@ludus/core/js/dataStore.js";
import { FormRenderer } from "@ludus/core/js/formRenderer.js";
import {
  q, fillSelect,
  getOrg, getContactsByOrg, getCatList, getSubList, getOrgVersions, getTicket
} from "../../utils.js";
import { renderVerList, updateAutoCalc } from "../workflows.js";
import { PROBLEMS } from "../../../dist/data.js";

export function populateSelects(registry, t, workflow) {
  const f = registry.fields;

  if (f.org) fillSelect(f.org, DataStore.getOrgs().map(o => ({ value: o.id, label: o.name })));

  if (f.cont) {
    const oid = workflow === "dispatcher" ? t.orgId : "";
    fillSelect(f.cont, oid ? getContactsByOrg(oid).map(c => ({ value: c.id, label: c.name })) : []);
  }

  if (f.prod) {
    const org = workflow === "dispatcher" ? getOrg(t.orgId) : null;
    fillSelect(f.prod, org ? org.products.map(p => ({ value: p.name, label: p.name })) : []);
  }

  if (f.cat) fillSelect(f.cat, []);
  if (f.sub) fillSelect(f.sub, []);

  if (f.assignee) fillSelect(f.assignee, DataStore.getEmployees().map(e => ({
    value: e.id,
    label: `${e.name} (${e.role}) • В работе: ${e.workload !== undefined ? e.workload : 0} - ${e.status}`
  })));

  if (f.comment) fillSelect(f.comment, DataStore.getCommentsL2().map(c => ({ value: c.id, label: c.text })));
  if (f.workaround) fillSelect(f.workaround, (t.workarounds || []).map((w, i) => ({ value: String(i), label: w })));
  if (f.radical) fillSelect(f.radical, (t.radical || []).map((w, i) => ({ value: String(i), label: w })));
  if (f.owner) fillSelect(f.owner, DataStore.getEmployeesL3().map(e => ({ value: e.id, label: e.name + " (" + e.role + ")" })));
  if (f.method) fillSelect(f.method, DataStore.getProblemMethods().map(m => ({ value: m, label: m })));
  if (f.linkedProb) fillSelect(f.linkedProb, [{ value: "", label: "Выберите проблему..." }]);
}

export function prefillDispatcher(registry, t) {
  const f = registry.fields;

  if (f.org) f.org.value = t.orgId;

  if (f.cont) {
    fillSelect(f.cont, getContactsByOrg(t.orgId).map(c => ({ value: c.id, label: c.name })));
    f.cont.value = t.contactId;
  }

  const org = getOrg(t.orgId);
  if (f.prod) {
    fillSelect(f.prod, org ? org.products.map(p => ({ value: p.name, label: p.name })) : []);
    f.prod.value = t.prod;
  }

  if (f.cat) {
    fillSelect(f.cat, getCatList(t.prod).map(c => ({ value: c.name, label: c.name })));
    f.cat.value = t.cat;
  }

  if (f.sub) {
    fillSelect(f.sub, getSubList(t.prod, t.cat).map(s => ({ value: s, label: s })));
    f.sub.value = t.sub;
  }

  if (f.chan) f.chan.value = t.channel;
  if (f.type) f.type.value = t.type;
  if (f.imp) f.imp.value = t.imp;
  if (f.urg) f.urg.value = t.urg;

  if (f.assignee) f.assignee.value = "";
  if (f.comment) f.comment.value = "";
}

export function handleFieldChange(fieldId, value, t, workflow) {
  const registry = State.currentForm;
  if (!registry) return;
  const f = registry.fields;

  if (fieldId === "org" && f.cont && f.prod) {
    const contacts = getContactsByOrg(value);
    fillSelect(f.cont, contacts.map(c => ({ value: c.id, label: c.name })));
    const org = getOrg(value);
    fillSelect(f.prod, org ? org.products.map(p => ({ value: p.name, label: p.name })) : []);
    if (f.cat) fillSelect(f.cat, []);
    if (f.sub) fillSelect(f.sub, []);
    State.orgVersions = getOrgVersions(org).map((p, idx) => ({ id: idx + Date.now(), name: p.name, ver: p.ver }));
    renderVerList();
  }

  if (fieldId === "prod" && f.cat) {
    fillSelect(f.cat, getCatList(value).map(c => ({ value: c.name, label: c.name })));
    if (f.sub) fillSelect(f.sub, []);
  }

  if (fieldId === "cat" && f.sub && f.prod) {
    fillSelect(f.sub, getSubList(f.prod.value, value).map(s => ({ value: s, label: s })));
  }

  if (fieldId === "type" && workflow === "registrar" && f.imp && f.urg) {
    const hint = q('[data-slot="prio-hint"]');
    if (value === "Запрос на обслуживание" || value === "Консультация") {
      if (hint) hint.style.display = "block";
      f.imp.value = "средняя";
      f.urg.value = "средняя";
    } else if (hint) {
      hint.style.display = "none";
    }
    updateAutoCalc(registry);
  }

  if (fieldId === "imp" || fieldId === "urg") {
    updateAutoCalc(registry);
  }

  if (fieldId === "outcome") {
    updateLinkedProbOptions(registry, value);
    FormRenderer.updateVisibility(registry.container);
  }
}

export function updateLinkedProbOptions(registry, outcome) {
  const sel = registry.fields.linkedProb;
  if (!sel) return;
  let opts = [{ value: "", label: "Выберите проблему..." }];
  for (const p of PROBLEMS) {
    if (outcome === "known_error" && p.status !== "known_error") continue;
    if (outcome === "fixed_problem" && p.status !== "resolved") continue;
    if (outcome !== "known_error" && outcome !== "fixed_problem") continue;
    const stat = p.status === "resolved" ? "🟢 ИСПРАВЛЕНА" : "🔴 В РАБОТЕ";
    opts.push({ value: p.id, label: `${p.id} [${stat}] • ${p.title}` });
  }
  fillSelect(sel, opts);
}

export function validateCurrentForm() {
  if (!State.currentForm) return;
  const schema = DataStore.getSchema(State.level);
  const wf = DataStore.getLevelWorkflow(State.level);
  FormRenderer.validate(State.currentForm, schema, () => {
    if (wf === "engineer") return true;
    return State.orgVersions && State.orgVersions.length > 0;
  });
}

export function requestClarification() {
  const t = getTicket(State.currentId);
  if (!t || !t.clarification) return;
  const text = q('[data-slot="clarify-text"]');
  const block = q('[data-slot="clarify-block"]');
  if (text) text.textContent = t.clarification;
  if (block) block.style.display = "block";
  const btn = q('[data-action="clarify"]');
  if (btn) btn.style.display = "none";
}

export function requestEngineerClarify() {
  const t = getTicket(State.currentId);
  if (!t || !t.clarifications || t.clarifications.length === 0) return;
  State.engineer.requestedClarify = true;
  State.engineer.clarified = true;
  const text = q('[data-slot="clarify-text"]');
  const block = q('[data-slot="clarify-block"]');
  if (text) text.textContent = t.clarifications[0].answer;
  if (block) block.style.display = "block";
  const btn = q('[data-action="clarify-engineer"]');
  if (btn) btn.style.display = "none";
}
