/**
 * reference.js — directories (organizations, employees, contacts)
 * and the Problem Records registry modal.
 */
import { State } from "../../core/state.js";
import { DataStore } from "../../core/dataStore.js";
import { showModal, getContactsByOrg } from "../../utils.js";
import { PROBLEMS, ARCHIVE_INCIDENTS } from "../../data-bundle.js";

export function openOrgList() {
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

export function openEmpList(list) {
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

export function openContacts(orgId, orgName) {
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

export function openProblems() {
  const body = document.getElementById("problems-body");
  body.innerHTML = "";
  const resolvedIds = Object.keys(State.getResults(3)).filter(id => State.getResults(3)[id].registered);

  if (resolvedIds.length === 0) {
    body.innerHTML = "<div style='color:var(--sub);font-size:14px;'>Пока нет зарегистрированных Problem Records. Они появляются, когда вы закрываете обращение с исходом «Known Error».</div>";
  }

  let displayProblems = [...PROBLEMS];

  if (State.createdProblems && State.createdProblems.includes("PRB-3")) {
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
