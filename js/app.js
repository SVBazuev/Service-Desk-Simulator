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

  document.getElementById("btn-clarify").addEventListener("click", requestClarification);
  document.getElementById("btn-reg").addEventListener("click", register);
  document.getElementById("btn-finish").addEventListener("click", () => showResults(1));

  document.getElementById("btn-assign-l2").addEventListener("click", assignL2);
  document.getElementById("btn-finish-l2").addEventListener("click", () => showResults(2));
  document.getElementById("btn-start-l2-work").addEventListener("click", () => { hideModal("modal-l2-intro"); showScreen("screen-queue-l2"); });
  document.getElementById("btn-start-l3-work").addEventListener("click", () => { hideModal("modal-l3-intro"); showScreen("screen-queue-l3"); });

  document.getElementById("btn-l3-submit").addEventListener("click", l3Submit);
  document.getElementById("btn-l3-cancel").addEventListener("click", l3GoBack);
  document.getElementById("btn-finish-l3").addEventListener("click", () => showResults(3));
  document.getElementById("btn-back-queue-l3").addEventListener("click", l3GoBack);

  // Поля L3 теперь рендерятся динамически (слушатели вешает FormRenderer).
  // Оставляем только дубликаты (они статичны в HTML):
  document.getElementById("l3-dup-of").addEventListener("change", l3Validate);

  const goBack12 = () => { state.currentId = null; if (state.level === 3) { renderQueue(); showScreen("screen-queue-l3"); return; } renderQueue(); showScreen(state.level === 1 ? "screen-queue" : "screen-queue-l2"); };
  const goBack = () => { state.currentId = null; renderQueue(); showScreen(state.level === 1 ? "screen-queue" : "screen-queue-l2"); };

  document.getElementById("btn-cancel").addEventListener("click", goBack12);
  document.getElementById("btn-back-queue").addEventListener("click", goBack12);

  document.querySelectorAll(".modal-close, [data-close]").forEach(b => {
    b.addEventListener("click", () => { const id = b.getAttribute("data-close"); if (id) hideModal(id); });
  });
  document.querySelectorAll("[id^='btn-org-list']").forEach(b => b.addEventListener("click", openOrgList));
  document.querySelectorAll("[id^='btn-emp-list']").forEach(b => b.addEventListener("click", (e) => openEmpList(state.level === 3 ? DataStore.getEmployeesL3() : DataStore.getEmployees())));
  document.querySelectorAll("[id^='btn-kb']").forEach(b => b.addEventListener("click", openKb));
  document.querySelectorAll("[id^='btn-problems']").forEach(b => b.addEventListener("click", openProblems));

  document.getElementById("btn-res-restart").addEventListener("click", restart);
  document.getElementById("btn-reg-ok").addEventListener("click", () => {
    hideModal("modal-reg");
    if (state.level === 3) { l3GoBack(); return; }
    goBack();
  });
  document.getElementById("btn-assign-ok").addEventListener("click", () => {
    hideModal("modal-assign");
    state.currentId = null;
    renderQueue();
    showScreen("screen-queue-l2");
  });

  buildKb();
}

function updateProductSelect(org) {
  const prods = org && org.products ? org.products.map(p => ({ value: p.name, label: p.name })) : [];
  const uniqueProds = [];
  const seen = new Set();
  for (const p of prods) { if (!seen.has(p.value)) { seen.add(p.value); uniqueProds.push(p); } }
  fillSelect(document.getElementById("card-prod"), uniqueProds);
}

function requestClarification() {
  const t = getTicket(state.currentId);
  if (!t || !t.clarification) return;
  document.getElementById("frm-clarify-text").textContent = t.clarification;
  document.getElementById("clarify-block").style.display = "block";
  document.getElementById("btn-clarify").style.display = "none";
}

function renderQueue() {
  const list = document.getElementById(state.level === 1 ? "queue-list" : state.level === 2 ? "queue-list-l2" : "queue-list-l3");
  list.innerHTML = "";
  let done = 0;
  const tickets = getTickets();
  const results = getResults();

  if (state.level === 1) {
    document.getElementById("q-total").textContent = TICKETS.length;
  } else if (state.level === 2) {
    document.getElementById("q-total-l2").textContent = TICKETS_L2.length;
  } else {
    document.getElementById("q-total-l3").textContent = TICKETS_L3.length;
  }

  for (const t of tickets) {
    const reg = results[t.id] && results[t.id].registered;
    if (reg) done++;
    const item = document.createElement("div");
    item.className = "queue-item" + (reg ? " done" : "");

    let title = t.title;
    if (state.level === 1) {
      const org = getOrg(t.orgId);
      title = `Обращение от ${org ? org.name : ""} (${t.channel})`;
    } else if (state.level === 3) {
      const org = getOrg(t.orgId);
      title = `${org ? org.name : ""} - ${t.title}`;
    }

    item.innerHTML = `
      <div class="queue-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">${state.level === 1 ? '<path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor"/>' : '<path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" stroke="currentColor"/>'}</svg>
        <div><div class="queue-title">${title}</div><div class="queue-sub">${t.id} • ${t.title || t.prod || ''}</div></div>
      </div>
      <div class="badge">${reg ? (state.level === 1 ? "Зарегистрировано" : state.level === 2 ? "Распределено" : "Решено") : "Ожидает"}</div>
    `;
    if (!reg) item.addEventListener("click", () => openWork(t.id));
    list.appendChild(item);
  }

  if (state.level === 1) {
    document.getElementById("q-done").textContent = done.toString();
    document.getElementById("btn-finish").disabled = done < TICKETS.length;
  } else if (state.level === 2) {
    document.getElementById("q-done-l2").textContent = done.toString();
    document.getElementById("btn-finish-l2").disabled = done < TICKETS_L2.length;
  } else {
    document.getElementById("q-done-l3").textContent = done.toString();
    document.getElementById("btn-finish-l3").disabled = done < TICKETS_L3.length;
  }
}

