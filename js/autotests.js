// ===== Autotests для уровней L1/L2/L3 =====

// Хелпер: установить значение поля в текущей Registry-форме и триггернуть change.
function setField(id, value) {
  const el = state.currentForm && state.currentForm.fields && state.currentForm.fields[id];
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setCheckboxGroup(id, checked) {
  const list = state.currentForm && state.currentForm.slots && state.currentForm.slots[id];
  if (!list) return;
  list.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = !!checked; });
}

// ===== Генерация HTML =====

function generateFormHtml(t, level) {
  if (level === 1) {
    const orgObj = getOrg(t.orgId);
    const contactObj = CONTACTS.find(c => c.id === t.contactId);
    return `
      <div style="font-size:12px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">${t.id} • ${t.title}</div>
        <div class="kv" style="gap:4px;margin-bottom:8px;">
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Канал</span><span class="kv-val">${t.channel}</span></div>
        </div>
        <div class="text-block" style="margin-top:0;margin-bottom:8px;">
          <div class="text-block-title" style="font-size:12px;padding:6px 10px;">Текст обращения</div>
          <div class="text-block-content" style="font-size:12px;padding:10px;white-space:pre-wrap;">${escapeHtml(t.text)}</div>
        </div>
        ${t.clarification ? `<div style="font-size:11px;color:#1e40af;background:#eff6ff;padding:8px;border-radius:4px;"><b>Уточнение:</b> ${escapeHtml(t.clarification)}</div>` : ''}
      </div>`;
  } else if (level === 3) {
    const orgObj = getOrg(t.orgId);
    const contactObj = CONTACTS.find(c => c.id === t.contactId);
    return `
      <div style="font-size:12px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">${t.id} • ${t.title}</div>
        <div class="kv" style="gap:4px;margin-bottom:8px;">
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns:90px 1fr;gap:8px;font-size:12px;"><span class="kv-key">Продукт</span><span class="kv-val">${t.ver}</span></div>
        </div>
        <div class="text-block" style="margin-top:0;margin-bottom:8px;">
          <div class="text-block-title" style="font-size:12px;padding:6px 10px;">Текст обращения</div>
          <div class="text-block-content" style="font-size:12px;padding:10px;white-space:pre-wrap;">${escapeHtml(t.text)}</div>
        </div>
        ${t.clarifications && t.clarifications.length ? `<div style="font-size:11px;color:#1e40af;background:#eff6ff;padding:8px;border-radius:4px;"><b>Уточнение:</b> ${escapeHtml(t.clarifications[0].answer)}</div>` : ''}
      </div>`;
  } else {
    return `
      <div style="font-size:12px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-weight:600;margin-bottom:8px;font-size:14px;">${t.id} • ${t.title}</div>
        <div class="text-block" style="margin-top:0;margin-bottom:8px;">
          <div class="text-block-title" style="font-size:12px;padding:6px 10px;">Текст обращения</div>
          <div class="text-block-content" style="font-size:12px;padding:10px;white-space:pre-wrap;">${escapeHtml(t.text)}</div>
        </div>
      </div>`;
  }
}

function generateDetailsHtml(res) {
  let detailsHtml = `<div class="comparison-list">`;
  if (res && res.comparison && res.comparison.length > 0) {
    for (const c of res.comparison) {
      detailsHtml += `
        <div class="comp-item ${c.isError ? 'error' : 'success'}">
          <div class="comp-field">${c.field}</div>
          <div class="comp-values">
            <span class="comp-val ${c.isError ? 'bad' : 'good'}">${c.isError ? 'Тест: ' + escapeHtml(c.value) : '✓ ' + escapeHtml(c.value)}</span>
            ${c.isError ? `<span class="comp-val good">Нужно: ${escapeHtml(c.expected)}</span>` : ''}
          </div>
          ${c.isError ? `<div class="comp-explain">${escapeHtml(c.explain)}</div>` : ''}
        </div>
      `;
    }
  } else {
    detailsHtml += `Нет данных`;
  }
  detailsHtml += `</div>`;
  return detailsHtml;
}

// ===== L1 =====

