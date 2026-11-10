/**
 * validator.js — universal answer verification module.
 */
var Validator = {
  _rules: {},

  registerRule: function(name, fn) {
    this._rules[name] = fn;
  },

  // Safe value getter by path (e.g. "etalon.imp")
  getExpectedValue: function(ticket, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], ticket);
  },

  // Universal validation method
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

      // Custom rules registered via Extension.registerValidator.
      const customFn = this._rules[rule];
      if (customFn) {
        customFn.call(this, ticket, formData, comparison, errs);
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
  }
};
