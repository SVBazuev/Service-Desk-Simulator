/**
 * validator.js — универсальный модуль проверки ответов.
 */
var Validator = {
  // Безопасное получение значения по пути (например, "etalon.imp")
  getExpectedValue: function(ticket, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], ticket);
  },

  // Универсальный метод валидации
  validate: function(schema, ticket, formData) {
    const errs = [];
    const comparison = [];
    const addComp = (field, val, exp, explain) => {
      const isErr = val !== exp;
      if (isErr) errs.push(field);
      comparison.push({
        field, value: val || "Не выбрано", expected: exp || "-", isError: isErr, explain: explain || ""
      });
    };

    for (const field of schema.fields) {
      if (!field.validate) continue;

      const val = formData[field.id];
      const rule = field.validate.rule;

      // Специальное правило для L3: вся логика вынесена в отдельный метод
      if (rule === "l3_logic") {
        this._validateL3Logic(ticket, formData, comparison, errs);
        continue;
      }

      const expected = this.getExpectedValue(ticket, field.validate.path);

      if (rule === "eq") {
        if (field.id === "org") {
          addComp("Организация", getOrg(val)?.name, getOrg(expected)?.name, "Организация должна соответствовать обращению.");
        } else if (field.id === "cont") {
          addComp("Контактное лицо", CONTACTS.find(x => x.id === val)?.name, getContactsByOrg(ticket.orgId).find(x => x.id === expected)?.name, "Контактное лицо должно соответствовать обращению.");
        } else if (field.id === "assignee") {
          const empName = DataStore.getEmployees().find(e => e.id === val)?.name || val;
          const expName = DataStore.getEmployees().find(e => e.id === expected)?.name || expected;
          addComp("Ответственный", empName, expName, ticket.explain);
        } else if (field.id === "comment") {
          const comText = DataStore.getCommentsL2().find(c => c.id === val)?.text || val;
          const expComText = DataStore.getCommentsL2().find(c => c.id === expected)?.text || expected;
          addComp("Комментарий", comText, expComText, "Комментарий должен соответствовать типу задачи.");
        } else {
          addComp(field.label, val, expected, "");
        }
      }
      else if (rule === "includes") {
        const isErr = !formData[field.id].includes(expected);
        if (isErr) errs.push(field.label);
        comparison.push({ field: field.label, value: formData[field.id].join(", ") || "Нет продуктов", expected, isError: isErr, explain: "Версия продукта должна соответствовать." });
      }
      else if (rule === "eqIndex") {
        const isErr = parseInt(val, 10) !== expected;
        if (isErr) errs.push(field.label);
        comparison.push({
          field: field.label,
          value: "Выбран вариант №" + val,
          expected: "Вариант №" + expected,
          isError: isErr,
          explain: "Выберите решение, которое реально снимает боль или устраняет причину."
        });
      }
      else if (rule === "keywords") {
        const n = (val || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
        const matched = expected.filter(k => n.includes(k.toLowerCase()));
        const isErr = matched.length < 2;
        if (isErr) errs.push(field.label);
        comparison.push({
          field: field.label,
          value: val || "Не заполнено",
          expected: "ключевые: " + expected.join(", "),
          isError: isErr,
          explain: isErr ? "Укажите первопричину своими словами (минимум 2 ключевых слова)." : "Поймано по ключевым словам."
        });
      }
    }

    return { registered: true, errs, comparison, ok: errs.length === 0 };
  },

  // Вся сложная логика L3 (Problem Record, Known Error, дубликаты)
  _validateL3Logic: function(ticket, formData, comparison, errs) {
    const outCorrect = formData.outcome === ticket.outcome.correct;
    const outLabel = { resolved: "Решено", new_problem: "Новая проблема", known_error: "Известная ошибка", fixed_problem: "Исправленная проблема" };

    const isOutErr = !outCorrect;
    if (isOutErr) errs.push("Исход обращения");
    comparison.push({ field: "Исход обращения", value: outLabel[formData.outcome] || formData.outcome, expected: outLabel[ticket.outcome.correct], isError: isOutErr, explain: ticket.outcome.explain });

    if (formData.outcome === "new_problem") {
      const problemDef = PROBLEMS.find(p => p.id === ticket.problem?.record);
      const expectedIncidents = problemDef ? problemDef.incidentsLinked : [ticket.id];

      const rfcOk = this.l3CheckKeywords(formData.rfc, ticket.rootKeywords).ok;
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
  },

  // Вспомогательная функция для L3 (поиск ключевых слов)
  l3CheckKeywords: function(root, keywords) {
    const n = (root || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
    const matched = keywords.filter(k => n.includes(k.toLowerCase()));
    return { ok: matched.length >= 2, matched };
  }
};
