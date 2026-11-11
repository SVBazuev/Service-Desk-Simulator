/**
 * router.js — navigation between screens, queue rendering, work screen
 * mounting, and final results.
 */
import { State } from "@ludus/core/js/state.js";
import { DataStore } from "@ludus/core/js/dataStore.js";
import { TemplateRenderer } from "@ludus/core/js/templateRenderer.js";
import { FormRenderer } from "@ludus/core/js/formRenderer.js";
import { Extension } from "@ludus/core/js/extensions.js";
import {
  q, showScreen, escapeHtml,
  getOrg, getTicket, getTickets, getResults
} from "../../utils.js";
import { submitLevel } from "./submits.js";
import {
  handleFieldChange, validateCurrentForm,
  populateSelects, prefillDispatcher,
  requestClarification, requestEngineerClarify
} from "./forms.js";
import { renderVerList, addProductToCard, updateAutoCalc } from "../workflows.js";
import { switchDiagTab } from "../panels.js";
import { makeSnapshot } from "./levels.js";
import { CONTACTS } from "../../../dist/data.js";

export function onWorkClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'submit') submitLevel();
  else if (action === 'cancel') goBackFromWork();
  else if (action === 'clarify') requestClarification();
  else if (action === 'clarify-engineer') requestEngineerClarify();
  else if (action === 'add-prod') addProductToCard();
  else if (action === 'diag-tab') switchDiagTab(t.dataset.tabId);
}

export function goBackFromWork() {
  State.currentId = null;
  State.currentForm = null;
  if (DataStore.getLevelWorkflow(State.level) === 'engineer') {
    State.engineer = { requestedClarify: false, clarified: false, diagOpen: null };
  }
  renderQueue();
  const lvl = DataStore.getLevel(State.level);
  if (lvl && lvl.queue) showScreen("screen-queue");
}

export function renderQueue() {
  const lvl = DataStore.getLevel(State.level);
  if (!lvl || !lvl.queue) return;
  const section = document.getElementById("screen-queue");
  if (!section) return;

  section.querySelector("[data-queue-title]").textContent = lvl.queue.title;
  section.querySelector("[data-queue-done-label]").textContent = lvl.queue.doneLabel;

  const list = section.querySelector("[data-queue-list]");
  list.innerHTML = "";

  const workflow = lvl.workflow;
  const tickets = getTickets();
  const results = getResults();
  let done = 0;

  section.querySelector("[data-queue-total]").textContent = tickets.length;

  const isRegistrar = workflow === "registrar";
  const iconSvg = isRegistrar
    ? '<path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor"/>'
    : '<path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" stroke="currentColor"/>';

  for (const t of tickets) {
    const reg = results[t.id] && results[t.id].registered;
    if (reg) done++;
    const item = document.createElement("div");
    item.className = "queue-item" + (reg ? " done" : "");

    let title = t.title;
    if (workflow === "registrar") {
      const org = getOrg(t.orgId);
      title = `Обращение от ${org ? org.name : ""} (${t.channel})`;
    } else if (workflow === "engineer") {
      const org = getOrg(t.orgId);
      title = `${org ? org.name : ""} - ${t.title}`;
    }

    item.innerHTML = `
      <div class="queue-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">${iconSvg}</svg>
        <div><div class="queue-title">${title}</div><div class="queue-sub">${t.id} • ${t.title || t.prod || ''}</div></div>
      </div>
      <div class="badge">${reg ? lvl.queue.doneLabel : "Ожидает"}</div>
    `;
    if (!reg) item.addEventListener("click", () => openWork(t.id));
    list.appendChild(item);
  }

  section.querySelector("[data-queue-done]").textContent = done;

  const finishBtn = section.querySelector("[data-queue-finish]");
  if (finishBtn) {
    finishBtn.textContent = lvl.queue.finishLabel;
    finishBtn.disabled = done < tickets.length;
  }

  const probBtn = section.querySelector("[data-queue-problems]");
  if (probBtn) probBtn.style.display = lvl.queue.showProblems ? "" : "none";
}

export function openWork(id) {
  const t = getTicket(id);
  if (!t) return;
  State.currentId = id;

  const lvl = DataStore.getLevel(State.level);
  const workflow = lvl.workflow;
  const schema = DataStore.getSchema(State.level);

  if (workflow === "engineer") {
    State.engineer = { requestedClarify: false, clarified: false, diagOpen: null };
  }

  q('[data-slot="work-title"]').textContent = lvl.workTitle || "Рабочее место";
  q('[data-slot="work-num"]').textContent = t.id;
  const probBtn = document.getElementById("btn-problems-work");
  if (probBtn) probBtn.style.display = (workflow === "engineer") ? "" : "none";

  const result = TemplateRenderer.render(schema.template, schema, t, {
    onFieldChange: (fieldId, value) => handleFieldChange(fieldId, value, t, workflow),
    onValidate: () => validateCurrentForm()
  });

  const grid = q('[data-slot="work-grid"]');
  grid.innerHTML = "";
  grid.className = "work-grid" + (result.withExtra ? " with-extra" : "");
  result.panels.forEach(p => grid.appendChild(p));

  State.currentForm = result.registry;

  populateSelects(result.registry, t, workflow);

  if (workflow === "registrar" || workflow === "dispatcher") {
    if (result.registry.fields.title) result.registry.fields.title.value = t.title;
    if (result.registry.fields.desc) result.registry.fields.desc.value = t.text;
  }
  if (workflow === "dispatcher") {
    prefillDispatcher(result.registry, t);
    updateAutoCalc(result.registry);
  }

  if (workflow !== "engineer") {
    if (workflow === "dispatcher") {
      const org = getOrg(t.orgId);
      State.orgVersions = (org && org.products ? org.products : []).map((p, idx) => ({ id: idx + Date.now(), name: p.name, ver: p.ver }));
    } else {
      State.orgVersions = [];
    }
    renderVerList();
  }

  FormRenderer.updateVisibility(result.formContainer);

  showScreen("screen-work");
  validateCurrentForm();
}