function runAutotests() {
  const reportBody = document.getElementById("autotest-report-body");
  reportBody.innerHTML = "";

  const backupResults = JSON.parse(JSON.stringify(state.results));
  const backupId = state.currentId;
  const backupLevel = state.level;

  const backupLevelState = state.level;
  state.level = 1;

  let html = "";

  for (const t of TICKETS) {
    openWork(t.id);
    const et = t.etalon;

    // ТЕСТ 1: Правильно
    setField("org", et.org);          // триггерит орг-каскад + версии
    setField("cont", et.cont);
    setField("chan", et.chan);
    setField("type", et.type);
    setField("prod", et.prod);
    setField("cat", et.cat);
    setField("sub", et.sub);
    setField("imp", et.imp);
    setField("urg", et.urg);

    register();
    hideModal("modal-reg");

    const res1 = state.results[t.id];
    const pass1 = res1 && res1.ok;

    // ТЕСТ 2: Ломаем
    delete state.results[t.id];
    openWork(t.id);

    const wrongOrgObj = ORGS.find(o => o.id !== et.org);
    setField("org", wrongOrgObj.id);
    const wrongContacts = getContactsByOrg(wrongOrgObj.id);
    if (wrongContacts.length > 0) setField("cont", wrongContacts[0].id);
    setField("chan", et.chan === "Email" ? "Телефон" : "Email");
    setField("type", et.type === "Инцидент" ? "Консультация" : "Инцидент");
    setField("prod", et.prod === "Про.Документы" ? "Про.Продажи" : "Про.Документы");
    setField("cat", "");
    setField("sub", "");
    state.orgVersions = [];
    renderVerList();
    setField("imp", et.imp === "высокая" ? "низкая" : "высокая");
    setField("urg", et.urg === "высокая" ? "низкая" : "высокая");

    register();
    hideModal("modal-reg");

    const res2 = state.results[t.id];
    const pass2 = res2 && res2.errs.length > 0;

    html += `<tr>
      <td style="vertical-align:top;">${generateFormHtml(t, 1)}</td>
      <td style="vertical-align:top;">${pass1 ? '<span class="tag ok">Успех</span>' : '<span class="tag bad">Провал</span>'}</td>
      <td style="vertical-align:top;">${pass2 ? '<span class="tag ok">Поймано: ' + res2.errs.length + '</span>' : '<span class="tag bad">Пропустил</span>'}</td>
      <td style="vertical-align:top;">${generateDetailsHtml(res2)}</td>
    </tr>`;
  }

  reportBody.innerHTML = html;

  state.results = backupResults;
  state.currentId = backupId;
  state.level = backupLevelState;

  renderQueue();
  showScreen("screen-queue");
  showModal("modal-autotest");
}

// ===== L2 =====

function runAutotestsL2() {
  const reportBody = document.getElementById("autotest-report-body");
  reportBody.innerHTML = "";

  const backupResults = JSON.parse(JSON.stringify(state.resultsL2));
  const backupId = state.currentId;
  const backupLevel = state.level;
  const backupWorkloads = EMPLOYEES.map(e => ({ id: e.id, workload: e.workload }));

  const backupLevelState = state.level;
  state.level = 2;

  let html = "";

  for (const t of TICKETS_L2) {
    openWork(t.id);

    // ТЕСТ 1: Правильно
    setField("assignee", t.expectedAssignee);
    setField("comment", t.expectedComment);
    assignL2();
    hideModal("modal-assign");

    const res1 = state.resultsL2[t.id];
    const pass1 = res1 && res1.ok;

    // ТЕСТ 2: Ломаем
    delete state.resultsL2[t.id];
    openWork(t.id);

    const wrongAssignee = EMPLOYEES.find(e => e.id !== t.expectedAssignee && e.status === "В отпуске")
      || EMPLOYEES.find(e => e.id !== t.expectedAssignee);
    const wrongComment = COMMENTS_L2.find(c => c.id !== t.expectedComment);

    setField("imp", t.imp === "высокая" ? "низкая" : "высокая");
    setField("urg", t.urg === "высокая" ? "низкая" : "высокая");
    setField("assignee", wrongAssignee.id);
    setField("comment", wrongComment.id);

    assignL2();
    hideModal("modal-assign");

    const res2 = state.resultsL2[t.id];
    const pass2 = res2 && res2.errs.length > 0;

    html += `<tr>
      <td style="vertical-align:top;">${generateFormHtml(t, 2)}</td>
      <td style="vertical-align:top;">${pass1 ? '<span class="tag ok">Успех</span>' : '<span class="tag bad">Провал</span>'}</td>
      <td style="vertical-align:top;">${pass2 ? '<span class="tag ok">Поймано: ' + res2.errs.length + '</span>' : '<span class="tag bad">Пропустил</span>'}</td>
      <td style="vertical-align:top;">${generateDetailsHtml(res2)}</td>
    </tr>`;
  }

  reportBody.innerHTML = html;

  state.resultsL2 = backupResults;
  state.currentId = backupId;
  state.level = backupLevelState;

  for (const b of backupWorkloads) {
    const emp = EMPLOYEES.find(e => e.id === b.id);
    if (emp) emp.workload = b.workload;
  }

  renderQueue();
  showScreen("screen-queue");
  showModal("modal-autotest");
}

