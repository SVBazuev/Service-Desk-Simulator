const state = State;

let INITIAL_WORKLOADS = {};

function bootstrapWorkloads() {
  INITIAL_WORKLOADS = Object.fromEntries(
    DataStore.getEmployees()
      .filter(emp => emp.workload !== undefined)
      .map(emp => [emp.id, emp.workload])
  );
}

function resetWorkloads() {
  DataStore.getEmployees().forEach(emp => {
    if (emp.workload !== undefined && INITIAL_WORKLOADS[emp.id] !== undefined) {
      emp.workload = INITIAL_WORKLOADS[emp.id];
    }
  });
}

function resetState() {
  state.reset();
  resetWorkloads();
}

function q(sel) { return document.querySelector(sel); }

// ============ INIT ============

function init() {
  bootstrapWorkloads();
  bootstrapKb();

  document.getElementById("btn-to-level-select").addEventListener("click", () => {
    renderLevelCards();
    showScreen("screen-level-select");
  });

  document.getElementById("btn-back-to-level-select").addEventListener("click", () => {
    renderLevelCards();
    showScreen("screen-level-select");
  });

  document.getElementById("btn-level-reset").addEventListener("click", () => {
    if (!confirm("Сбросить весь сохранённый прогресс по всем уровням?")) return;
    ProgressStore.reset();
    resetState();
    renderLevelCards();
  });

  DataStore.getLevels().forEach(lvl => {
    if (!lvl.intro || !lvl.intro.startBtn) return;
    const btn = document.getElementById(lvl.intro.startBtn);
    if (!btn) return;
    btn.addEventListener("click", () => {
      hideModal(lvl.intro.modal);
      showScreen(lvl.queue.screen);
    });
  });

  // Делегирование кликов внутри рабочего экрана
  document.getElementById("screen-work").addEventListener("click", onWorkClick);

  document.querySelectorAll(".modal-close, [data-close]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-close");
      if (id) hideModal(id);
    });
  });

  document.querySelectorAll("[id^='btn-org-list']").forEach(b => b.addEventListener("click", openOrgList));
  document.querySelectorAll("[id^='btn-emp-list']").forEach(b => b.addEventListener("click", () =>
    openEmpList(DataStore.getLevelWorkflow(state.level) === "engineer" ? DataStore.getEmployeesL3() : DataStore.getEmployees())
  ));
  document.querySelectorAll("[id^='btn-kb']").forEach(b => b.addEventListener("click", openKb));
  document.querySelectorAll("[id^='btn-problems']").forEach(b => b.addEventListener("click", openProblems));

  document.getElementById("btn-res-restart").addEventListener("click", restart);

  document.getElementById("btn-reg-ok").addEventListener("click", () => {
    hideModal("modal-reg");
    goBackFromWork();
  });
  document.getElementById("btn-assign-ok").addEventListener("click", () => {
    hideModal("modal-assign");
    goBackFromWork();
  });

  DataStore.getLevels().forEach(lvl => {
    const btn = (lvl.queue && lvl.queue.finish) ? document.getElementById(lvl.queue.finish) : null;
    if (btn) {
      btn.addEventListener("click", () => {
        if (state.level === lvl.id) showResults(state.level);
      });
    }
  });

  buildKb();
}

// ============ Делегированные действия ============

function onWorkClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'submit') handleSubmit();
  else if (action === 'cancel') goBackFromWork();
  else if (action === 'clarify') requestClarification();
  else if (action === 'clarify-engineer') requestEngineerClarify();
  else if (action === 'add-prod') addProductToCard();
  else if (action === 'diag-tab') switchDiagTab(t.dataset.tabId);
}

function handleSubmit() {
  const wf = DataStore.getLevelWorkflow(state.level);
  if (wf === 'engineer') submitEngineer();
  else if (wf === 'dispatcher') assignL2();
  else register();
}

function goBackFromWork() {
  state.currentId = null;
  state.currentForm = null;
  if (DataStore.getLevelWorkflow(state.level) === 'engineer') {
    state.engineer = { requestedClarify: false, clarified: false, diagOpen: null };
  }
  renderQueue();
  const lvl = DataStore.getLevel(state.level);
  if (lvl && lvl.queue) showScreen(lvl.queue.screen);
}

// ============ Очередь ============