function openWork(id) {
  if (state.level === 3) { openL3Work(id); return; }
  const isL2 = state.level === 2;
  const t = getTicket(id);
  if (!t) return;
  state.currentId = id;

  // 1. Рендерим форму на основе схемы (L2 или L1)
  const schema = isL2 ? SCHEMA_L2 : SCHEMA_L1;
  FormRenderer.render("dynamic-form-container", schema);

  // 2. Навешиваем обработчики на новые поля
  document.getElementById("card-org").addEventListener("change", onCardOrg);
  document.getElementById("card-prod").addEventListener("change", onCardProd);
  document.getElementById("card-cat").addEventListener("change", onCardCat);
  document.getElementById("card-imp").addEventListener("change", onCardPri);
  document.getElementById("card-urg").addEventListener("change", onCardPri);
  document.getElementById("card-cont").addEventListener("change", validate);
  document.getElementById("card-chan").addEventListener("change", validate);
  document.getElementById("card-type").addEventListener("change", onCardType);
  document.getElementById("card-title").addEventListener("input", validate);
  document.getElementById("card-desc").addEventListener("input", validate);
  document.getElementById("card-sub").addEventListener("change", validate);

  if (isL2) {
    document.getElementById("card-assignee").addEventListener("change", validate);
    document.getElementById("card-comment").addEventListener("change", validate);
  }

  // 3. Заполняем базовые списки опций
  fillSelect(document.getElementById("card-org"), DataStore.getOrgs().map(o => ({value:o.id, label:o.name})));
  fillSelect(document.getElementById("card-prod"), []);
  fillSelect(document.getElementById("card-cat"), []);
  fillSelect(document.getElementById("card-sub"), []);

  if (isL2) {
    fillSelect(document.getElementById("card-assignee"), DataStore.getEmployees().map(e => ({
      value: e.id,
      label: `${e.name} (${e.role}) • В работе: ${e.workload !== undefined ? e.workload : 0} - ${e.status}`
    })));
    fillSelect(document.getElementById("card-comment"), DataStore.getCommentsL2().map(c => ({value:c.id, label:c.text})));
  }

  // 4. Заполняем данные из тикета
  const org = getOrg(t.orgId);
  const c = CONTACTS.find(x => x.id === t.contactId);

  document.getElementById("work-title").textContent = isL2 ? "Распределение задач (Тимлид)" : "Рабочее место";
  document.getElementById("work-num").textContent = t.id;
  document.getElementById("frm-org").textContent = org ? org.name : "";
  document.getElementById("frm-cont").textContent = c ? (c.name + ", " + c.title) : "";
  document.getElementById("frm-chan").textContent = t.channel;
  document.getElementById("frm-title").textContent = t.title;
  document.getElementById("frm-text").textContent = t.text;

  document.getElementById("clarify-block").style.display = "none";
  document.getElementById("btn-clarify").style.display = t.clarification ? "block" : "none";

  document.getElementById("card-org").value = org ? org.id : "";
  onCardOrg(); // Это заполнит контакты и продукты

  document.getElementById("card-cont").value = c ? c.id : "";
  document.getElementById("card-chan").value = t.channel;
  document.getElementById("card-title").value = t.title;
  document.getElementById("card-desc").value = t.text;

  if (isL2) {
    document.getElementById("card-type").value = t.type; onCardType();
    document.getElementById("card-prod").value = t.prod; onCardProd();
    document.getElementById("card-cat").value = t.cat; onCardCat();
    document.getElementById("card-sub").value = t.sub;
    document.getElementById("card-imp").value = t.imp;
    document.getElementById("card-urg").value = t.urg; onCardPri();

    document.querySelectorAll("#screen-work .form-grid select, #screen-work .form-grid input, #screen-work .form-grid textarea, #btn-add-prod, #sel-add-prod").forEach(el => el.disabled = false);
    document.querySelectorAll("#ver-list select, #ver-list button").forEach(el => el.disabled = false);

    document.getElementById("auto-box").style.display = "block";
    document.getElementById("prio-hint").style.display = "none";
    document.getElementById("btn-reg").style.display = "none";
    document.getElementById("btn-assign-l2").style.display = "inline-block";
    document.getElementById("btn-assign-l2").disabled = true;
    document.getElementById("ro-resp").textContent = "Тимлид команды Бета";

    document.getElementById("card-assignee").value = "";
    document.getElementById("card-comment").value = "";
  } else {
    document.getElementById("card-type").value = ""; onCardType();
    document.getElementById("card-prod").value = "";
    fillSelect(document.getElementById("card-cat"), []);
    fillSelect(document.getElementById("card-sub"), []);
    document.getElementById("card-imp").value = "";
    document.getElementById("card-urg").value = "";

    document.querySelectorAll("#screen-work .form-grid select, #screen-work .form-grid input, #screen-work .form-grid textarea, #btn-add-prod, #sel-add-prod").forEach(el => el.disabled = false);
    document.querySelectorAll("#ver-list select, #ver-list button").forEach(el => el.disabled = false);

    document.getElementById("auto-box").style.display = "block";
    document.getElementById("btn-reg").style.display = "inline-block";
    document.getElementById("btn-assign-l2").style.display = "none";
    document.getElementById("ro-resp").textContent = "текущий регистратор";

    document.getElementById("auto-prio").textContent = "-";
    document.getElementById("auto-react").textContent = "-";
    document.getElementById("auto-sol").textContent = "-";
    document.getElementById("btn-reg").disabled = true;
  }

  document.getElementById("ro-num").textContent = t.id;
  showScreen("screen-work");
  validate();
}

function onCardOrg() {
  const oid = document.getElementById("card-org").value;
  const org = getOrg(oid);
  const conts = getContactsByOrg(oid);
  fillSelect(document.getElementById("card-cont"), conts.map(c => ({value:c.id, label:c.name})));
  updateProductSelect(org);
  fillSelect(document.getElementById("card-cat"), []);
  fillSelect(document.getElementById("card-sub"), []);
  state.orgVersions = getOrgVersions(org).map((p, idx) => ({ id: idx, name: p.name, ver: p.ver }));
  renderVerList();
  validate();
}