export function showResults(level) {
  const tbody = document.querySelector("#res-table tbody");
  tbody.innerHTML = "";
  const tickets = DataStore.getTickets(level);
  const results = State.getResults(level);
  const workflow = DataStore.getLevelWorkflow(level);
  document.getElementById("res-title").textContent = `Итоги работы (Уровень ${level})`;

  for (const t of tickets) {
    const r = results[t.id] || { registered: false, errs: [], comparison: [], ok: false };
    const tr = document.createElement("tr");

    let formHtml = "";
    if (workflow === "registrar") {
      const orgObj = getOrg(t.orgId);
      const contactObj = CONTACTS.find(c => c.id === t.contactId);
      formHtml = `<div style="font-size:12px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">${t.id} • ${t.title}</div>
        <div class="kv" style="gap:4px;margin-bottom:8px;">
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div>
        </div>
        <div class="text-block" style="margin-top:0;margin-bottom:8px;">
          <div class="text-block-title" style="font-size:12px;padding:6px 10px;">Текст</div>
          <div class="text-block-content" style="font-size:12px;padding:10px;white-space:pre-wrap;">${escapeHtml(t.text)}</div>
        </div></div>`;
    } else if (workflow === "engineer") {
      const orgObj = getOrg(t.orgId);
      const contactObj = CONTACTS.find(c => c.id === t.contactId);
      formHtml = `<div style="font-size:12px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">${t.id} • ${t.title}</div>
        <div class="kv" style="gap:4px;margin-bottom:8px;">
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Продукт</span><span class="kv-val">${t.ver}</span></div>
        </div>
        <div class="text-block" style="margin-top:0;margin-bottom:8px;">
          <div class="text-block-title" style="font-size:12px;padding:6px 10px;">Текст</div>
          <div class="text-block-content" style="font-size:12px;padding:10px;white-space:pre-wrap;">${escapeHtml(t.text)}</div>
        </div>
        ${t.clarifications && t.clarifications.length ? `<div style="font-size:11px;color:#1e40af;background:#eff6ff;padding:8px;border-radius:4px;"><b>Уточнение заказчика:</b> ${escapeHtml(t.clarifications[0].answer)}</div>` : ""}
      </div>`;
    } else {
      formHtml = `<div style="font-size:12px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">${t.id} • ${t.title}</div>
        <div class="text-block" style="margin-top:0;margin-bottom:8px;">
          <div class="text-block-title" style="font-size:12px;padding:6px 10px;">Текст</div>
          <div class="text-block-content" style="font-size:12px;padding:10px;white-space:pre-wrap;">${escapeHtml(t.text)}</div>
        </div></div>`;
    }

    let compHtml = `<div class="comparison-list">`;
    if (r.registered && r.comparison && r.comparison.length > 0) {
      for (const c of r.comparison) {
        compHtml += `<div class="comp-item ${c.isError ? 'error' : 'success'}">
          <div class="comp-field">${c.field}</div>
          <div class="comp-values">
            <span class="comp-val ${c.isError ? 'bad' : 'good'}">${c.isError ? 'Ваш ответ: ' + escapeHtml(c.value) : '✓ ' + escapeHtml(c.value)}</span>
            ${c.isError ? `<span class="comp-val good">Нужно: ${escapeHtml(c.expected)}</span>` : ''}
          </div>
          ${c.isError ? `<div class="comp-explain">${escapeHtml(c.explain)}</div>` : ''}
        </div>`;
      }
    } else {
      compHtml += `<div style="color:var(--sub);font-size:13px;padding:10px;">Не обработано.</div>`;
    }
    compHtml += `</div>`;

    const statusHtml = r.registered
      ? (r.ok ? `<span class="tag ok">Успех</span>` : `<span class="tag bad">Есть ошибки</span>`)
      : `<span class="tag bad">Не обработано</span>`;

    tr.innerHTML = `<td style="vertical-align:top;">${formHtml}</td><td style="vertical-align:top;">${statusHtml}</td><td style="vertical-align:top;">${compHtml}</td>`;
    tbody.appendChild(tr);
  }

  showScreen("screen-res");
  Extension.getProgressStore().save(level, { ...makeSnapshot(), finishedAt: Date.now() });
}
