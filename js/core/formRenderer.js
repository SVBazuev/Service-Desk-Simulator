/**
 * formRenderer.js — генератор форм на основе JSON-схем.
 */
var FormRenderer = {
  currentContext: null,

  resolvePath: function(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  },

  render: function(containerId, schema, context = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    this.currentContext = context;

    for (const field of schema.fields) {
      const el = this.renderField(field);
      if (el) container.appendChild(el);
    }

    // Обновляем видимость сразу после рендера
    this.updateVisibility(container);

    // Вешаем слушатели на изменения (делегирование)
    container.addEventListener('change', (e) => {
      this.updateVisibility(container);
      this.refreshDynamicOptions(container, e.target.id);
      if (typeof l3Validate === 'function' && typeof state !== 'undefined' && state.level === 3) l3Validate();
    });
    container.addEventListener('input', (e) => {
      this.updateVisibility(container);
    });
  },

  renderField: function(field) {
    // 1. СОСТАВНЫЕ ПОЛЯ (composite)
    if (field.type === 'composite') {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'composite-field';
      if (field.id) fieldset.id = 'field-' + field.id;
      if (field.showIf) fieldset.dataset.showIf = JSON.stringify(field.showIf);

      const legend = document.createElement('legend');
      legend.textContent = field.title;
      fieldset.appendChild(legend);

      for (const sub of field.fields) {
        const el = this.renderField(sub);
        if (el) fieldset.appendChild(el);
      }
      return fieldset;
    }

    // 2. ГРУППА ЧЕКБОКСОВ (checkboxGroup)
    if (field.type === 'checkboxGroup') {
      const wrap = document.createElement('div');
      wrap.className = 'form-field full';
      if (field.showIf) wrap.dataset.showIf = JSON.stringify(field.showIf);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'form-label';
      labelSpan.textContent = field.label;
      wrap.appendChild(labelSpan);

      const list = document.createElement('div');
      list.className = 'checkbox-group';
      list.id = 'card-' + field.id;

      // Получаем список для чекбоксов
      let items = [];
      if (field.source && this.currentContext.ticket) {
         // Разрешаем путь (например, "problem.incidentsLinked")
        items = this.resolvePath(this.currentContext.ticket, field.source);
      }

      // Fallback: если списка нет, берем текущий тикет
      if ((!items || items.length === 0) && field.fallback === 'currentTicket') {
        items = [this.currentContext.ticket.id];
      }
      if (!items) items = [];

      items.forEach(item => {
        let val = typeof item === 'string' ? item : item.id;
        let label = typeof item === 'string' ? item : item.title;
        if (typeof item === 'string') {
          const inc = DataStore.getTicket(3, item);
          if (inc) label = inc.id + ' • ' + inc.title;
        }

        const lbl = document.createElement('label');
        lbl.style.display = 'flex';
        lbl.style.gap = '8px';
        lbl.style.alignItems = 'center';
        lbl.style.fontSize = '13px';
        lbl.style.marginBottom = '4px';
        lbl.innerHTML = `<input type="checkbox" value="${val}" class="l3-prob-inc-check"> <span>${label}</span>`;
        list.appendChild(lbl);
      });
      wrap.appendChild(list);
      return wrap;
    }

    // 3. ОБЫЧНЫЕ ПОЛЯ (text, textarea, select)
    const id = 'card-' + field.id;
    const label = document.createElement('label');
    label.className = 'form-field' + (field.type === 'textarea' ? ' full' : '');
    if (field.showIf) label.dataset.showIf = JSON.stringify(field.showIf);

    const span = document.createElement('span');
    span.className = 'form-label';
    span.textContent = field.label;
    label.appendChild(span);

    let input;
    if (field.type === 'text') {
      input = document.createElement('input');
      input.type = 'text';
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
    } else if (field.type === 'select') {
      input = document.createElement('select');
    }

    if (!input) return null;
    input.id = id;
    input.name = field.id;
    if (field.required) input.required = true;

    if (field.type === 'select') {
      this.populateSelect(input, field);
    }

    label.appendChild(input);
    return label;
  },

  populateSelect: function(input, field) {
    let opts = field.options ? [...field.options] : [];

    if (field.source && this.currentContext.ticket) {
      const t = this.currentContext.ticket;
      if (field.source === 'WORKAROUNDS') opts = (t.workarounds || []).map((w, i) => ({value: String(i), label: w}));
      else if (field.source === 'RADICAL') opts = (t.radical || []).map((w, i) => ({value: String(i), label: w}));
      else if (field.source === 'EMPLOYEES_L3') opts = DataStore.getEmployeesL3().map(e => ({value: e.id, label: e.name + " (" + e.role + ")"}));
      else if (field.source === 'PROBLEM_METHODS') opts = DataStore.getProblemMethods().map(m => ({value: m, label: m}));
      else if (field.source === 'PROBLEMS') {
          // Изначально пустой, заполняется в refreshDynamicOptions
          opts = [{value: "", label: "Выберите проблему..."}];
      }
    }
    fillSelect(input, opts);
  },

  updateVisibility: function(container) {
    const elements = container.querySelectorAll('[data-show-if]');
    elements.forEach(el => {
      const condition = JSON.parse(el.dataset.showIf);
      const targetEl = document.getElementById('card-' + condition.field);
      if (!targetEl) return;
      const val = targetEl.value;
      let visible = false;
      if (condition.eq) visible = (val === condition.eq);
      if (condition.in) visible = condition.in.includes(val);
      el.style.display = visible ? '' : 'none';
    });
  },

  refreshDynamicOptions: function(container, changedId) {
    // Если изменился исход — перерисовываем связанную проблему
    if (changedId === 'card-outcome') {
        const outcome = document.getElementById('card-outcome').value;
        const probSelect = document.getElementById('card-linkedProb');
        if (!probSelect) return;

        let opts = [{value: "", label: "Выберите проблему..."}];
        for (const p of PROBLEMS) {
            if (outcome === "known_error" && p.status !== "known_error") continue;
            if (outcome === "fixed_problem" && p.status !== "resolved") continue;
            if (outcome !== "known_error" && outcome !== "fixed_problem") continue;

            const statText = p.status === "resolved" ? "🟢 ИСПРАВЛЕНА" : "🔴 В РАБОТЕ";
            opts.push({ value: p.id, label: `${p.id} [${statText}] • ${p.title}` });
        }
        fillSelect(probSelect, opts);
    }
  },

  getFormData: function(containerId, schema) {
    const data = {};
    const container = document.getElementById(containerId);

    const collect = (fields) => {
      for (const field of fields) {
          if (field.type === 'composite') {
            collect(field.fields);
          } else if (field.type === 'checkboxGroup') {
            const el = document.getElementById('card-' + field.id);
            if (el) {
                const checked = Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
                data[field.id] = checked;
            }
          } else {
            const el = document.getElementById('card-' + field.id);
            if (el) data[field.id] = el.value;
          }
      }
    };
    collect(schema.fields);
    return data;
  }
};
