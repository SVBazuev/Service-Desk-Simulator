/**
 * validator.js — универсальный модуль проверки ответов.
 */
var Validator = {
  // Хелпер для добавления результата сравнения
  addComp: function(comparison, errs, field, val, exp, explain) {
    const isErr = val !== exp;
    if (isErr) errs.push(field);
    comparison.push({
      field,
      value: val || "Не выбрано",
      expected: exp || "-",
      isError: isErr,
      explain: explain || ""
    });
  },

  // Вспомогательные функции для L3 (поиск ключевых слов)
  l3Normalize: function(s) {
    return (s || "").toString().toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  l3CheckKeywords: function(root, keywords) {
    const n = this.l3Normalize(root);
    const matched = keywords.filter(k => n.includes(this.l3Normalize(k)));
    return { ok: matched.length >= 2, matched };
  },

  // Валидация для Уровня 1
  validateL1: function(t, formData) {
    const errs = [];
    const comparison = [];
    const et = t.etalon;

    this.addComp(comparison, errs, "Организация", getOrg(formData.org)?.name, getOrg(et.org)?.name, "Нужно выбрать организацию из формы.");
    this.addComp(comparison, errs, "Контактное лицо", CONTACTS.find(x=>x.id===formData.cont)?.name, getContactsByOrg(et.org).find(x=>x.id===et.cont)?.name, "Контактное лицо указано в форме.");
    this.addComp(comparison, errs, "Канал связи", formData.chan, et.chan, "Канал связи должен совпадать с формой.");
    this.addComp(comparison, errs, "Тип обращения", formData.type, et.type, t.etalon.fieldExplains.type);
    this.addComp(comparison, errs, "Продукт", formData.prod, et.prod, t.etalon.fieldExplains.prod);
    this.addComp(comparison, errs, "Категория", formData.cat, et.cat, t.etalon.fieldExplains.cat);
    this.addComp(comparison, errs, "Подкатегория", formData.sub, et.sub, t.etalon.fieldExplains.sub);

    const verErr = !formData.vers.includes(et.ver);
    if (verErr) errs.push("Версия продукта");
    comparison.push({ field: "Версия продукта", value: formData.vers.join(", ") || "Нет продуктов", expected: et.ver, isError: verErr, explain: t.etalon.fieldExplains.ver });

    this.addComp(comparison, errs, "Важность", formData.imp, et.imp, t.etalon.fieldExplains.imp);
    this.addComp(comparison, errs, "Срочность", formData.urg, et.urg, t.etalon.fieldExplains.urg);
    this.addComp(comparison, errs, "Приоритет", formData.prio, et.prio, "Рассчитывается автоматически на основе важности и срочности.");

    return { registered: true, errs, comparison, ok: errs.length === 0, explain: et.explain };
  },

  // Валидация для Уровня 2
  validateL2: function(t, formData) {
    const errs = [];
    const comparison = [];

    this.addComp(comparison, errs, "Организация", getOrg(formData.org)?.name, getOrg(t.orgId)?.name, "Организация должна соответствовать обращению.");
    this.addComp(comparison, errs, "Контактное лицо", CONTACTS.find(x=>x.id===formData.cont)?.name, getContactsByOrg(t.orgId).find(x=>x.id===t.contactId)?.name, "Контактное лицо должно соответствовать обращению.");
    this.addComp(comparison, errs, "Канал связи", formData.chan, t.channel, "Канал связи должен совпадать с формой.");
    this.addComp(comparison, errs, "Тип обращения", formData.type, t.type, "Тип обращения должен соответствовать описанию.");
    this.addComp(comparison, errs, "Продукт", formData.prod, t.prod, "Продукт должен соответствовать описанию.");
    this.addComp(comparison, errs, "Категория", formData.cat, t.cat, "Категория должна соответствовать описанию.");
    this.addComp(comparison, errs, "Подкатегория", formData.sub, t.sub, "Подкатегория должна соответствовать описанию.");

    const verErr = !formData.vers.includes(t.ver);
    if (verErr) errs.push("Версия продукта");
    comparison.push({ field: "Версия продукта", value: formData.vers.join(", ") || "Нет продуктов", expected: t.ver, isError: verErr, explain: "Версия продукта должна соответствовать карточке." });

    this.addComp(comparison, errs, "Важность", formData.imp, t.imp, "Важность должна соответствовать описанию.");
    this.addComp(comparison, errs, "Срочность", formData.urg, t.urg, "Срочность должна соответствовать описанию.");

    const empName = DataStore.getEmployees().find(e => e.id === formData.assignee)?.name || formData.assignee;
    const expName = DataStore.getEmployees().find(e => e.id === t.expectedAssignee)?.name || t.expectedAssignee;
    this.addComp(comparison, errs, "Ответственный", empName, expName, t.explain);

    const comText = DataStore.getCommentsL2().find(c => c.id === formData.comment)?.text || formData.comment;
    const expComText = DataStore.getCommentsL2().find(c => c.id === t.expectedComment)?.text || t.expectedComment;
    this.addComp(comparison, errs, "Комментарий", comText, expComText, "Комментарий должен соответствовать типу задачи (эскалация, анализ или стандартная работа).");

    return { registered: true, errs, comparison, ok: errs.length === 0 };
  },

  // Валидация для Уровня 3
  validateL3: function(t, formData) {
    const rootRes = this.l3CheckKeywords(formData.root, t.rootKeywords);
    const errs = [];
    const comparison = [];

    comparison.push({
      field: "Корневая причина",
      value: formData.root || "Не заполнено",
      expected: "ключевые: " + t.rootKeywords.join(", "),
      isError: !rootRes.ok,
      explain: rootRes.ok
        ? "Поймано по ключевым словам: " + rootRes.matched.join(", ") + "."
        : "Укажите первопричину своими словами. Подсказка: " + t.rootHint + ". (найдено слов: " + rootRes.matched.join(", ") + ")"
    });
    if (!rootRes.ok) errs.push("Корневая причина");

    const waCorrect = parseInt(formData.waIdx, 10) === t.workaroundCorrect;
    comparison.push({
      field: "Обходное решение",
      value: t.workarounds[parseInt(formData.waIdx, 10)] || "Не выбрано",
      expected: t.workarounds[t.workaroundCorrect],
      isError: !waCorrect,
      explain: waCorrect ? "" : "Выберите решение, которое реально снимает боль заказчика прямо сейчас."
    });
    if (!waCorrect) errs.push("Обходное решение");

    const radCorrect = parseInt(formData.radIdx, 10) === t.radicalCorrect;
    comparison.push({
      field: "Радикальное решение",
      value: t.radical[parseInt(formData.radIdx, 10)] || "Не выбрано",
      expected: t.radical[t.radicalCorrect],
      isError: !radCorrect,
      explain: radCorrect ? "" : "Радикальное решение устраняет первопричину. Сравните с тем, что вы нашли в диагностике."
    });
    if (!radCorrect) errs.push("Радикальное решение");

    const outCorrect = formData.out === t.outcome.correct;
    const outLabel = { resolved: "Решено", new_problem: "Новая проблема", known_error: "Известная ошибка", fixed_problem: "Исправленная проблема" };
    this.addComp(comparison, errs, "Исход обращения", outLabel[formData.out] || formData.out, outLabel[t.outcome.correct], t.outcome.explain);

    if (formData.out === "new_problem") {
      // Если у тикета нет шаблона проблемы, мы не должны сюда попасть через UI.
      // Но если попали (например, через тест), валидатор должен отработать корректно.
      const rfcOk = this.l3CheckKeywords(formData.rfc, t.rootKeywords).ok;
      const problemDef = PROBLEMS.find(p => p.id === t.problem?.record);
      const expectedIncidents = problemDef ? problemDef.incidentsLinked : [t.id];
      const incErr = formData.checked.length !== expectedIncidents.length || !expectedIncidents.every(id => formData.checked.includes(id));

      if (incErr) errs.push("Связанные инциденты");
      comparison.push({
        field: "Связанные инциденты",
        value: formData.checked.length ? formData.checked.join(", ") : "Не указаны",
        expected: expectedIncidents.join(", "),
        isError: incErr,
        explain: incErr ? "Отметьте все обращения, которые объясняются этой первопричиной." : ""
      });

      this.addComp(comparison, errs, "Проблема", problemDef ? problemDef.title : "Новая проблема (черновик)", problemDef ? problemDef.title : "Новая проблема (черновик)", "Инцидент относится к известной проблеме. Проблема объединяет повторяющиеся инциденты с одной первопричиной.");
      this.addComp(comparison, errs, "Влияние", formData.impact, t.problem?.impact, "Оцените масштаб: несколько организаций/отделов - высокое, одна организация - среднее, точечно - низкое.");
      this.addComp(comparison, errs, "Вероятность повторения", formData.prob, t.problem?.prob, "Пока фикс не внедрён, проблема будет повторяться.");
      this.addComp(comparison, errs, "Владелец", DataStore.getEmployeesL3().find(e => e.id === formData.owner)?.name || formData.owner, DataStore.getEmployeesL3().find(e => e.id === t.problem?.owner)?.name, "Владелец - тот, кто ведёт расследование: L3 или разработчик (Справочник сотрудников).");
      this.addComp(comparison, errs, "Метод расследования", formData.method, t.problem?.method, "Выберите метод под тип задачи: цепочка причин - «5 почему», много факторов - «Исикава», технический сбой - «анализ логов».");

      const rfcErr = !rfcOk;
      if (rfcErr) errs.push("RFC");
      comparison.push({
        field: "RFC",
        value: formData.rfc || "Не заполнено",
        expected: "ключевые: " + t.rootKeywords.join(", "),
        isError: rfcErr,
        explain: rfcErr ? "RFC должен конкретизировать изменение в продукте (что чиним) и обходное решение до фикса." : ""
      });
    } else if (formData.out === "known_error" || formData.out === "fixed_problem") {
      const isErr = formData.linkedProb !== t.linkedProblemId;
      if (isErr) errs.push("Связанная проблема");
      comparison.push({
        field: "Связанная проблема",
        value: formData.linkedProb || "Не выбрана",
        expected: t.linkedProblemId || "Не требуется",
        isError: isErr,
        explain: isErr ? "Выбрана неверная проблема. Обратите внимание на корневую причину и статус проблемы." : "Проблема привязана верно."
      });
    } else {
      comparison.push({ field: "Problem Record", value: "Не требуется", expected: "Не требуется", isError: false, explain: "Это отдельный инцидент (или не инцидент), повторяющегося паттерна нет." });
    }

    if (t.duplicateOf) {
      const dupCorrect = formData.dupVal === t.duplicateOf;
      if (!dupCorrect) errs.push("Связь с дубликатом");
      comparison.push({
        field: "Связь с повторным обращением",
        value: formData.dupVal || "Не указана",
        expected: t.duplicateOf,
        isError: !dupCorrect,
        explain: "Обратите внимание на текст: это повтор ранее разобранных симптомов. Свяжите с первичным обращением."
      });
    }

    return { registered: true, errs, comparison, ok: errs.length === 0 };
  }
};