function renderVerList() {
  const list = document.getElementById("ver-list");
  list.innerHTML = "";
  if (!state.orgVersions || state.orgVersions.length === 0) {
    list.innerHTML = "<div style='color:var(--sub);font-size:13px'>Нет данных</div>";
    renderAddProdSelect(); validate(); return;
  }
  for (const v of state.orgVersions) {
    const row = document.createElement("div");
    row.className = "ver-row";
    row.innerHTML = `<div class="ver-name">${v.name}</div><select data-ver-id="${v.id}"><option value="${v.ver}">${v.ver}</option></select><button class="ver-del" data-del-id="${v.id}">×</button>`;
    list.appendChild(row);
  }
  list.querySelectorAll("select").forEach(sel => sel.addEventListener("change", validate));
  list.querySelectorAll(".ver-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const idv = parseInt(btn.getAttribute("data-del-id"));
      state.orgVersions = state.orgVersions.filter(x => x.id !== idv);
      renderVerList(); validate();
    });
  });
  renderAddProdSelect(); validate();
}

function renderAddProdSelect() {
  const sel = document.getElementById("sel-add-prod");
  if (!sel) return;
  const added = new Set((state.orgVersions || []).map(v => v.name));
  const org = getOrg(document.getElementById("card-org").value);
  const full = getOrgVersions(org).map((p, idx) => ({ id: idx, name: p.name, ver: p.ver }));
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = ""; def.textContent = "Выберите продукт из справочника"; sel.appendChild(def);
  for (const p of full) { if (!added.has(p.name)) { const opt = document.createElement("option"); opt.value = p.name; opt.textContent = p.name + " " + p.ver; sel.appendChild(opt); } }
  const btn = document.getElementById("btn-add-prod");
  if (btn) btn.disabled = (sel.options.length <= 1);
}

function addProductToCard() {
  const sel = document.getElementById("sel-add-prod");
  const name = sel.value; if (!name) return;
  const org = getOrg(document.getElementById("card-org").value);
  const full = getOrgVersions(org).map((p, idx) => ({ id: idx, name: p.name, ver: p.ver }));
  const p = full.find(x => (x.name + " " + x.ver) === name || x.name === name);
  if (!p || state.orgVersions.some(v => v.name === p.name)) return;
  state.orgVersions.push({ id: Date.now(), name: p.name, ver: p.ver });
  renderVerList(); validate();
}

function onCardProd() {
  const p = document.getElementById("card-prod").value;
  fillSelect(document.getElementById("card-cat"), []);
  fillSelect(document.getElementById("card-sub"), []);
  if (p && TAX[p]) { for (const c of TAX[p]) { const opt = document.createElement("option"); opt.value = c.name; opt.textContent = c.name; document.getElementById("card-cat").appendChild(opt); } }
  validate();
}

function onCardCat() {
  const p = document.getElementById("card-prod").value;
  const cname = document.getElementById("card-cat").value;
  fillSelect(document.getElementById("card-sub"), []);
  const subs = getSubList(p, cname);
  for (const s of subs) { const opt = document.createElement("option"); opt.value = s; opt.textContent = s; document.getElementById("card-sub").appendChild(opt); }
  validate();
}

function onCardType() {
  const type = document.getElementById("card-type").value;
  const hint = document.getElementById("prio-hint");
  const imp = document.getElementById("card-imp");
  const urg = document.getElementById("card-urg");

  if (state.level === 1) {
    imp.value = ""; urg.value = "";
    if (type === "Запрос на обслуживание" || type === "Консультация") {
      hint.style.display = "block"; imp.value = "средняя"; urg.value = "средняя";
    } else {
      hint.style.display = "none";
    }
  }
  onCardPri();
}

function onCardPri() {
  const imp = document.getElementById("card-imp").value;
  const urg = document.getElementById("card-urg").value;
  const m = calcPriority(imp, urg);
  if (m) { document.getElementById("auto-prio").textContent = m.prio; document.getElementById("auto-react").textContent = m.react; document.getElementById("auto-sol").textContent = m.sol; }
  else { document.getElementById("auto-prio").textContent = "-"; document.getElementById("auto-react").textContent = "-"; document.getElementById("auto-sol").textContent = "-"; }
  validate();
}

function validate() {
  const need = ["card-org","card-cont","card-chan","card-type","card-prod","card-cat","card-sub","card-imp","card-urg"];
  let ok = true;
  for (const id of need) { const el = document.getElementById(id); if (!el || el.value === "") ok = false; }

  const titleEl = document.getElementById("card-title");
  if (titleEl && titleEl.value.trim() === "") ok = false;

  const descEl = document.getElementById("card-desc");
  if (descEl && descEl.value.trim() === "") ok = false;

  if (!state.orgVersions || state.orgVersions.length === 0) ok = false;

  if (state.level === 2) {
    const ass = document.getElementById("card-assignee");
    const com = document.getElementById("card-comment");
    if (!ass || ass.value === "") ok = false;
    if (!com || com.value === "") ok = false;
    document.getElementById("btn-assign-l2").disabled = !ok;
  } else {
    document.getElementById("btn-reg").disabled = !ok;
  }
}

function register() {
  const t = TICKETS.find(x => x.id === state.currentId);
  if (!t) return;
  const formData = {
    org: document.getElementById("card-org").value,
    cont: document.getElementById("card-cont").value,
    chan: document.getElementById("card-chan").value,
    type: document.getElementById("card-type").value,
    prod: document.getElementById("card-prod").value,
    cat: document.getElementById("card-cat").value,
    sub: document.getElementById("card-sub").value,
    vers: state.orgVersions.map(v => v.name + " " + v.ver),
    imp: document.getElementById("card-imp").value,
    urg: document.getElementById("card-urg").value
  };
  const schema = DataStore.getSchemas()[1];
  state.results[t.id] = Validator.validate(schema, t, formData);
  ProgressStore.save(1, makeSnapshot());
  document.getElementById("reg-ok-id").textContent = t.id;
  showModal("modal-reg");
}

