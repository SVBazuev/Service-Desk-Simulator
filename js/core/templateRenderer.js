/**
 * templateRenderer.js — schema-driven UI shell (panels + form + widgets).
 * Domain templates (workflows, readonly, widgets, panel kinds) are
 * registered by the application via Extension API; core stays generic.
 */
var TemplateRenderer = {
  templates: {},   // filled via Extension.registerWorkflow
  _widgets: {},    // filled via Extension.registerWidget
  _readonly: {},   // filled via Extension.registerReadonly

  _panelKinds: {
    form: function(panel, schema, ticket, context, result) {
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
    const fn = this._panelKinds[panel.kind];
    if (!fn) throw new Error("TemplateRenderer: unknown panel kind '" + panel.kind + "'");
    return fn.call(this, panel, schema, ticket, context, result);
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
  }
};
