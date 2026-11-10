/**
 * panels.js — Service Desk panel kinds (incoming, diagnostics) and
 * the switchDiagTab helper. Registered via Extension API.
 */
import { Extension } from "../core/extensions.js";
import { DataStore } from "../core/dataStore.js";
import { State } from "../core/state.js";
import { q, getTicket, calcPriority } from "../utils.js";

Extension.registerPanelKind("incoming", function(ticket) {
  const section = this._createPanel();
  section.querySelector(".panel-title").textContent = "Входящее обращение";
  const body = section.querySelector(".panel-body");

  const org = DataStore.getOrg(ticket.orgId);
  const c = DataStore.getContacts().find(x => x.id === ticket.contactId);
  const m = calcPriority(ticket.imp, ticket.urg);

  const kv = document.createElement("div");
  kv.className = "kv";
  kv.innerHTML = `
    <div class="kv-row"><span class="kv-key">Организация</span><span class="kv-val">${this._esc(org ? org.name : "")}</span></div>
    <div class="kv-row"><span class="kv-key">Контакт</span><span class="kv-val">${this._esc(c ? (c.name + ", " + c.title) : "")}</span></div>
    <div class="kv-row"><span class="kv-key">Канал связи</span><span class="kv-val">${this._esc(ticket.channel || "")}</span></div>
    ${ticket.type && ticket.imp ? `<div class="kv-row"><span class="kv-key">Тип / Приоритет</span><span class="kv-val">${this._esc(ticket.type)} • ${this._esc(m ? m.prio : "-")}</span></div>` : ""}
    <div class="kv-row"><span class="kv-key">Заголовок</span><span class="kv-val">${this._esc(ticket.title)}</span></div>
  `;
  body.appendChild(kv);

  const textBlock = document.createElement("div");
  textBlock.className = "text-block";
  textBlock.innerHTML = `<div class="text-block-title">Текст обращения</div>
                         <div class="text-block-content">${this._esc(ticket.text)}</div>`;
  body.appendChild(textBlock);

  if (ticket.duplicateOf) {
    const dupBlock = document.createElement("div");
    dupBlock.dataset.slot = "dup-block";
    dupBlock.style.cssText = "background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px;";
    dupBlock.innerHTML = `<b>Обратите внимание:</b> похоже, это повтор уже разобранных симптомов. Проверьте, не было ли подобного ранее, и есть ли Known Error с обходным решением.`;
    body.appendChild(dupBlock);

    const prev = DataStore.getTicket(State.level, ticket.duplicateOf);
    const dupLink = document.createElement("div");
    dupLink.dataset.slot = "dup-link";
    dupLink.style.cssText = "margin-top:8px;font-size:13px;";
    dupLink.innerHTML = `<span class="kv-key">Связано с:</span>
      <select data-slot="dup-select"><option value="${this._esc(ticket.duplicateOf)}">${this._esc(prev ? (prev.id + " • " + prev.title) : ticket.duplicateOf)}</option></select>`;
    body.appendChild(dupLink);

    const dupHint = document.createElement("div");
    dupHint.dataset.slot = "dup-hint";
    dupHint.style.cssText = "margin-top:8px;font-size:12px;color:var(--warn);";
    dupHint.textContent = "⚠ Обращение похоже на повтор. Укажите, с каким обращением оно связано, и примените обходное решение из Known Error.";
    body.appendChild(dupHint);
  }

  const hasLegacy = !!ticket.clarification;
  const hasArray = Array.isArray(ticket.clarifications) && ticket.clarifications.length > 0;
  if (hasLegacy || hasArray) {
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.style.cssText = "width:100%;border:1px dashed #93c5fd;background:#eff6ff;color:#1e40af;margin-top:10px;";
    if (hasArray) {
      btn.dataset.action = "clarify-engineer";
      btn.textContent = "Запросить уточняющую информацию у заказчика";
    } else {
      btn.dataset.action = "clarify";
      btn.textContent = "Написать заказчику и уточнить детали";
    }
    body.appendChild(btn);

    const block = document.createElement("div");
    block.dataset.slot = "clarify-block";
    block.style.cssText = "display:none;margin-top:10px;";
    block.innerHTML = `
      <div class="text-block" style="border-color:#c7d2fe;background-color:#eef2ff;">
        <div class="text-block-title" style="background-color:#c7d2fe;color:#3730a3;font-weight:600;">Ответ заказчика</div>
        <div class="text-block-content" data-slot="clarify-text" style="color:#1e3a8a;font-style:italic;"></div>
      </div>`;
    body.appendChild(block);
  }

  return section;
});

Extension.registerPanelKind("diagnostics", function(ticket) {
  if (!Array.isArray(ticket.diagnostics) || ticket.diagnostics.length === 0) return null;

  const section = this._createPanel();
  section.querySelector(".panel-title").textContent = "Диагностика";
  const body = section.querySelector(".panel-body");

  const tabs = document.createElement("div");
  tabs.id = "diag-tabs";
  tabs.className = "diag-tabs";
  body.appendChild(tabs);

  const block = document.createElement("div");
  block.className = "text-block";
  block.innerHTML = `
    <div class="text-block-title" data-slot="diag-title">Выберите инструмент диагностики</div>
    <div class="text-block-content" data-slot="diag-content"
         style="font-family:Consolas,Menlo,monospace;font-size:12.5px;white-space:pre-wrap;line-height:1.55;"></div>`;
  body.appendChild(block);

  const hint = document.createElement("div");
  hint.className = "prio-hint";
  hint.style.fontSize = "12.5px";
  hint.innerHTML = `<b>Подсказка:</b> лог говорит <i>что</i> сломалось, конфигурация — <i>что изменилось</i>, лицензия — <i>куплено ли вообще</i>.`;
  body.appendChild(hint);

  ticket.diagnostics.forEach((d, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.marginRight = "6px";
    b.dataset.action = "diag-tab";
    b.dataset.tabId = d.id;
    b.textContent = d.label;
    tabs.appendChild(b);
    if (i === 0) setTimeout(() => switchDiagTab(d.id), 0);
  });

  return section;
});

export function switchDiagTab(tabId) {
  const t = getTicket(State.currentId);
  if (!t || !t.diagnostics) return;
  const d = t.diagnostics.find(x => x.id === tabId);
  if (!d) return;
  const title = q('[data-slot="diag-title"]');
  const content = q('[data-slot="diag-content"]');
  if (title) title.textContent = d.label;
  if (content) content.textContent = d.content;
  document.querySelectorAll('#diag-tabs .btn').forEach(b => {
    const active = b.dataset.tabId === tabId;
    b.style.background = active ? "var(--primary)" : "";
    b.style.color = active ? "#fff" : "";
    b.style.borderColor = active ? "transparent" : "";
  });
}