function renderQueue() {
  const lvl = DataStore.getLevel(state.level);
  if (!lvl || !lvl.queue || !lvl.queue.list) return;
  const list = document.getElementById(lvl.queue.list);
  if (!list) return;
  list.innerHTML = "";

  const workflow = lvl.workflow;
  const tickets = getTickets();
  const results = getResults();
  let done = 0;

  const totalEl = document.getElementById(lvl.queue.total);
  if (totalEl) totalEl.textContent = tickets.length;

  const isRegistrar = workflow === "registrar";
  const badgeDone = isRegistrar ? "Зарегистрировано" : workflow === "dispatcher" ? "Распределено" : "Решено";
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
      <div class="badge">${reg ? badgeDone : "Ожидает"}</div>
    `;
    if (!reg) item.addEventListener("click", () => openWork(t.id));
    list.appendChild(item);
  }

  const doneEl = document.getElementById(lvl.queue.done);
  if (doneEl) doneEl.textContent = done.toString();
  const finishBtn = document.getElementById(lvl.queue.finish);
  if (finishBtn) finishBtn.disabled = done < tickets.length;
}

// ============ Универсальное рабочее место ============

function openWork(id) {
  const t = getTicket(id);
  if (!t) return;
  state.currentId = id;

  const lvl = DataStore.getLevel(state.level);
  const workflow = lvl.workflow;
  const schema = DataStore.getSchema(state.level);

  if (workflow === "engineer") {
    state.engineer = { requestedClarify: false, clarified: false, diagOpen: null };
  }

  // Шапка
  q('[data-slot="work-title"]').textContent = lvl.workTitle || "Рабочее место";
  q('[data-slot="work-num"]').textContent = t.id;
  const probBtn = document.getElementById("btn-problems-work");
  if (probBtn) probBtn.style.display = (workflow === "engineer") ? "" : "none";

  // Рендер через TemplateRenderer
  const result = TemplateRenderer.render(schema.template, schema, t, {
    onFieldChange: (fieldId, value) => handleFieldChange(fieldId, value, t, workflow),
    onValidate: () => validateCurrentForm()
  });

  // Монтирование
  const grid = q('[data-slot="work-grid"]');
  grid.innerHTML = "";
  grid.className = "work-grid" + (result.withExtra ? " with-extra" : "");
  result.panels.forEach(p => grid.appendChild(p));

  state.currentForm = result.registry;

  // populate + prefill
  populateSelects(result.registry, t, workflow);

  if (workflow === "registrar" || workflow === "dispatcher") {
    if (result.registry.fields.title) result.registry.fields.title.value = t.title;
    if (result.registry.fields.desc) result.registry.fields.desc.value = t.text;
  }
  if (workflow === "dispatcher") {
    prefillDispatcher(result.registry, t);
    updateAutoCalc(result.registry);
  }

  // versions
  if (workflow !== "engineer") {
    if (workflow === "dispatcher") {
      const org = getOrg(t.orgId);
      state.orgVersions = getOrgVersions(org).map((p, idx) => ({ id: idx + Date.now(), name: p.name, ver: p.ver }));
    } else {
      state.orgVersions = [];
    }
    renderVerList();
  }

  FormRenderer.updateVisibility(result.formContainer);

  showScreen("screen-work");
  validateCurrentForm();
}

// ============ Render: диагностика ============

function switchDiagTab(tabId) {
  const t = getTicket(state.currentId);
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


// ============ Populate / Prefill ============

function populateSelects(registry, t, workflow) {
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

function prefillDispatcher(registry, t) {
  const f = registry.fields;

  if (f.org) f.org.value = t.orgId;

  // cascade: contacts
  if (f.cont) {
    fillSelect(f.cont, getContactsByOrg(t.orgId).map(c => ({ value: c.id, label: c.name })));
    f.cont.value = t.contactId;
  }

  // cascade: products
  const org = getOrg(t.orgId);
  if (f.prod) {
    fillSelect(f.prod, org ? org.products.map(p => ({ value: p.name, label: p.name })) : []);
    f.prod.value = t.prod;
  }

  // cascade: cat
  if (f.cat) {
    fillSelect(f.cat, getCatList(t.prod).map(c => ({ value: c.name, label: c.name })));
    f.cat.value = t.cat;
  }

  // cascade: sub
  if (f.sub) {
    fillSelect(f.sub, getSubList(t.prod, t.cat).map(s => ({ value: s, label: s })));
    f.sub.value = t.sub;
  }

  if (f.chan) f.chan.value = t.channel;
  if (f.type) f.type.value = t.type;
  if (f.imp) f.imp.value = t.imp;
  if (f.urg) f.urg.value = t.urg;

  // Ответственные/комментарий — НЕ предзаполняем: это и есть задание.
  if (f.assignee) f.assignee.value = "";
  if (f.comment) f.comment.value = "";
}

// ============ Field change ============

function handleFieldChange(fieldId, value, t, workflow) {
  const registry = state.currentForm;
  if (!registry) return;
  const f = registry.fields;

  if (fieldId === "org" && f.cont && f.prod) {
    const contacts = getContactsByOrg(value);
    fillSelect(f.cont, contacts.map(c => ({ value: c.id, label: c.name })));
    const org = getOrg(value);
    fillSelect(f.prod, org ? org.products.map(p => ({ value: p.name, label: p.name })) : []);
    if (f.cat) fillSelect(f.cat, []);
    if (f.sub) fillSelect(f.sub, []);
    state.orgVersions = getOrgVersions(org).map((p, idx) => ({ id: idx + Date.now(), name: p.name, ver: p.ver }));
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
    // showIf composite/select пересчёт
    FormRenderer.updateVisibility(registry.container);
  }
}

function updateAutoCalc(registry) {
  if (!registry.fields.imp || !registry.fields.urg) return;
  const m = calcPriority(registry.fields.imp.value, registry.fields.urg.value);
  const prio = q('[data-auto="prio"]');
  const react = q('[data-auto="react"]');
  const sol = q('[data-auto="sol"]');
  if (prio) prio.textContent = m ? m.prio : "-";
  if (react) react.textContent = m ? m.react : "-";
  if (sol) sol.textContent = m ? m.sol : "-";
}

function updateLinkedProbOptions(registry, outcome) {
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

function validateCurrentForm() {
  if (!state.currentForm) return;
  const schema = DataStore.getSchema(state.level);
  const wf = DataStore.getLevelWorkflow(state.level);
  FormRenderer.validate(state.currentForm, schema, () => {
    if (wf === "engineer") return true;
    return state.orgVersions && state.orgVersions.length > 0;
  });
}

// ============ Clarify ============

function requestClarification() {
  const t = getTicket(state.currentId);
  if (!t || !t.clarification) return;
  const text = q('[data-slot="clarify-text"]');
  const block = q('[data-slot="clarify-block"]');
  if (text) text.textContent = t.clarification;
  if (block) block.style.display = "block";
  const btn = q('[data-action="clarify"]');
  if (btn) btn.style.display = "none";
}

function requestEngineerClarify() {
  const t = getTicket(state.currentId);
  if (!t || !t.clarifications || t.clarifications.length === 0) return;
  state.engineer.requestedClarify = true;
  state.engineer.clarified = true;
  const text = q('[data-slot="clarify-text"]');
  const block = q('[data-slot="clarify-block"]');
  if (text) text.textContent = t.clarifications[0].answer;
  if (block) block.style.display = "block";
  const btn = q('[data-action="clarify-engineer"]');
  if (btn) btn.style.display = "none";
}

// ============ Versions widget ============

function renderVerList() {
  const list = q('[data-slot="ver-list"]');
  if (!list) return;
  list.innerHTML = "";
  if (!state.orgVersions || state.orgVersions.length === 0) {
    list.innerHTML = "<div style='color:var(--sub);font-size:13px'>Нет данных</div>";
    renderAddProdSelect();
    return;
  }
  for (const v of state.orgVersions) {
    const row = document.createElement("div");
    row.className = "ver-row";
    row.innerHTML = `<div class="ver-name">${v.name}</div><select data-ver-id="${v.id}"><option value="${v.ver}">${v.ver}</option></select><button class="ver-del" data-del-id="${v.id}">×</button>`;
    list.appendChild(row);
  }
  list.querySelectorAll(".ver-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const idv = parseInt(btn.getAttribute("data-del-id"));
      state.orgVersions = state.orgVersions.filter(x => x.id !== idv);
      renderVerList();
      validateCurrentForm();
    });
  });
  renderAddProdSelect();
}

function renderAddProdSelect() {
  const sel = q('[data-slot="add-prod-select"]');
  if (!sel) return;
  const added = new Set((state.orgVersions || []).map(v => v.name));
  const orgField = state.currentForm && state.currentForm.fields.org;
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

function addProductToCard() {
  const sel = q('[data-slot="add-prod-select"]');
  if (!sel) return;
  const name = sel.value; if (!name) return;
  const orgField = state.currentForm && state.currentForm.fields.org;
  const org = getOrg(orgField ? orgField.value : "");
  const full = getOrgVersions(org);
  const p = full.find(x => x.name === name);
  if (!p || state.orgVersions.some(v => v.name === p.name)) return;
  state.orgVersions.push({ id: Date.now(), name: p.name, ver: p.ver });
  renderVerList();
  validateCurrentForm();
}

// ============ Submits ============

function showSuccess(ticketId, modalId) {
  const idEl = document.getElementById(modalId === "modal-assign" ? "assign-ok-id" : "reg-ok-id");
  if (idEl) idEl.textContent = ticketId;
  showModal(modalId);
}

function register() {
  const t = DataStore.getTicket(1, state.currentId);
  if (!t || !state.currentForm) return;
  const schema = DataStore.getSchema(1);
  const formData = FormRenderer.getFormData(state.currentForm, schema);
  formData.vers = (state.orgVersions || []).map(v => v.name + " " + v.ver);
  state.getResults(1)[t.id] = Validator.validate(schema, t, formData);
  ProgressStore.save(1, makeSnapshot());
  showSuccess(t.id, "modal-reg");
}

function assignL2() {
  const t = DataStore.getTicket(2, state.currentId);
  if (!t || !state.currentForm) return;
  const schema = DataStore.getSchema(2);
  const formData = FormRenderer.getFormData(state.currentForm, schema);
  formData.vers = (state.orgVersions || []).map(v => v.name + " " + v.ver);
  state.getResults(2)[t.id] = Validator.validate(schema, t, formData);
  ProgressStore.save(2, makeSnapshot());
  showSuccess(t.id, "modal-assign");
  const emp = DataStore.getEmployees().find(e => e.id === formData.assignee);
  if (emp && emp.workload !== undefined) emp.workload += 1;
}

function submitEngineer() {
  const t = getTicket(state.currentId);
  if (!t || !state.currentForm) return;
  const schema = DataStore.getSchema(state.level);
  const formData = FormRenderer.getFormData(state.currentForm, schema);
  const dupSel = q('[data-slot="dup-select"]');
  formData.dupVal = dupSel ? dupSel.value : "";

  const result = Validator.validate(schema, t, formData);
  state.getResults(state.level)[t.id] = result;

  if (formData.outcome === "new_problem" && result.ok) {
    if (!state.createdProblems.includes(t.problem?.record)) {
      state.createdProblems.push(t.problem?.record);
    }
  }
  showSuccess(t.id, "modal-reg");
  ProgressStore.save(state.level, makeSnapshot());
}

// ============ Результаты ============

function showResults(level) {
  const tbody = document.querySelector("#res-table tbody");
  tbody.innerHTML = "";
  const tickets = DataStore.getTickets(level);
  const results = state.getResults(level);
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
  ProgressStore.save(level, { ...makeSnapshot(), finishedAt: Date.now() });
}

function restart() {
  resetState();
  showScreen("screen-start");
}

// ============ Справочники ============

function openOrgList() {
  const tbody = document.getElementById("org-list-body");
  tbody.innerHTML = "";
  for (const org of DataStore.getOrgs()) {
    const tr = document.createElement("tr");
    const prods = org.products.map(p => p.name + " " + p.ver).join("<br>");
    tr.innerHTML = `<td><b>${org.name}</b></td><td>${org.desc}</td><td>${prods}</td><td><button class="btn" onclick="openContacts('${org.id}', '${org.name}')">Контакты</button></td>`;
    tbody.appendChild(tr);
  }
  showModal("modal-org-list");
}

function openEmpList(list) {
  list = list || DataStore.getEmployees();
  const tbody = document.getElementById("emp-list-body");
  tbody.innerHTML = "";
  for (const emp of list) {
    const tr = document.createElement("tr");
    const statusColor = emp.status === "В отпуске" ? "var(--bad)" : "var(--ok)";
    const workloadText = emp.workload !== undefined ? emp.workload : '-';
    tr.innerHTML = `<td><b>${emp.name}</b></td><td>${emp.role}</td><td>${emp.spec}</td><td>${workloadText}</td><td style="color:${statusColor};font-weight:600;">${emp.status}</td>`;
    tbody.appendChild(tr);
  }
  showModal("modal-emp-list");
}

function openContacts(orgId, orgName) {
  document.getElementById("contacts-org-name").textContent = orgName;
  const tbody = document.getElementById("contacts-list-body");
  tbody.innerHTML = "";
  const contacts = getContactsByOrg(orgId);
  if (contacts.length === 0) {
    tbody.innerHTML = "<tr><td colspan='2'>Нет контактных лиц</td></tr>";
  } else {
    for (const c of contacts) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${c.name}</td><td>${c.title}</td>`;
      tbody.appendChild(tr);
    }
  }
  showModal("modal-contacts");
}