function assignL2() {
  const t = TICKETS_L2.find(x => x.id === state.currentId);
  if (!t) return;
  const formData = {
    org: document.getElementById("card-org").value,
    cont: document.getElementById("card-cont").value,
    chan: document.getElementById("card-chan").value,
    type: document.getElementById("card-type").value,
    prod: document.getElementById("card-prod").value,
    cat: document.getElementById("card-cat").value,
    sub: document.getElementById("card-sub").value,
    vers: state.orgVersions.map(v => v.name + " " + v.ver),
    imp: document.getElementById("card-imp").value,
    urg: document.getElementById("card-urg").value,
    assignee: document.getElementById("card-assignee").value,
    comment: document.getElementById("card-comment").value
  };
  const schema = DataStore.getSchemas()[2];
  state.resultsL2[t.id] = Validator.validate(schema, t, formData);
  ProgressStore.save(2, makeSnapshot());
  document.getElementById("assign-ok-id").textContent = t.id;
  showModal("modal-assign");
  const assignedEmp = DataStore.getEmployees().find(e => e.id === formData.assignee);
  if (assignedEmp && assignedEmp.workload !== undefined) assignedEmp.workload += 1;
}

// ===== УРОВЕНЬ 3: Инженер 2-й линии =====

function l3RequestClarify() {
  const t = getTicket(state.currentId);
  if (!t || !t.clarifications || t.clarifications.length === 0) return;
  state.l3.requestedClarify = true;
  state.l3.clarified = true;
  const schema = DataStore.getSchemas()[3];
  const action = (schema.actions || []).find(a => a.id === "clarify");
  if (action) FormRenderer.applyAction(action, { ticket: t });
}

function l3Validate() {
  const t = DataStore.getTicket(3, state.currentId);
  const hint = document.getElementById("l3-submit-hint");
  const btn = document.getElementById("btn-l3-submit");
  if (!t) return;

  const schema = DataStore.getSchemas()[3];
  const formData = FormRenderer.getFormData("l3-dynamic-form", schema);

  const missing = [];
  // Проходим по полям схемы
  for (const field of schema.fields) {
    if (!field.required) continue;

    if (field.type === 'composite') {
      // Если блок видим (showIf), проверяем вложенные
      const fieldset = document.getElementById('field-' + field.id);
      if (fieldset && fieldset.style.display !== 'none') {
        for (const sub of field.fields) {
          if (sub.required && (!formData[sub.id] || formData[sub.id].length === 0)) missing.push(sub.label);
        }
      }
    } else {
      if (!formData[field.id] || formData[field.id].length === 0) missing.push(field.label);
    }
  }

  btn.disabled = missing.length > 0;
  if (missing.length > 0) {
    hint.style.display = "block";
    hint.innerHTML = "Заполните: " + missing.join(", ");
  } else {
    hint.style.display = "none";
    hint.textContent = "";
  }
}

function l3GoBack() {
  state.currentId = null;
  state.l3 = { requestedClarify: false, clarified: false, diagOpen: null };
  document.getElementById("l3-dup-of").innerHTML = "";
  document.getElementById("l3-dup-block").style.display = "none";
  document.getElementById("l3-dup-link").style.display = "none";
  document.getElementById("l3-dup-hint").style.display = "none";
  document.getElementById("l3-clarify-block").style.display = "none";
  document.getElementById("l3-clarify-text").textContent = "";
  renderQueue();
  showScreen("screen-queue-l3");
}

function openL3Work(id) {
  const t = DataStore.getTicket(3, id);
  if (!t) return;
  state.currentId = id;
  state.l3 = { requestedClarify: false, clarified: false, diagOpen: null };

  const org = getOrg(t.orgId);
  const c = CONTACTS.find(x => x.id === t.contactId);
  document.getElementById("work-num-l3").textContent = t.id;
  document.getElementById("l3-frm-org").textContent = org ? org.name : "";
  document.getElementById("l3-frm-cont").textContent = c ? (c.name + ", " + c.title) : "";
  document.getElementById("l3-frm-chan").textContent = t.channel;
  const m = calcPriority(t.imp, t.urg);
  document.getElementById("l3-frm-prio").textContent = t.type + " • " + (m ? m.prio : "-");
  document.getElementById("l3-frm-title").textContent = t.title;
  document.getElementById("l3-frm-text").textContent = t.text;
  document.getElementById("l3-clarify-block").style.display = "none";
  document.getElementById("l3-clarify-text").textContent = "";

  const dupSel = document.getElementById("l3-dup-of");
  dupSel.innerHTML = "";
  if (t.duplicateOf) {
    const prev = TICKETS_L3.find(x => x.id === t.duplicateOf);
    const opt = document.createElement("option");
    opt.value = t.duplicateOf;
    opt.textContent = prev ? (prev.id + " • " + prev.title) : t.duplicateOf;
    dupSel.appendChild(opt);
  }

  // --- ДИНАМИЧЕСКИЙ РЕНДЕРИНГ ФОРМЫ ---
  const schema = DataStore.getSchemas()[3];
  FormRenderer.render("l3-dynamic-form", schema, { ticket: t });
  FormRenderer.renderTabs('l3-diag-tabs', schema, { ticket: t });
  FormRenderer.bindActions(schema, { ticket: t });

  // --- ОБНОВЛЕНИЕ RO-БЛОКА ---
  document.getElementById("l3-ro-num").textContent = t.id;
  document.getElementById("l3-ro-prod").textContent = t.ver;
  document.getElementById("l3-ro-imp").textContent = t.imp + " / " + t.urg;
  document.getElementById("l3-ro-sla").textContent = m ? (m.react + " / " + m.sol) : "-";

  showScreen("screen-work-l3");
  l3Validate();
}

function l3Submit() {
  const t = DataStore.getTicket(3, state.currentId);
  if (!t) return;

  const schema = DataStore.getSchemas()[3];
  const formData = FormRenderer.getFormData("l3-dynamic-form", schema);

  // Специфичные поля (дубликат)
  formData.dupVal = document.getElementById("l3-dup-of").value;

  const result = Validator.validate(schema, t, formData);
  state.resultsL3[t.id] = result;

  if (formData.outcome === "new_problem" && result.ok) {
    if (!state.createdProblems.includes(t.problem?.record)) {
      state.createdProblems.push(t.problem?.record);
    }
  }

  document.getElementById("reg-ok-id").textContent = t.id;
  showModal("modal-reg");
  ProgressStore.save(3, makeSnapshot());
}

