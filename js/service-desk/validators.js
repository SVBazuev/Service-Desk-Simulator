/**
 * validators.js — Service Desk custom validation rules
 * registered via Extension API.
 */
import { Extension } from "../core/extensions.js";
import { DataStore } from "../core/dataStore.js";
import { getOrg } from "../utils.js";
import { PROBLEMS } from "../../dist/data.js";

Extension.registerFieldFormatter("org", function(value, ticket) {
  return {
    display: getOrg(value)?.name || value,
    explain: "Организация должна соответствовать обращению."
  };
});

Extension.registerFieldFormatter("cont", function(value, ticket) {
  return {
    display: DataStore.getContacts().find(c => c.id === value)?.name || value,
    explain: "Контактное лицо должно соответствовать обращению."
  };
});

Extension.registerFieldFormatter("assignee", function(value, ticket) {
  return {
    display: DataStore.getEmployees().find(e => e.id === value)?.name || value,
    explain: (ticket && ticket.explain) || ""
  };
});

Extension.registerFieldFormatter("comment", function(value, ticket) {
  return {
    display: DataStore.getCommentsL2().find(c => c.id === value)?.text || value,
    explain: "Комментарий должен соответствовать типу задачи."
  };
});

Extension.registerValidator("problem_logic", function(ticket, formData, comparison, errs) {
  const outCorrect = formData.outcome === ticket.outcome.correct;
  const outLabel = { resolved: "Решено", new_problem: "Новая проблема", known_error: "Известная ошибка", fixed_problem: "Исправленная проблема" };

  const isOutErr = !outCorrect;
  if (isOutErr) errs.push("Исход обращения");
  comparison.push({ field: "Исход обращения", value: outLabel[formData.outcome] || formData.outcome, expected: outLabel[ticket.outcome.correct], isError: isOutErr, explain: ticket.outcome.explain });

  if (formData.outcome === "new_problem") {
    const problemDef = PROBLEMS.find(p => p.id === ticket.problem?.record);
    const expectedIncidents = problemDef ? problemDef.incidentsLinked : [ticket.id];

    const rfcOk = _checkProblemKeywords(formData.rfc, ticket.rootKeywords).ok;
    const incErr = formData.incidents.length !== expectedIncidents.length || !expectedIncidents.every(id => formData.incidents.includes(id));
    if (incErr) errs.push("Связанные инциденты");
    comparison.push({ field: "Связанные инциденты", value: formData.incidents.join(", "), expected: expectedIncidents.join(", "), isError: incErr, explain: incErr ? "Отметьте все обращения." : "" });

    const addComp = (f, v, e, exp) => { if (v !== e) errs.push(f); comparison.push({ field: f, value: v, expected: e, isError: v !== e, explain: exp }); };
    addComp("Влияние", formData.impact, ticket.problem?.impact, "");
    addComp("Вероятность", formData.prob, ticket.problem?.prob, "");
    addComp("Владелец", DataStore.getEmployeesL3().find(e => e.id === formData.owner)?.name || formData.owner, DataStore.getEmployeesL3().find(e => e.id === ticket.problem?.owner)?.name, "");
    addComp("Метод", formData.method, ticket.problem?.method, "");

    if (!rfcOk) errs.push("RFC");
    comparison.push({ field: "RFC", value: formData.rfc, expected: "ключевые слова", isError: !rfcOk, explain: !rfcOk ? "Опишите изменение." : "" });

  } else if (formData.outcome === "known_error" || formData.outcome === "fixed_problem") {
    const isErr = formData.linkedProb !== ticket.linkedProblemId;
    if (isErr) errs.push("Связанная проблема");
    comparison.push({ field: "Связанная проблема", value: formData.linkedProb, expected: ticket.linkedProblemId, isError: isErr, explain: isErr ? "Выбрана неверная проблема." : "" });
  }

  if (ticket.duplicateOf) {
    const dupCorrect = formData.dupVal === ticket.duplicateOf;
    if (!dupCorrect) errs.push("Связь с дубликатом");
    comparison.push({ field: "Связь с повторным обращением", value: formData.dupVal, expected: ticket.duplicateOf, isError: !dupCorrect, explain: "" });
  }
});

function _checkProblemKeywords(root, keywords) {
  const n = (root || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
  const matched = keywords.filter(k => n.includes(k.toLowerCase()));
  return { ok: matched.length >= 2, matched };
}
