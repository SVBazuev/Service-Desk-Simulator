function generateFormHtml(t, level) {
  if (level === 1) {
    const orgObj = getOrg(t.orgId); const contactObj = CONTACTS.find(c => c.id === t.contactId);
    return `
      <div style="font-size: 12px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 10px;">
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${t.id} • ${t.title}</div>
        <div class="kv" style="gap: 4px; margin-bottom: 8px;">
          <div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Канал</span><span class="kv-val">${t.channel}</span></div>
        </div>
        <div class="text-block" style="margin-top: 0; margin-bottom: 8px;">
          <div class="text-block-title" style="font-size: 12px; padding: 6px 10px;">Текст обращения</div>
          <div class="text-block-content" style="font-size: 12px; padding: 10px; white-space: pre-wrap;">${t.text}</div>
        </div>
        ${t.clarification ? `<div style="font-size: 11px; color: #1e40af; background: #eff6ff; padding: 8px; border-radius: 4px;"><b>Уточнение:</b> ${t.clarification}</div>` : ''}
      </div>
    `;
  } else if (level === 3) {
    const orgObj = getOrg(t.orgId); const contactObj = CONTACTS.find(c => c.id === t.contactId);
    return `
      <div style="font-size: 12px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 10px;">
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${t.id} • ${t.title}</div>
        <div class="kv" style="gap: 4px; margin-bottom: 8px;">
          <div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Орг.</span><span class="kv-val">${orgObj ? orgObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Контакт</span><span class="kv-val">${contactObj ? contactObj.name : ""}</span></div>
          <div class="kv-row" style="grid-template-columns: 90px 1fr; gap: 8px; font-size: 12px;"><span class="kv-key">Продукт</span><span class="kv-val">${t.ver}</span></div>
        </div>
        <div class="text-block" style="margin-top: 0; margin-bottom: 8px;">
          <div class="text-block-title" style="font-size: 12px; padding: 6px 10px;">Текст обращения</div>
          <div class="text-block-content" style="font-size: 12px; padding: 10px; white-space: pre-wrap;">${t.text}</div>
        </div>
        ${t.clarifications && t.clarifications.length ? `<div style="font-size: 11px; color: #1e40af; background: #eff6ff; padding: 8px; border-radius: 4px;"><b>Уточнение:</b> ${t.clarifications[0].answer}</div>` : ''}
      </div>
    `;
  } else {
    return `
      <div style="font-size: 12px; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 10px;">
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${t.id} • ${t.title}</div>
        <div class="text-block" style="margin-top: 0; margin-bottom: 8px;">
          <div class="text-block-title" style="font-size: 12px; padding: 6px 10px;">Текст обращения</div>
          <div class="text-block-content" style="font-size: 12px; padding: 10px; white-space: pre-wrap;">${t.text}</div>
        </div>
      </div>
    `;
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
            <span class="comp-val ${c.isError ? 'bad' : 'good'}">${c.isError ? 'Тест: ' + c.value : '✓ ' + c.value}</span>
            ${c.isError ? `<span class="comp-val good">Нужно: ${c.expected}</span>` : ''}
          </div>
          ${c.isError ? `<div class="comp-explain">${c.explain}</div>` : ''}
        </div>
      `;
    }
  } else {
    detailsHtml += `Нет данных`;
  }
  detailsHtml += `</div>`;
  return detailsHtml;
}

function runAutotests() {
  const reportBody = document.getElementById("autotest-report-body");
  reportBody.innerHTML = "";

  // Сохраняем состояние
  const backupResults = JSON.parse(JSON.stringify(state.results));
  const backupId = state.currentId;
  const backupLevel = state.level;
  state.level = 1;

  let html = "";
  let testsPassed = 0;
  let testsFailed = 0;

  for (const t of TICKETS) {
    openWork(t.id);
    const et = t.etalon;

    // ТЕСТ 1: Правильно
    document.getElementById("card-org").value = et.org; onCardOrg();
    document.getElementById("card-cont").value = et.cont;
    document.getElementById("card-chan").value = et.chan;
    document.getElementById("card-type").value = et.type; onCardType();
    document.getElementById("card-prod").value = et.prod; onCardProd();
    document.getElementById("card-cat").value = et.cat; onCardCat();
    document.getElementById("card-sub").value = et.sub;
    document.getElementById("card-imp").value = et.imp;
    document.getElementById("card-urg").value = et.urg; onCardPri();

    register(); hideModal("modal-reg");

    const res1 = state.results[t.id];
    const pass1 = res1 && res1.ok;
    if (pass1) testsPassed++; else testsFailed++;

    // ТЕСТ 2: Ломаем
    delete state.results[t.id];
    openWork(t.id);
    const wrongOrgObj = ORGS.find(o => o.id !== et.org);
    document.getElementById("card-org").value = wrongOrgObj.id; onCardOrg();
    const wrongContacts = getContactsByOrg(wrongOrgObj.id);
    if(wrongContacts.length > 0) document.getElementById("card-cont").value = wrongContacts[0].id;
    document.getElementById("card-chan").value = et.chan === "Email" ? "Телефон" : "Email";
    document.getElementById("card-type").value = et.type === "Инцидент" ? "Консультация" : "Инцидент"; onCardType();
    document.getElementById("card-prod").value = et.prod === "Про.Документы" ? "Про.Продажи" : "Про.Документы"; onCardProd();
    document.getElementById("card-cat").value = ""; document.getElementById("card-sub").value = "";
    state.orgVersions = []; renderVerList();
    document.getElementById("card-imp").value = et.imp === "высокая" ? "низкая" : "высокая";
    document.getElementById("card-urg").value = et.urg === "высокая" ? "низкая" : "высокая"; onCardPri();

    register(); hideModal("modal-reg");
    const res2 = state.results[t.id];
    const pass2 = res2 && res2.errs.length > 0;
    if (pass2) testsPassed++; else testsFailed++;

    html += `<tr>
      <td style="vertical-align: top;">${generateFormHtml(t, 1)}</td>
      <td style="vertical-align: top;">${pass1 ? '<span class="tag ok">Успех</span>' : '<span class="tag bad">Провал</span>'}</td>
      <td style="vertical-align: top;">${pass2 ? '<span class="tag ok">Поймано: ' + res2.errs.length + '</span>' : '<span class="tag bad">Пропустил</span>'}</td>
      <td style="vertical-align: top;">${generateDetailsHtml(res2)}</td>
    </tr>`;
  }

  reportBody.innerHTML = html;

  // Восстанавливаем состояние
  state.results = backupResults;
  state.currentId = backupId;
  state.level = backupLevel;

  renderQueue(); showScreen("screen-queue"); showModal("modal-autotest");
}

function runAutotestsL2() {
  const reportBody = document.getElementById("autotest-report-body");
  reportBody.innerHTML = "";

  // Сохраняем состояние и загруженность
  const backupResults = JSON.parse(JSON.stringify(state.resultsL2));
  const backupId = state.currentId;
  const backupLevel = state.level;
  const backupWorkloads = EMPLOYEES.map(e => ({ id: e.id, workload: e.workload }));

  state.level = 2;

  let html = "";
  let testsPassed = 0;
  let testsFailed = 0;

  for (const t of TICKETS_L2) {
    openWork(t.id);

    // ТЕСТ 1: Правильно
    document.getElementById("card-assignee-l2").value = t.expectedAssignee;
    document.getElementById("card-comment-l2").value = t.expectedComment;
    validate();
    assignL2(); hideModal("modal-assign");

    const res1 = state.resultsL2[t.id];
    const pass1 = res1 && res1.ok;
    if (pass1) testsPassed++; else testsFailed++;

    // ТЕСТ 2: Ломаем
    delete state.resultsL2[t.id];
    openWork(t.id);

    const wrongAssignee = EMPLOYEES.find(e => e.id !== t.expectedAssignee && e.status === "В отпуске") || EMPLOYEES.find(e => e.id !== t.expectedAssignee);
    const wrongComment = COMMENTS_L2.find(c => c.id !== t.expectedComment);

    // Ломаем поля карточки
    document.getElementById("card-imp").value = t.imp === "высокая" ? "низкая" : "высокая";
    document.getElementById("card-urg").value = t.urg === "высокая" ? "низкая" : "высокая";
    onCardPri();

    // Ломаем назначение
    document.getElementById("card-assignee-l2").value = wrongAssignee.id;
    document.getElementById("card-comment-l2").value = wrongComment.id;
    validate();
    assignL2(); hideModal("modal-assign");

    const res2 = state.resultsL2[t.id];
    const pass2 = res2 && res2.errs.length > 0;
    if (pass2) testsPassed++; else testsFailed++;

    html += `<tr>
      <td style="vertical-align: top;">${generateFormHtml(t, 2)}</td>
      <td style="vertical-align: top;">${pass1 ? '<span class="tag ok">Успех</span>' : '<span class="tag bad">Провал</span>'}</td>
      <td style="vertical-align: top;">${pass2 ? '<span class="tag ok">Поймано: ' + res2.errs.length + '</span>' : '<span class="tag bad">Пропустил</span>'}</td>
      <td style="vertical-align: top;">${generateDetailsHtml(res2)}</td>
    </tr>`;
  }

  reportBody.innerHTML = html;

  // Восстанавливаем состояние и загруженность
  state.resultsL2 = backupResults;
  state.currentId = backupId;
  state.level = backupLevel;

  for (const b of backupWorkloads) {
    const emp = EMPLOYEES.find(e => e.id === b.id);
    if (emp) emp.workload = b.workload;
  }
  fillAssigneeSelect();

  renderQueue(); showScreen("screen-queue-l2"); showModal("modal-autotest");
}

function runAutotestsL3() {
  const reportBody = document.getElementById("autotest-report-body");
  reportBody.innerHTML = "";
  const backupResults = JSON.parse(JSON.stringify(state.resultsL3));
  const backupId = state.currentId;
  const backupLevel = state.level;
  const backupL3 = JSON.parse(JSON.stringify(state.l3));

  state.level = 3;

  let html = "";
  let testsPassed = 0;
  let testsFailed = 0;

  for (const t of TICKETS_L3) {
    openL3Work(t.id);
    l3RequestClarify();

    // ТЕСТ 1: Правильно
    document.getElementById("card-root").value = ("причина: " + t.rootKeywords.join(", "));
    document.getElementById("card-workaround").value = String(t.workaroundCorrect);
    document.getElementById("card-radical").value = String(t.radicalCorrect);
    document.getElementById("card-outcome").value = t.outcome.correct;

    // Вызываем change, чтобы сработали showIf
    document.getElementById("card-outcome").dispatchEvent(new Event('change', { bubbles: true }));

    if (t.outcome.correct === "new_problem") {
      document.querySelectorAll(".l3-prob-inc-check").forEach(c => c.checked = true);
      document.getElementById("card-impact").value = t.problem.impact;
      document.getElementById("card-prob").value = t.problem.prob;
      document.getElementById("card-owner").value = t.problem.owner;
      document.getElementById("card-method").value = t.problem.method;
      document.getElementById("card-rfc").value = (PROBLEMS.find(p => p.id === t.problem.record)?.rfc) || ("исправить: " + t.rootKeywords.join(", "));
    } else if (t.linkedProblemId) {
      document.getElementById("card-linkedProb").value = t.linkedProblemId;
    }

    if (t.duplicateOf) document.getElementById("l3-dup-of").value = t.duplicateOf;

    l3Validate();
    l3Submit(); hideModal("modal-reg");

    const res1 = state.resultsL3[t.id];
    const pass1 = res1 && res1.ok;
    if (pass1) testsPassed++; else testsFailed++;

    // ТЕСТ 2: Ломаем
    delete state.resultsL3[t.id];
    openL3Work(t.id);

    document.getElementById("card-root").value = "неизвестно";
    document.getElementById("card-workaround").value = String((t.workaroundCorrect + 1) % t.workarounds.length);
    document.getElementById("card-radical").value = String((t.radicalCorrect + 1) % t.radical.length);
    document.getElementById("card-outcome").value = t.outcome.correct === "known_error" ? "resolved" : "known_error";

    document.getElementById("card-outcome").dispatchEvent(new Event('change', { bubbles: true }));

    if (t.problem) {
      document.querySelectorAll(".l3-prob-inc-check").forEach(c => c.checked = false);
      document.getElementById("card-impact").value = t.problem.impact === "высокое" ? "низкое" : "высокое";
      document.getElementById("card-prob").value = t.problem.prob === "высокая" ? "низкая" : "высокая";
      document.getElementById("card-owner").value = EMPLOYEES_L3.find(e => e.id !== t.problem.owner)?.id || t.problem.owner;
      document.getElementById("card-method").value = PROBLEM_METHODS.find(m => m !== t.problem.method) || t.problem.method;
      document.getElementById("card-rfc").value = "неизвестно";
    }

    if (t.duplicateOf) {
      document.getElementById("l3-dup-of").value = "";
      const other = TICKETS_L3.find(x => x.id !== t.id && !x.duplicateOf);
      const sel = document.getElementById("l3-dup-of");
      const opt = document.createElement("option");
      opt.value = other.id; opt.textContent = other.id;
      sel.appendChild(opt);
      sel.value = other.id;
    }

    l3Validate();
    l3Submit(); hideModal("modal-reg");

    const res2 = state.resultsL3[t.id];
    const pass2 = res2 && res2.errs.length > 0;
    if (pass2) testsPassed++; else testsFailed++;

    html += `<tr>
      <td style="vertical-align: top;">${generateFormHtml(t, 3)}</td>
      <td style="vertical-align: top;">${pass1 ? '<span class="tag ok">Успех</span>' : '<span class="tag bad">Провал</span>'}</td>
      <td style="vertical-align: top;">${pass2 ? '<span class="tag ok">Поймано: ' + res2.errs.length + '</span>' : '<span class="tag bad">Пропустил</span>'}</td>
      <td style="vertical-align: top;">${generateDetailsHtml(res2)}</td>
    </tr>`;
  }

  reportBody.innerHTML = html;

  state.resultsL3 = backupResults;
  state.currentId = backupId;
  state.level = backupLevel;
  state.l3 = backupL3;

  renderQueue(); showScreen("screen-queue-l3"); showModal("modal-autotest");
}
