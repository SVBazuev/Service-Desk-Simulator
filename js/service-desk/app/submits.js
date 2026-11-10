/**
 * submits.js — single submit pipeline for all workflows.
 * Aliases register / assignL2 / submitEngineer are gone in G.1d;
 * autotests.js calls submitLevel() directly.
 */

function submitLevel() {
  const t = getTicket(state.currentId);
  if (!t || !state.currentForm) return;

  const level = state.level;
  const workflow = DataStore.getLevelWorkflow(level);
  const schema = DataStore.getSchema(level);
  const formData = FormRenderer.getFormData(state.currentForm, schema);

  if (workflow === "engineer") {
    const dupSel = q('[data-slot="dup-select"]');
    formData.dupVal = dupSel ? dupSel.value : "";
  } else {
    formData.vers = (state.orgVersions || []).map(v => v.name + " " + v.ver);
  }

  const ctx = { level, workflow, ticket: t, schema, formData, state: State };
  const result = Extension.runMiddleware(ctx, (c) => {
    const r = Validator.validate(c.schema, c.ticket, c.formData);
    state.getResults(c.level)[c.ticket.id] = r;
    return r;
  });

  if (!result) return;

  if (workflow === "registrar") {
    showSuccess(t.id, "modal-reg");
  } else if (workflow === "dispatcher") {
    showSuccess(t.id, "modal-assign");
    const emp = DataStore.getEmployees().find(e => e.id === formData.assignee);
    if (emp && emp.workload !== undefined) emp.workload += 1;
  } else if (workflow === "engineer") {
    if (formData.outcome === "new_problem" && result.ok && t.problem) {
      const record = t.problem.record;
      if (record && !state.createdProblems.includes(record)) {
        state.createdProblems.push(record);
      }
    }
    showSuccess(t.id, "modal-reg");
  }

  Extension.getProgressStore().save(level, makeSnapshot());
}

function showSuccess(ticketId, modalId) {
  const idEl = document.getElementById(modalId === "modal-assign" ? "assign-ok-id" : "reg-ok-id");
  if (idEl) idEl.textContent = ticketId;
  showModal(modalId);
}
