/**
 * submits.js — single submit pipeline for all workflows.
 */
import { State } from "@ludus/core/js/state.js";
import { DataStore } from "@ludus/core/js/dataStore.js";
import { FormRenderer } from "@ludus/core/js/formRenderer.js";
import { Validator } from "@ludus/core/js/validator.js";
import { Extension } from "@ludus/core/js/extensions.js";
import { q, showModal, getTicket } from "../../utils.js";
import { makeSnapshot } from "./levels.js";

export function submitLevel() {
  const t = getTicket(State.currentId);
  if (!t || !State.currentForm) return;

  const level = State.level;
  const workflow = DataStore.getLevelWorkflow(level);
  const schema = DataStore.getSchema(level);
  const formData = FormRenderer.getFormData(State.currentForm, schema);

  if (workflow === "engineer") {
    const dupSel = q('[data-slot="dup-select"]');
    formData.dupVal = dupSel ? dupSel.value : "";
  } else {
    formData.vers = (State.orgVersions || []).map(v => v.name + " " + v.ver);
  }

  const ctx = { level, workflow, ticket: t, schema, formData, state: State };
  const result = Extension.runMiddleware(ctx, (c) => {
    const r = Validator.validate(c.schema, c.ticket, c.formData);
    State.getResults(c.level)[c.ticket.id] = r;
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
      if (record && !State.createdProblems.includes(record)) {
        State.createdProblems.push(record);
      }
    }
    showSuccess(t.id, "modal-reg");
  }

  Extension.getProgressStore().save(level, makeSnapshot());
}

export function showSuccess(ticketId, modalId) {
  const idEl = document.getElementById(modalId === "modal-assign" ? "assign-ok-id" : "reg-ok-id");
  if (idEl) idEl.textContent = ticketId;
  showModal(modalId);
}