// ============ Problems ============

function openProblems() {
  const body = document.getElementById("problems-body");
  body.innerHTML = "";
  const resolvedIds = Object.keys(state.getResults(3)).filter(id => state.getResults(3)[id].registered);

  if (resolvedIds.length === 0) {
    body.innerHTML = "<div style='color:var(--sub);font-size:14px;'>Пока нет зарегистрированных Problem Records. Они появляются, когда вы закрываете обращение с исходом «Known Error».</div>";
  }

  let displayProblems = [...PROBLEMS];

  if (state.createdProblems && state.createdProblems.includes("PRB-3")) {
    displayProblems.push({
      id: "PRB-3",
      status: "known_error",
      incidents: ["TK-310"],
      incidentsLinked: ["TK-310"],
      title: "В Про.Документы 4.9 отсутствует фильтрация уведомлений по ролям",
      rootCause: "Функциональный пробел версии 4.9: профиль уведомлений поддерживает только событие ALL, фильтрация по ролям и событиям появилась в 5.0. Пользователи 4.9 вынуждены получать все уведомления или отключать их полностью",
      impact: "среднее",
      prob: "высокая",
      owner: "E6",
      method: "5 почему",
      rfc: "Бэкпортировать механизм фильтрации уведомлений по ролям/событиям из 5.0 в 4.9 либо согласовать план обновления клиентов 4.9 до 5.x. До внедрения — ручная настройка событий «на согласовании мне» и «отклонено».",
      archiveList: [
        { id: "TK-310", title: "Массовая рассылка уведомлений парализует работу отдела", org: "АО «Северная Мебель»" }
      ]
    });
  }

  for (const p of displayProblems) {
    const archiveList = p.archiveList || ARCHIVE_INCIDENTS[p.id] || [];
    const linked = archiveList.map(inc => {
      return `<li style="margin-bottom:4px;">${inc.id} • ${inc.title} <span class="tag ok" style="font-size:11px;">закрыто</span> <span style="color:var(--sub);font-size:11px;">(${inc.org})</span></li>`;
    }).join("");
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid var(--border);border-radius:8px;padding:14px;background:#f8fafc;";
    const statusBadge = p.status === "resolved"
      ? '<span class="tag ok" style="margin-left:8px;">Исправлена</span>'
      : '<span class="tag bad" style="margin-left:8px;">В работе (известная ошибка)</span>';

    card.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;">${p.id} • ${p.title} ${statusBadge}</div>
      <div style="font-size:13px;color:var(--sub);margin-bottom:8px;">Первопричина: ${p.rootCause}</div>
      <div style="font-size:13px;"><b>Связанные инциденты:</b><ul style="margin:6px 0 8px 18px;padding:0;">${linked}</ul></div>
      <div style="font-size:13px;"><b>Владелец:</b> ${DataStore.getEmployeesL3().find(e => e.id === p.owner)?.name || p.owner} • <b>Метод:</b> ${p.method} • <b>Влияние:</b> ${p.impact} • <b>Вероятность:</b> ${p.prob}</div>
      <div style="font-size:13px;margin-top:8px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:8px;"><b>RFC:</b> ${p.rfc}</div>
    `;
    body.appendChild(card);
  }
  showModal("modal-problems");
}

// ============ База знаний ============

let KB = [];

function bootstrapKb() {
  KB = [
    { title: "О компании «Про.Софт»", html: `<h3>О компании «Про.Софт»</h3><p><b>ООО «Про.Софт»</b> — российский разработчик корпоративного программного обеспечения.</p>` },
    { title: "Продукты компании", html: `<h3>Продукты</h3><table><tr><th>Продукт</th><th>Назначение</th></tr><tr><td>Про.Документы</td><td>СЭД: договоры, согласование документов, карточки контрагентов, маршруты.</td></tr><tr><td>Про.Продажи</td><td>CRM: клиенты, сделки, воронка, аналитика.</td></tr><tr><td>Про.Закупки</td><td>SRM: заявки, каталог, договоры закупок.</td></tr></table>` },
    { title: "Типы обращений", html: `<h3>Типы обращений</h3><table><tr><th>Тип</th><th>Описание</th></tr><tr><td>Инцидент</td><td>Незапланированный сбой или снижение качества работы ПО.</td></tr><tr><td>Запрос на обслуживание</td><td>Стандартная процедура (дистрибутив, доступ, лицензия).</td></tr><tr><td>Консультация</td><td>Вопрос по использованию, настройке или возможностям продукта.</td></tr></table>` },
    { title: "Линии поддержки и Эскалация", html: `<h3>Линии поддержки</h3><table><tr><th>Линия</th><th>Задачи</th><th>Кто работает</th></tr><tr><td>1-я (L1)</td><td>Приём, регистрация, консультации, доступы.</td><td>Иванов, Фёдорова, Волкова</td></tr><tr><td>2-я (L2)</td><td>Типовые инциденты, настройка, анализ логов, обходные пути.</td><td>Петрова, Сидоров, Никитин, Морозов</td></tr><tr><td>3-я (L3)</td><td>Сложные баги, БД, инфраструктура, передача разработчикам.</td><td>Кузнецов</td></tr></table><h3>Эскалация</h3><p><b>Функциональная:</b> привлечение более опытного коллеги. <b>Иерархическая:</b> подключение руководителя/менеджера (риск SLA, недовольство, оплата/сроки).</p>` },
    { title: "Управление инцидентами", html: `<h3>Управление инцидентами</h3><ol><li>Выявление</li><li>Регистрация</li><li>Классификация</li><li>Приоритизация (матрица)</li><li>Распределение</li><li>Диагностика</li><li>Решение (или обходка)</li><li>Закрытие</li></ol><p>Инцидент — симптом. Причину лечит управление проблемами.</p>` },
    { title: "Управление проблемами", html: `<h3>Управление проблемами (ITIL)</h3><p><b>Проблема</b> — скрытая причина одного или нескольких инцидентов.</p><p>Known Error — причина найдена, фикс не внедрён, действует обходное решение.</p>` },
    { title: "Каналы связи", html: `<h3>Каналы связи</h3><ul><li>Email</li><li>Телефон</li><li>Портал самообслуживания</li><li>Чат на сайте</li><li>Мессенджер</li></ul>` },
    { title: "Важность и срочность. Матрица приоритета", html: `<h3>Матрица</h3><table><tr><th>В\\С</th><th>Высокая</th><th>Средняя</th><th>Низкая</th></tr><tr><td>Высокая</td><td>Критический</td><td>Высокий</td><td>Средний</td></tr><tr><td>Средняя</td><td>Высокий</td><td>Средний</td><td>Низкий</td></tr><tr><td>Низкая</td><td>Средний</td><td>Низкий</td><td>Низкий</td></tr></table><p style="color:var(--bad);"><b>Важно:</b> для «Запрос на обслуживание» и «Консультация» по умолчанию средняя/средняя. Если заказчик явно указал критичность — меняйте вручную.</p>` },
    { title: "SLA и сроки", html: `<table><tr><th>Приоритет</th><th>Реакция</th><th>Решение</th></tr><tr><td>Критический</td><td>2 ч</td><td>6 ч</td></tr><tr><td>Высокий</td><td>4 ч</td><td>12 ч</td></tr><tr><td>Средний</td><td>8 ч</td><td>24 ч</td></tr><tr><td>Низкий</td><td>24 ч</td><td>32 ч</td></tr></table>` },
    { title: "Категории и подкатегории", html: `<h3>Категории/подкатегории</h3><p>Категория — модуль продукта; подкатегория — функция внутри модуля. Для всех продуктов есть «Стандартные процедуры» (дистрибутив, доступ, лицензии) — это всегда «Запрос на обслуживание».</p>` },
    { title: "Структура карточки обращения", html: `<h3>Структура карточки</h3><p>Организация → Контакт → Канал → Заголовок → Описание → Тип → Продукт → Категория → Подкатегория → Версии → Важность/Срочность → Приоритет/SLA.</p>` },
    { title: "Порядок регистрации", html: `<ol><li>Прочитать</li><li>Уточнить</li><li>Организация</li><li>Тип</li><li>Продукт/Категория/Подкатегория</li><li>Версии</li><li>Важность/Срочность</li><li>Зарегистрировать</li></ol>` },
    { title: "Коды закрытия", html: `<ul><li>Решено</li><li>Решено инициатором</li><li>Отказано</li><li>Недостаточно информации</li><li>Дубликат</li><li>Передано</li></ul>` },
    { title: "Частые ошибки", html: `<ul><li>Путаница важности/срочности</li><li>Неверный продукт/категория/подкатегория</li><li>Неверная версия</li><li>Не выбран тип</li></ul>` },
    { title: "Как работать на 2-й линии", html: KB_L3[0].html },
    { title: "Диагностика: что читать в логах", html: KB_L3[1].html },
    { title: "Обходное и радикальное решение", html: KB_L3[2].html },
    { title: "Known Error (известная ошибка)", html: KB_L3[3].html },
    { title: "Problem Record (карточка проблемы)", html: KB_L3[4].html },
    { title: "Методы расследования: 5 почему", html: KB_L3[5].html },
    { title: "Методы расследования: Исикава", html: KB_L3[6].html },
    { title: "Дубликаты и повторные инциденты", html: KB_L3[7].html }
  ];
}

function buildKb() {
  const menu = document.getElementById("kb-menu");
  const content = document.getElementById("kb-content");
  menu.innerHTML = "";
  KB.forEach((k, idx) => {
    const b = document.createElement("button");
    b.className = "kb-menu-item" + (idx === 0 ? " active" : "");
    b.textContent = k.title;
    b.addEventListener("click", () => {
      menu.querySelectorAll(".kb-menu-item").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      content.innerHTML = k.html;
    });
    menu.appendChild(b);
  });
  content.innerHTML = KB[0].html;
}

function openKb() { showModal("modal-kb"); }
function switchKbTab(title) {
  const buttons = document.querySelectorAll(".kb-menu-item");
  for (const btn of buttons) {
    if (btn.textContent === title) { btn.click(); break; }
  }
}
function goToKbTab(title) { openKb(); switchKbTab(title); }

// ============ Snapshot / Level select ============

function makeSnapshot() {
  const level = state.level;
  const snap = {
    level: level,
    results: state.getResults(level),
    total: DataStore.getTickets(level).length
  };
  if (DataStore.getLevelWorkflow(level) === "engineer") {
    snap.createdProblems = state.createdProblems;
  }
  return snap;
}

function applySnapshot(snap) {
  if (!snap || !snap.level) return false;
  state.resultsByLevel[snap.level] = snap.results || {};
  if (snap.createdProblems) state.createdProblems = snap.createdProblems;
  return true;
}

function renderLevelCards() {
  const summary = ProgressStore.getSummary();
  const wrap = document.getElementById("level-cards");
  wrap.innerHTML = "";
  for (const lvl of DataStore.getLevels()) {
    if (!lvl.queue) continue;
    const total = DataStore.getTickets(lvl.id).length;
    const s = summary["level" + lvl.id];
    const done = s ? s.done : 0;
    const badge = s && s.finishedAt ? " · завершён" : "";

    const card = document.createElement("div");
    card.className = "level-card";
    card.innerHTML = `
      <div class="level-title">${lvl.title}</div>
      <div class="level-desc">${lvl.desc}</div>
      <div class="level-meta">${done} / ${total} обработано${badge}</div>
      <button class="btn primary" data-level="${lvl.id}">Начать</button>
    `;
    card.querySelector("button").addEventListener("click", () => startLevel(lvl.id));
    wrap.appendChild(card);
  }
}

function startLevel(n) {
  resetState();
  state.level = n;
  const saved = ProgressStore.load(n);
  if (saved) applySnapshot(saved);

  const lvl = DataStore.getLevel(n);
  if (!lvl || !lvl.queue) return;
  renderQueue();
  showScreen(lvl.queue.screen);
  if (lvl.intro && lvl.intro.modal) showModal(lvl.intro.modal);
}

document.addEventListener("DOMContentLoaded", () => {
  window.__initPromise__ = init();
});
