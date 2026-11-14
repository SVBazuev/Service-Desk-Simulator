/**
 * panels.js — Service Desk panel kinds (incoming, diagnostics) and
 * the switchDiagTab helper. Both panel kinds are binder-driven:
 * structure lives in templates/panels/*.html, panels.js only populates.
 */
import { Extension } from "@ludus/core/js/extensions.js";
import { DataStore } from "@ludus/core/js/dataStore.js";
import { State } from "@ludus/core/js/state.js";
import { q, getTicket, calcPriority, escapeHtml } from "../utils.js";

function buildKvHtml(ticket) {
  const org = DataStore.getOrg(ticket.orgId);
  const c = DataStore.getContacts().find(x => x.id === ticket.contactId);
  const m = calcPriority(ticket.imp, ticket.urg);
  return `
    <div class="kv-row"><span class="kv-key">Организация</span><span class="kv-val">${escapeHtml(org ? org.name : "")}</span></div>
    <div class="kv-row"><span class="kv-key">Контакт</span><span class="kv-val">${escapeHtml(c ? (c.name + ", " + c.title) : "")}</span></div>
    <div class="kv-row"><span class="kv-key">Канал связи</span><span class="kv-val">${escapeHtml(ticket.channel || "")}</span></div>
    ${ticket.type && ticket.imp
      ? `<div class="kv-row"><span class="kv-key">Тип / Приоритет</span><span class="kv-val">${escapeHtml(ticket.type)} • ${escapeHtml(m ? m.prio : "-")}</span></div>`
      : ""}
    <div class="kv-row"><span class="kv-key">Заголовок</span><span class="kv-val">${escapeHtml(ticket.title)}</span></div>
  `;
}

function buildDupOptionHtml(ticket) {
  if (!ticket.duplicateOf) return "";
  const prev = DataStore.getTicket(State.level, ticket.duplicateOf);
  const label = prev ? (prev.id + " • " + prev.title) : ticket.duplicateOf;
  return `<option value="${escapeHtml(ticket.duplicateOf)}">${escapeHtml(label)}</option>`;
}

Extension.registerPanelKind("incoming", function(ticket) {
  const hasLegacy = !!ticket.clarification;
  const hasArray = Array.isArray(ticket.clarifications) && ticket.clarifications.length > 0;
  const hasClarify = hasLegacy || hasArray;
  const hasDup = !!ticket.duplicateOf;

  const opts = {
    slots: {
      kv: { html: buildKvHtml(ticket) },
      text: ticket.text,
      "dup-select": { html: buildDupOptionHtml(ticket) },
      "clarify-btn": hasArray
        ? "Запросить уточняющую информацию у заказчика"
        : "Написать заказчику и уточнить детали"
    },
    show: {
      "dup-block": hasDup,
      "dup-link": hasDup,
      "dup-hint": hasDup,
      "clarify-wrap": hasClarify,
      "clarify-block": false
    }
  };

  if (hasClarify) {
    opts.attrs = {
      "clarify-btn": { "data-action": hasArray ? "clarify-engineer" : "clarify" }
    };
  }

  return this.bindElement("panel-incoming", opts);
});

Extension.registerPanelKind("diagnostics", function(ticket) {
  if (!Array.isArray(ticket.diagnostics) || ticket.diagnostics.length === 0) return null;

  const frag = this.bindElement("panel-diagnostics", {
    slots: {
      "diag-tabs": (container) => {
        for (const d of ticket.diagnostics) {
          const b = document.createElement("button");
          b.className = "btn";
          b.style.marginRight = "6px";
          b.dataset.action = "diag-tab";
          b.dataset.tabId = d.id;
          b.textContent = d.label;
          container.appendChild(b);
        }
      }
    }
  });

  if (ticket.diagnostics[0]) {
    setTimeout(() => switchDiagTab(ticket.diagnostics[0].id), 0);
  }

  return frag;
});

// switchDiagTab unchanged — id="diag-tabs" and data-slot selectors are preserved.
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
