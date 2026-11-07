/**
 * formRenderer.js — генератор форм на основе JSON-схем.
 */
var FormRenderer = {
  currentContext: null,

  resolvePath: function(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  },

  // Резолвер источника для tabs/actions: поддерживает [N]-индексацию
  // ("ticket.clarifications[0].answer" -> "ticket.clarifications.0.answer").
  // Возвращает undefined на битом пути, не бросает.
  resolveSource: function(context, path) {
    if (!path) return undefined;
    const normalized = String(path).replace(/\[(\d+)\]/g, '.$1');
    return normalized.split('.').reduce((acc, part) => acc && acc[part], context);
  },
  // Проверка условия showIf: сейчас поддерживаем truthy по path.
  evaluateCondition: function(condition, context) {
    if (!condition) return true;
    if (condition.path) {
      return !!this.resolveSource(context, condition.path);
    }
    return true;
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

    // Вешаем слушатели на изменения (делегирование) — только один раз на контейнер,
    // чтобы при повторных render() они не накапливались.
    if (!container.dataset.frbBound) {
      container.dataset.frbBound = "1";
      container.addEventListener('change', (e) => {
        this.updateVisibility(container);
        this.refreshDynamicOptions(container, e.target.id);
        if (context.btnId) {
          this.validate(containerId, schema, context.btnId, context.hintId, context.extraCheck);
        }
      });
      container.addEventListener('input', () => {
        this.updateVisibility(container);
        if (context.btnId) {
          this.validate(containerId, schema, context.btnId, context.hintId, context.extraCheck);
        }
      });
    }
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
    let opts = this._normalizeOptions(field.options);

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

  // Единственное место, где строки из options превращаются в {value,label}.
  // Вызывающие (populateSelect) обязаны передавать результат дальше в fillSelect.
  _normalizeOptions: function(raw) {
    if (!raw) return [];
    return raw.map(o =>
      typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label }
    );
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
  },

    // Универсальная валидация формы на основе схемы
  validate: function(containerId, schema, btnId, hintId, extraCheck) {
    const formData = this.getFormData(containerId, schema);
    const missing = [];
    let ok = true;

    if (extraCheck && !extraCheck()) ok = false;

    for (const field of schema.fields) {
      if (!field.required) continue;

      if (field.type === 'composite') {
        const fieldset = document.getElementById('field-' + field.id);
        if (fieldset && fieldset.style.display !== 'none') {
          for (const sub of field.fields) {
            const val = formData[sub.id];
            if (sub.required && (!val || val.length === 0 || (typeof val === 'string' && val.trim() === ''))) {
              missing.push(sub.label);
              ok = false;
            }
          }
        }
      } else {
        const val = formData[field.id];
        if (!val || val.length === 0 || (typeof val === 'string' && val.trim() === '')) {
          missing.push(field.label);
          ok = false;
        }
      }
    }

    const btn = document.getElementById(btnId);
    const hint = hintId ? document.getElementById(hintId) : null;

    if (btn) btn.disabled = !ok;

    if (hint) {
      if (!ok) {
        hint.style.display = "block";
        hint.innerHTML = missing.length > 0 ? "Заполните: " + missing.join(", ") : "Заполните обязательные поля";
      } else {
        hint.style.display = "none";
        hint.textContent = "";
      }
    }
  },

  // Рендерит таб-навигацию и контент по декларации schema.tabs.
  // Ищет tab-дефиницию по containerId.
  renderTabs: function(containerId, schema, context) {
    if (!schema || !Array.isArray(schema.tabs)) return;
    const tab = schema.tabs.find(t => t.containerId === containerId);
    if (!tab) return;
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    const titleEl = tab.titleId ? document.getElementById(tab.titleId) : null;
    const contentEl = tab.contentId ? document.getElementById(tab.contentId) : null;
    const items = this.resolveSource(context, tab.source) || [];
    wrap.innerHTML = "";

    const idField = tab.itemIdField || 'id';
    const labelField = tab.itemLabelField || 'label';
    const contentField = tab.itemContentField || 'content';

    const open = (item) => {
      if (titleEl) titleEl.textContent = item[labelField];
      if (contentEl) contentEl.textContent = item[contentField];
      wrap.querySelectorAll('.btn').forEach(b => {
        const active = b.getAttribute('data-tab-id') === String(item[idField]);
        b.style.background = active ? 'var(--primary)' : '';
        b.style.color = active ? '#fff' : '';
        b.style.borderColor = active ? 'transparent' : '';
      });
    };

    for (const item of items) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.marginRight = '6px';
      b.setAttribute('data-tab-id', String(item[idField]));
      b.textContent = item[labelField];
      b.addEventListener('click', () => open(item));
      wrap.appendChild(b);
    }

    if (items.length === 0) {
      if (titleEl) titleEl.textContent = 'Выберите инструмент диагностики';
      if (contentEl) contentEl.textContent = '';
      return;
    }
    if (tab.autoOpen !== false) open(items[0]);
  },

  // Идемпотентно навешивает click-обработчики и применяет showIf.
  bindActions: function(schema, context) {
    if (!schema || !Array.isArray(schema.actions)) return;
    for (const action of schema.actions) {
      if (action.trigger === 'click' && action.buttonId) {
        const btn = document.getElementById(action.buttonId);
        if (btn) btn.onclick = () => this.applyAction(action, context);
      } else if (action.type === 'showIf') {
        const visible = this.evaluateCondition(action.condition, context);
        (action.targets || []).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = visible ? '' : 'none';
        });
      }
    }
  },

  // Выполняет одно действие (showText) по контексту.
  applyAction: function(action, context) {
    if (!action) return;
    if (action.type === 'showText') {
      const val = this.resolveSource(context, action.source);
      if (action.target) {
        const tgt = document.getElementById(action.target);
        if (tgt) tgt.textContent = val != null ? String(val) : '';
      }
      if (action.targetBlock) {
        const blk = document.getElementById(action.targetBlock);
        if (blk) blk.style.display = 'block';
      }
      if (action.hideAfter) {
        const btn = document.getElementById(action.hideAfter);
        if (btn) btn.style.display = 'none';
      }
    }
  }
};