function openProblems() {
  const body = document.getElementById("problems-body");
  body.innerHTML = "";
  const resolvedIds = Object.keys(state.resultsL3).filter(id => state.resultsL3[id].registered);

  if (resolvedIds.length === 0) {
    body.innerHTML = "<div style='color: var(--sub); font-size: 14px;'>Пока нет зарегистрированных Problem Records. Они появляются, когда вы закрываете обращение с исходом «Known Error».</div>";
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
      rfc: "Бэкпортировать механизм фильтрации уведомлений по ролям/событиям из 5.0 в 4.9 либо согласовать план обновления клиентов 4.9 до 5.x. До внедрения - ручная настройка событий «на согласовании мне» и «отклонено».",
      archiveList: [
        { id: "TK-310", title: "Массовая рассылка уведомлений парализует работу отдела", org: "АО «Северная Мебель»" }
      ]
    });
  }

  for (const p of displayProblems) {
    const archiveList = p.archiveList || ARCHIVE_INCIDENTS[p.id] || [];
    const linked = archiveList.map(inc => {
      return `<li style="margin-bottom: 4px;">${inc.id} • ${inc.title} <span class="tag ok" style="font-size: 11px;">закрыто</span> <span style="color: var(--sub); font-size: 11px;">(${inc.org})</span></li>`;
    }).join("");
    const card = document.createElement("div");
    card.style.cssText = "border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: #f8fafc;";
    const statusBadge = p.status === "resolved"
      ? '<span class="tag ok" style="margin-left: 8px;">Исправлена</span>'
      : '<span class="tag bad" style="margin-left: 8px;">В работе (известная ошибка)</span>';

    card.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 6px;">${p.id} • ${p.title} ${statusBadge}</div>
      <div style="font-size: 13px; color: var(--sub); margin-bottom: 8px;">Первопричина: ${p.rootCause}</div>
      <div style="font-size: 13px;"><b>Связанные инциденты:</b><ul style="margin: 6px 0 8px 18px; padding: 0;">${linked}</ul></div>
      <div style="font-size: 13px;"><b>Владелец:</b> ${DataStore.getEmployeesL3().find(e => e.id === p.owner)?.name || p.owner} • <b>Метод:</b> ${p.method} • <b>Влияние:</b> ${p.impact} • <b>Вероятность:</b> ${p.prob}</div>
      <div style="font-size: 13px; margin-top: 8px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 8px;"><b>RFC:</b> ${p.rfc}</div>
    `;
    body.appendChild(card);
  }
  showModal("modal-problems");
}

function showResults(level) {
  const tbody = document.querySelector("#res-table tbody");
  tbody.innerHTML = "";
  const tickets = level === 1 ? TICKETS : level === 2 ? TICKETS_L2 : TICKETS_L3;
  const results = level === 1 ? state.results : level === 2 ? state.resultsL2 : state.resultsL3;
  document.getElementById("res-title").textContent = `Итоги работы (Уровень ${level})`;

  for (const t of tickets) {
    const r = results[t.id] || {registered:false, errs:[], comparison:[], ok:false};
    const tr = document.createElement("tr");

    let formHtml = "";
    if (level === 1) {
      const orgObj = getOrg(t.orgId); const contactObj = CONTACTS.find(c => c.id === t.contactId);
      formHtml = `<div style="font-size: 12px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 10px;"><div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${t.id} • ${t.title}</div><div class="kv" style="gap: 4px; margin-bottom: 8px;"><div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div><div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div></div><div class="text-block" style="margin-top: 0; margin-bottom: 8px;"><div class="text-block-title" style="font-size: 12px; padding: 6px 10px;">Текст</div><div class="text-block-content" style="font-size: 12px; padding: 10px; white-space: pre-wrap;">${t.text}</div></div></div>`;
    } else if (level === 3) {
      const orgObj = getOrg(t.orgId); const contactObj = CONTACTS.find(c => c.id === t.contactId);
      formHtml = `<div style="font-size: 12px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 10px;"><div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${t.id} • ${t.title}</div><div class="kv" style="gap: 4px; margin-bottom: 8px;"><div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div><div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div><div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Продукт</span><span class="kv-val">${t.ver}</span></div></div><div class="text-block" style="margin-top: 0; margin-bottom: 8px;"><div class="text-block-title" style="font-size: 12px; padding: 6px 10px;">Текст</div><div class="text-block-content" style="font-size: 12px; padding: 10px; white-space: pre-wrap;">${t.text}</div></div>${t.clarifications && t.clarifications.length ? `<div style="font-size: 11px; color: #1e40af; background: #eff6ff; padding: 8px; border-radius: 4px;"><b>Уточнение заказчика:</b> ${t.clarifications[0].answer}</div>` : ""}</div>`;
    } else {
      formHtml = `<div style="font-size: 12px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 10px;"><div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${t.id} • ${t.title}</div><div class="text-block" style="margin-top: 0; margin-bottom: 8px;"><div class="text-block-title" style="font-size: 12px; padding: 6px 10px;">Текст</div><div class="text-block-content" style="font-size: 12px; padding: 10px; white-space: pre-wrap;">${t.text}</div></div></div>`;
    }

    let compHtml = `<div class="comparison-list">`;
    if (r.registered && r.comparison && r.comparison.length > 0) {
      for (const c of r.comparison) {
        compHtml += `<div class="comp-item ${c.isError ? 'error' : 'success'}"><div class="comp-field">${c.field}</div><div class="comp-values"><span class="comp-val ${c.isError ? 'bad' : 'good'}">${c.isError ? 'Ваш ответ: ' + c.value : '✓ ' + c.value}</span>${c.isError ? `<span class="comp-val good">Нужно: ${c.expected}</span>` : ''}</div>${c.isError ? `<div class="comp-explain">${c.explain}</div>` : ''}</div>`;
      }
    } else { compHtml += `<div style="color: var(--sub); font-size: 13px; padding: 10px;">Не обработано.</div>`; }
    compHtml += `</div>`;

    let statusHtml = r.registered ? (r.ok ? `<span class="tag ok">Успех</span>` : `<span class="tag bad">Есть ошибки</span>`) : `<span class="tag bad">Не обработано</span>`;

    tr.innerHTML = `<td style="vertical-align: top;">${formHtml}</td><td style="vertical-align: top;">${statusHtml}</td><td style="vertical-align: top;">${compHtml}</td>`;
    tbody.appendChild(tr);
  }

  showScreen("screen-res");
  ProgressStore.save(level, { ...makeSnapshot(), finishedAt: Date.now() });
}

function restart() {
  resetState();
  showScreen("screen-start");
}

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
    tr.innerHTML = `<td><b>${emp.name}</b></td><td>${emp.role}</td><td>${emp.spec}</td><td>${workloadText}</td><td style="color: ${statusColor}; font-weight: 600;">${emp.status}</td>`;
    tbody.appendChild(tr);
  }
  showModal("modal-emp-list");
}

function openContacts(orgId, orgName) {
  document.getElementById("contacts-org-name").textContent = orgName;
  const tbody = document.getElementById("contacts-list-body");
  tbody.innerHTML = "";
  const contacts = getContactsByOrg(orgId);
  if (contacts.length === 0) { tbody.innerHTML = "<tr><td colspan='2'>Нет контактных лиц</td></tr>"; }
  else { for (const c of contacts) { const tr = document.createElement("tr"); tr.innerHTML = `<td>${c.name}</td><td>${c.title}</td>`; tbody.appendChild(tr); } }
  showModal("modal-contacts");
}

let KB = [];

function bootstrapKb() {
  KB = [
    { title: "О компании «Про.Софт»", html: `<h3>О компании «Про.Софт»</h3><p><b>ООО «Про.Софт»</b> - российский разработчик корпоративного программного обеспечения.</p><p>Более 12 лет создаёт и развивает продукты для электронного документооборота, управления продажами и закупками.</p>` },
    { title: "Продукты компании", html: `<h3>Продукты</h3><table><tr><th>Продукт</th><th>Назначение</th></tr><tr><td>Про.Документы</td><td>Система электронного документооборота (СЭД). Позволяет управлять договорами, внутренним согласованием документов, ведением карточек контрагентов и настройкой маршрутов.</td></tr><tr><td>Про.Продажи</td><td>Система управления взаимоотношениями с клиентами (CRM). Позволяет вести клиентскую базу, управлять сделками и воронкой продаж, строить аналитические отчеты.</td></tr><tr><td>Про.Закупки</td><td>Система управления закупками (SRM). Позволяет создавать и согласовывать заявки на закупку, вести каталог товаров и поставщиков, контролировать исполнения договоров.</td></tr></table>` },
    { title: "Типы обращений", html: `<h3>Типы обращений</h3><table><tr><th>Тип</th><th>Описание</th></tr><tr><td>Инцидент</td><td>Незапланированный сбой или снижение качества работы ПО.</td></tr><tr><td>Запрос на обслуживание</td><td>Стандартная процедура (дистрибутив, доступ, лицензия).</td></tr><tr><td>Консультация</td><td>Вопрос по использованию, настройке или возможностям продукта.</td></tr></table>` },
    { title: "Линии поддержки и Эскалация", html: `<h3>Линии поддержки</h3><p>Работа техподдержки делится на уровни (линии). Каждая линия решает задачи определенной сложности.</p><table><tr><th>Линия</th><th>Задачи</th><th>Кто работает</th></tr><tr><td>1-я линия (L1)</td><td>Прием обращений, регистрация, консультации по базовым вопросам, выдача доступов и дистрибутивов.</td><td>Иванов Иван, Фёдорова Ольга, Волкова Дарья</td></tr><tr><td>2-я линия (L2)</td><td>Решение типовых инцидентов, требующих экспертизы в продукте (настройка, анализ логов, обходные пути).</td><td>Петрова Анна, Сидоров Олег, Никитин Павел, Морозов Артём</td></tr><tr><td>3-я линия (L3)</td><td>Сложные инциденты, баги в коде, проблемы с БД и инфраструктурой. Передача разработчикам.</td><td>Кузнецов Сергей</td></tr></table><h3>Эскалация</h3><p><b>Эскалация</b> – это передача обращения на более высокий уровень компетенции или ответственности, когда текущих полномочий, знаний или ресурсов недостаточно для решения. Это рабочий инструмент, а не признак плохой работы!</p><ul><li><b>Функциональная (горизонтальная):</b> привлечение более опытного коллеги (например, с L1 на L2 или L3).</li><li><b>Иерархическая (вертикальная):</b> подключение руководителя или менеджера (например, при риске нарушения SLA, недовольстве клиента, вопросах оплаты/сроков).</li></ul><p><i>Когда эскалировать:</i> ситуация выходит за рамки компетенции; требуется привлечение смежного отдела; есть риск нарушения SLA; клиент проявляет недовольство.</p>` },
    { title: "Управление инцидентами", html: `<h3>Управление инцидентами (Incident Management)</h3><p>Практика ITIL, цель которой - как можно быстрее восстановить нормальную работу ИТ-услуг.</p><p><b>Жизненный цикл инцидента:</b></p><ol><li><b>Выявление:</b> пользователь или мониторинг зафиксировали сбой.</li><li><b>Регистрация:</b> создание тикета, фиксация данных.</li><li><b>Классификация:</b> определение категории (кому передать).</li><li><b>Приоритизация:</b> оценка важности и срочности (по матрице).</li><li><b>Распределение:</b> назначение исполнителя.</li><li><b>Диагностика:</b> поиск причины (сбор логов, опрос пользователя).</li><li><b>Решение:</b> устранение причин/условий (или предоставление обходного пути).</li><li><b>Закрытие:</b> подтверждение решения у пользователя.</li></ol><p><b>Важно:</b> Инцидент - это симптом. Мы лечим симптом (восстанавливаем работу). Причину лечит управление проблемами.</p>` },
    { title: "Управление проблемами", html: `<h3>Управление проблемами (Problem Management)</h3><p>Практика ITIL, которая находит корневые причины инцидентов и не дает сбоям повторяться.</p><p><b>Проблема</b> – это скрытая причина одного или нескольких инцидентов.</p><p><b>Жизненный цикл проблемы:</b></p><ol><li>Выявление (по повторяющимся инцидентам).</li><li>Регистрация (назначение владельца).</li><li>Категоризация.</li><li>Приоритизация (оценка влияния и вероятности повторения).</li><li><b>Расследование:</b> поиск Root Cause (первопричины). Используются методы: 5 почему, диаграмма Исикавы.</li><li>Решение: создание запроса на изменение (RFC) для разработчиков.</li><li>Закрытие (после внедрения исправления и проверки).</li><li>Контроль (наблюдение, не вернулась ли проблема).</li></ol><p><b>Известная ошибка (Known Error):</b> проблема, причина которой найдена, но исправление еще не внедрено. Для нее фиксируется обходное решение, которым пользуется поддержка.</p>` },
    { title: "Каналы связи", html: `<h3>Каналы связи</h3><p>Канал связи показывает, каким именно способом заказчик обратился в поддержку. Это важно для понимания контекста обращения и выбора способа ответа.</p><table><tr><th>Канал</th><th>Описание</th></tr><tr><td>Email</td><td>Письмо на почту поддержки. Позволяет приложить скриншоты и подробно описать проблему.</td></tr><tr><td>Телефон</td><td>Звонок на горячую линию. Требует оперативного ответа, но может быть менее детальным. Регистратор фиксирует суть разговора.</td></tr><tr><td>Портал самообслуживания</td><td>Заявка, которую пользователь самостоятельно оформил в личном кабинете. Обычно содержит структурированную информацию.</td></tr><tr><td>Чат на сайте</td><td>Онлайн-консультация. Позволяет быстро уточнить детали в диалоге.</td></tr><tr><td>Мессенджер</td><td>Обращение через Telegram, WhatsApp и другие системы. Не всегда официальный канал, но часто используется для быстрых вопросов.</td></tr></table>` },
    { title: "Важность и срочность. Матрица приоритета", html: `<h3>Матрица</h3><table><tr><th>Важность \\ Срочность</th><th>Высокая</th><th>Средняя</th><th>Низкая</th></tr><tr><td>Высокая</td><td>Критический</td><td>Высокий</td><td>Средний</td></tr><tr><td>Средняя</td><td>Высокий</td><td>Средний</td><td>Низкий</td></tr><tr><td>Низкая</td><td>Средний</td><td>Низкий</td><td>Низкий</td></tr></table><p style="margin-top: 16px; color: var(--bad);"><b>Важно:</b> Согласно регламентам компании, для типов обращений <b>«Запрос на обслуживание»</b> и <b>«Консультация»</b> по умолчанию автоматически устанавливается <b>средняя важность</b> и <b>средняя срочность</b> (Приоритет «Средний»). Это связано с тем, что данные обращения не блокируют критически важные бизнес-процессы.</p><p>Однако, если в тексте обращения заказчик <u>явно указывает</u> на жесткие дедлайны, остановку работы или высокую критичность (например, «нужно срочно», «работа встала»), регистратор обязан изменить важность или срочность вручную в соответствии с матрицей.</p>` },
    { title: "SLA и сроки", html: `<table><tr><th>Приоритет</th><th>Срок реакции</th><th>Время решения</th></tr><tr><td>Критический</td><td>2 часа</td><td>6 часов</td></tr><tr><td>Высокий</td><td>4 часа</td><td>12 часов</td></tr><tr><td>Средний</td><td>8 часов</td><td>24 часа</td></tr><tr><td>Низкий</td><td>24 часа</td><td>32 часа</td></tr></table>` },
    { title: "Категории и подкатегории", html: `<h3>Категории и подкатегории</h3><p><b>Категория</b> - это крупный модуль или область функционала внутри выбранного продукта.</p><p><b>Подкатегория</b> - это конкретная функция или действие внутри этого модуля. Выбор подкатегории зависит от того, какая категория была выбрана до этого.</p><p style="margin-top: 16px;"><b>Структура категорий по продуктам:</b></p><table><tr><th>Продукт</th><th>Категория</th><th>Возможные подкатегории</th></tr><tr><td rowspan="4"><b>Про.Документы</b></td><td>Документооборот</td><td>Регистрация документов, Согласование документов, Хранение и поиск документов</td></tr><tr><td>Договоры и контрагенты</td><td>Карточки контрагенты, Договоры, Поручения по договорам</td></tr><tr><td>Интеграции и обмен</td><td>Интеграция с 1С, Интеграция с ЭДО, Почтовый обмен</td></tr><tr><td>Стандартные процедуры</td><td>Дистрибутив и обновления, Доступ к сайту поддержки, Лицензии на модули</td></tr><tr><td rowspan="4"><b>Про.Продажи</b></td><td>Клиенты и контакты</td><td>Карточка клиента, Контакты и связи, Сегменты и группы</td></tr><tr><td>Сделки и воронка</td><td>Создание и ведение сделок, Этапы воронки, Задачи и напоминания</td></tr><tr><td>Отчёты и аналитика</td><td>Стандартные отчёты, Дашборды, Экспорт данных</td></tr><tr><td>Стандартные процедуры</td><td>Дистрибутив и обновления, Доступ к сайту поддержки, Лицензии на модули</td></tr><tr><td rowspan="4"><b>Про.Закупки</b></td><td>Заявки на закупку</td><td>Создание заявки, Согласование заявки, Статусы и маршруты</td></tr><tr><td>Поставщики и каталог</td><td>Карточка поставщика, Каталог товаров/услуг, Оценка поставщиков</td></tr><tr><td>Договоры закупок</td><td>Создание договора, Согласование договора, Исполнение и контроль</td></tr><tr><td>Стандартные процедуры</td><td>Дистрибутив и обновления, Доступ к сайту поддержки, Лицензии на модули</td></tr></table><p style="margin-top: 16px; color: var(--bad);"><b>Важно:</b> Категория «Стандартные процедуры» присутствует во всех трех продуктах. Она используется для стандартных процедур: выдачи дистрибутивов, доступов, лицензий. Тип обращения в таком случае должен быть «Запрос на обслуживание».</p>` },
    { title: "Структура карточки обращения", html: `<h3>Структура карточки обращения</h3><table><tr><th>Поле</th><th>Описание</th></tr><tr><td><b>Организация</b></td><td>Наименование организации, от которой поступило обращение. Полное название и описание можно узнать в <span class="kb-link" onclick="goToKbTab('О компании «Про.Софт»')">«Справочнике организаций»</span>.</td></tr><tr><td><b>Контактное лицо</b></td><td>Наименование контактного лица. Указывает, кто именно является инициатором обращения. Список доступных контактов можно посмотреть в «Справочнике организаций», нажав кнопку «Контактные лица».</td></tr><tr><td><b>Канал связи</b></td><td>Откуда поступило обращение (Email, Телефон, Портал, Чат и т.д.). Необходим для понимания контекста и способа ответа. Подробнее о каналах связи можно узнать в разделе Базы знаний <span class="kb-link" onclick="goToKbTab('Каналы связи')">«Каналы связи»</span>.</td></tr><tr><td><b>Заголовок</b></td><td>Краткая суть инцидента или запроса. Обычно заполняется в формате «ошибка + действие, при котором она возникает».</td></tr><tr><td><b>Описание ситуации</b></td><td>Вся информация по обращению, скопированная из формы заказчика.</td></tr><tr><td><b>Тип обращения</b></td><td>Группа (тип), к которой относится обращение: инцидент, запрос на обслуживание или консультация. Подробнее можно узнать в разделе Базы знаний <span class="kb-link" onclick="goToKbTab('Типы обращений')">«Типы обращений»</span>.</td></tr><tr><td><b>Продукт</b></td><td>Программный продукт, с которым возникла проблема или по которому задан вопрос.</td></tr><tr><td><b>Категория</b></td><td>Модуль или область продукта. Зависит от выбранного продукта.</td></tr><tr><td><b>Подкатегория</b></td><td>Конкретный функционал внутри модуля. Зависит от выбранной категории.</td></tr><tr><td><b>Продукты и версии</b></td><td>Список продуктов и их версий, которые используются у заказчика.</td></tr><tr><td><b>Важность</b></td><td>Степень влияния проблемы на бизнес-процессы заказчика.</td></tr><tr><td><b>Срочность</b></td><td>То, как быстро нужно решить проблему.</td></tr><tr><td><b>Номер</b></td><td>Уникальный идентификатор обращения в системе.</td></tr><tr><td><b>Ответственный</b></td><td>Сотрудник поддержки, который взял обращение в работу.</td></tr><tr><td><b>Состояние обращения</b></td><td>Текущий статус обращения.</td></tr><tr><td><b>Код закрытия</b></td><td>Причина, по которой обращение было закрыто.</td></tr><tr><td><b>Приоритет</b></td><td>Рассчитывается автоматически на основе Важности и Срочности по <span class="kb-link" onclick="goToKbTab('Важность и срочность. Матрица приоритета')">матрице приоритетов</span>.</td></tr><tr><td><b>Срок реакции</b></td><td>Время, за которое поддержка должна отреагировать на обращение.</td></tr><tr><td><b>Время решения</b></td><td>Время, отведенное на полное решение проблемы.</td></tr></table>` },
    { title: "Порядок регистрации", html: `<ol><li>Прочитать форму</li><li>При необходимости запросить уточнение у заказчика</li><li>Проверить «Справочник организаций»</li><li>Выбрать тип обращения</li><li>Определить продукт/категорию/подкатегорию</li><li>Проверить продукты и версии</li><li>Оценить важность и срочность</li><li>Зарегистрировать</li></ol>` },
    { title: "Коды закрытия", html: `<ul><li>Решено</li><li>Решено инициатором</li><li>Отказано</li><li>Недостаточно информации</li><li>Дубликат</li><li>Передано</li></ul>` },
    { title: "Частые ошибки", html: `<ul><li>Путаница важности и срочности</li><li>Неверный продукт/категория/подкатегория</li><li>Неверная версия</li><li>Не выбран тип обращения</li></ul>` },
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
function switchKbTab(title) { const buttons = document.querySelectorAll(".kb-menu-item"); for (const btn of buttons) { if (btn.textContent === title) { btn.click(); break; } } }
function goToKbTab(title) { openKb(); switchKbTab(title); }

// Создание и применение снимков состояния
function makeSnapshot() {
  if (state.level === 1) {
    return { level: 1, results: state.results, total: TICKETS.length };
  }
  if (state.level === 2) {
    return { level: 2, results: state.resultsL2, total: TICKETS_L2.length };
  }
  return { level: 3, results: state.resultsL3, createdProblems: state.createdProblems, total: TICKETS_L3.length };
}

function applySnapshot(snap) {
  if (!snap) return false;
  if (snap.level === 1) state.results = snap.results || {};
  else if (snap.level === 2) state.resultsL2 = snap.results || {};
  else {
    state.resultsL3 = snap.results || {};
    state.createdProblems = snap.createdProblems || [];
  }
  return true;
}

const LEVELS = [
  { id: 1, title: "Уровень 1 — Регистрация обращений", desc: "Разбор входящих, заполнение карточки, приоритизация.", total: () => TICKETS.length },
  { id: 2, title: "Уровень 2 — Распределение", desc: "Назначение ответственных, эскалации.", total: () => TICKETS_L2.length },
  { id: 3, title: "Уровень 3 — Решение инцидентов", desc: "Диагностика, Known Error, Problem Management.", total: () => TICKETS_L3.length }
];

function renderLevelCards() {
  const summary = ProgressStore.getSummary();
  const wrap = document.getElementById("level-cards");
  wrap.innerHTML = "";
  for (const lvl of LEVELS) {
    const total = lvl.total();
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

  renderQueue();
  if (n === 1) { showScreen("screen-queue"); return; }
  if (n === 2) { showScreen("screen-queue-l2"); showModal("modal-l2-intro"); return; }
  showScreen("screen-queue-l3"); showModal("modal-l3-intro");
}

document.addEventListener("DOMContentLoaded", () => {
  window.__initPromise__ = init();
});