// ===== L3 =====

function runAutotestsEngineer() {
  const reportBody = document.getElementById("autotest-report-body");
  reportBody.innerHTML = "";

  const backupResults = JSON.parse(JSON.stringify(state.resultsEngineer));
  const backupId = state.currentId;
  const backupLevel = state.level;
  const backupEngineer = { ...state.engineer };
  const backupCreated = (state.createdProblems || []).slice();

  const backupLevelState = state.level;
  state.level = 3;

  let html = "";

  for (const t of TICKETS_L3) {
    openWork(t.id);
    requestEngineerClarify();

    // ТЕСТ 1: Правильно
    setField("root", "причина: " + t.rootKeywords.join(", "));
    setField("workaround", String(t.workaroundCorrect));
    setField("radical", String(t.radicalCorrect));
    setField("outcome", t.outcome.correct);

    if (t.outcome.correct === "new_problem") {
      setCheckboxGroup("incidents", true);
      setField("impact", t.problem.impact);
      setField("prob", t.problem.prob);
      setField("owner", t.problem.owner);
      setField("method", t.problem.method);
      const rfcText = (PROBLEMS.find(p => p.id === t.problem.record) || {}).rfc
        || ("исправить: " + t.rootKeywords.join(", "));
      setField("rfc", rfcText);
    } else if (t.linkedProblemId) {
      setField("linkedProb", t.linkedProblemId);
    }

    validateCurrentForm();
    submitEngineer();
    hideModal("modal-reg");

    const res1 = state.resultsEngineer[t.id];
    const pass1 = res1 && res1.ok;

    // ТЕСТ 2: Ломаем
    delete state.resultsEngineer[t.id];
    openWork(t.id);

    setField("root", "неизвестно");
    setField("workaround", String((t.workaroundCorrect + 1) % t.workarounds.length));
    setField("radical", String((t.radicalCorrect + 1) % t.radical.length));
    setField("outcome", t.outcome.correct === "known_error" ? "resolved" : "known_error");

    if (t.problem) {
      setCheckboxGroup("incidents", false);
      const impactAlt = t.problem.impact === "высокое" ? "низкое" : "высокое";
      const probAlt = t.problem.prob === "высокая" ? "низкая" : "высокая";
      const ownerAlt = (EMPLOYEES_L3.find(e => e.id !== t.problem.owner) || {}).id || t.problem.owner;
      const methodAlt = PROBLEM_METHODS.find(m => m !== t.problem.method) || t.problem.method;
      setField("impact", impactAlt);
      setField("prob", probAlt);
      setField("owner", ownerAlt);
      setField("method", methodAlt);
      setField("rfc", "неизвестно");
    }

    validateCurrentForm();
    submitEngineer();
    hideModal("modal-reg");

    const res2 = state.resultsEngineer[t.id];
    const pass2 = res2 && res2.errs.length > 0;

    html += `<tr>
      <td style="vertical-align:top;">${generateFormHtml(t, 3)}</td>
      <td style="vertical-align:top;">${pass1 ? '<span class="tag ok">Успех</span>' : '<span class="tag bad">Провал</span>'}</td>
      <td style="vertical-align:top;">${pass2 ? '<span class="tag ok">Поймано: ' + res2.errs.length + '</span>' : '<span class="tag bad">Пропустил</span>'}</td>
      <td style="vertical-align:top;">${generateDetailsHtml(res2)}</td>
    </tr>`;
  }

  reportBody.innerHTML = html;

  state.resultsEngineer = backupResults;
  state.currentId = backupId;
  state.level = backupLevelState;
  state.engineer = backupEngineer;
  state.createdProblems = backupCreated;

  renderQueue();
  showScreen("screen-queue");
  showModal("modal-autotest");
}
