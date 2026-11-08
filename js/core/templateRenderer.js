/**
 * templateRenderer.js — schema-driven UI shell (panels + form + widgets).
 * Декларативные шаблоны; для каждой панели kind определяет содержимое.
 */
var TemplateRenderer = {
  templates: {
    registrar: {
      panels: [
        { kind: "incoming" },
        { kind: "form",
          title: "Карточка обращения",
          readonly: "registrar",
          after: ["versions", "prio-hint", "auto-calc"],
          submitLabel: "Зарегистрировать" }
      ]
    },

    dispatcher: {
      panels: [
        { kind: "incoming" },
        { kind: "form",
          title: "Карточка обращения",
          readonly: "dispatcher",
          after: ["versions", "auto-calc"],
          submitLabel: "Изменить ответственного" }
      ]
    },

    engineer: {
      panels: [
        { kind: "incoming" },
        { kind: "diagnostics" },
        { kind: "form",
          title: "Карточка решения",
          readonly: "engineer",
          after: [],
          submitLabel: "Закрыть обращение" }
      ]
    }
  },

  render: function(templateName, schema, ticket, context) {
    const def = this.templates[templateName];
    if (!def) throw new Error("TemplateRenderer: unknown template '" + templateName + "'");
    context = context || {};

    const result = {
      panels: [],
      withExtra: false,
      registry: null,
      submitBtn: null,
      formContainer: null
    };

    for (const panel of def.panels) {
      const el = this._renderPanel(panel, schema, ticket, context, result);
      if (el) result.panels.push(el);
    }
    result.withExtra = result.panels.length >= 3;
    return result;
  },

  _renderPanel: function(panel, schema, ticket, context, result) {
    if (panel.kind === "incoming") return this._renderIncomingPanel(ticket);
    if (panel.kind === "diagnostics") return this._renderDiagnosticsPanel(ticket);
    if (panel.kind === "form") return this._renderFormPanel(panel, schema, ticket, context, result);
    return null;
  },

  _createPanel: function(opts) {
    const section = document.createElement("section");
    section.className = "panel";
    const header = document.createElement("header");
    header.className = "panel-header";
    header.innerHTML = `<div class="panel-title"></div>`;
    section.appendChild(header);
    const body = document.createElement("div");
    body.className = "panel-body";
    section.appendChild(body);
    if (opts && opts.footer) {
      const footer = document.createElement("footer");
      footer.className = "panel-footer";
      section.appendChild(footer);
    }
    return section;
  },

  _esc: function(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g,
      ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  },

  // ── INCOMING ────────────────────────────────────────
  _renderIncomingPanel: function(ticket) {
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

      const prev = DataStore.getTicket(state.level, ticket.duplicateOf);
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
  },

  // ── DIAGNOSTICS ─────────────────────────────────────
  _renderDiagnosticsPanel: function(ticket) {
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
  },

  // ── FORM ────────────────────────────────────────────
  _renderFormPanel: function(panel, schema, ticket, context, result) {
    const section = this._createPanel({ footer: true });
    section.querySelector(".panel-title").textContent = panel.title || "Карточка";
    const body = section.querySelector(".panel-body");
    const footer = section.querySelector(".panel-footer");

    if (panel.readonly && this._readonly[panel.readonly]) {
      const ro = this._readonly[panel.readonly](ticket);
      if (ro) body.appendChild(ro);
    }

    const formContainer = document.createElement("div");
    formContainer.className = "form-grid";
    body.appendChild(formContainer);
    result.formContainer = formContainer;

    const submitBtn = document.createElement("button");
    submitBtn.id = "btn-work-submit";
    submitBtn.className = "btn primary";
    submitBtn.disabled = true;
    submitBtn.dataset.action = "submit";
    submitBtn.textContent = panel.submitLabel || "Сохранить";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn";
    cancelBtn.dataset.action = "cancel";
    cancelBtn.textContent = panel.cancelLabel || "Отменить";

    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);
    result.submitBtn = submitBtn;

    const hintEl = document.createElement("div");
    hintEl.className = "prio-hint";
    hintEl.style.cssText = "display:none;background:#fffbeb;border-color:#fde68a;color:#92400e;font-size:12.5px;margin-top:12px;";
    body.appendChild(hintEl);

    const registry = FormRenderer.render(formContainer, schema, {
      ticket: ticket,
      submitBtn: submitBtn,
      hintEl: hintEl,
      onFieldChange: context.onFieldChange,
      onValidate: context.onValidate
    });
    result.registry = registry;

    for (const w of (panel.after || [])) {
      const el = this._widgets[w](ticket, context, result);
      if (el) body.appendChild(el);
    }

    FormRenderer.updateVisibility(formContainer);
    return section;
  },

  // ── READONLY ────────────────────────────────────────
  _readonly: {
    registrar: function(ticket) {
      const grid = document.createElement("div");
      grid.className = "ro-grid";
      grid.style.marginBottom = "12px";
      grid.innerHTML = `
        <div class="ro-row"><span class="ro-key">Номер</span><span class="ro-val">${TemplateRenderer._esc(ticket.id)}</span></div>
        <div class="ro-row"><span class="ro-key">Ответственный</span><span class="ro-val">текущий регистратор</span></div>
        <div class="ro-row"><span class="ro-key">Состояние обращения</span><span class="ro-val">регистрация</span></div>
        <div class="ro-row"><span class="ro-key">Код закрытия</span><span class="ro-val"></span></div>`;
      return grid;
    },
    dispatcher: function(ticket) {
      const grid = document.createElement("div");
      grid.className = "ro-grid";
      grid.style.marginBottom = "12px";
      grid.innerHTML = `
        <div class="ro-row"><span class="ro-key">Номер</span><span class="ro-val">${TemplateRenderer._esc(ticket.id)}</span></div>
        <div class="ro-row"><span class="ro-key">Ответственный</span><span class="ro-val">Тимлид команды Бета</span></div>
        <div class="ro-row"><span class="ro-key">Состояние обращения</span><span class="ro-val">регистрация</span></div>
        <div class="ro-row"><span class="ro-key">Код закрытия</span><span class="ro-val"></span></div>`;
      return grid;
    },
    engineer: function(ticket) {
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
    }
  },

  // ── WIDGETS ─────────────────────────────────────────
  _widgets: {
    versions: function(ticket, context, result) {
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
    },
    "prio-hint": function(ticket, context, result) {
      const hint = document.createElement("div");
      hint.className = "prio-hint";
      hint.dataset.slot = "prio-hint";
      hint.style.display = "none";
      hint.innerHTML = `<b>Внимание:</b> Для «Запрос на обслуживание» и «Консультация» по умолчанию устанавливается средний приоритет. Измените вручную, если заказчик указал срочность.`;
      return hint;
    },
    "auto-calc": function(ticket, context, result) {
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
    }
  }
};
