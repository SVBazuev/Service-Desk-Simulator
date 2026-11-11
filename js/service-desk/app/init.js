/**
 * init.js — application bootstrap, workload snapshots, reset, restart.
 * Imports side-effect modules (validators, middleware) so their
 * Extension registrations run at startup.
 */
import { templates } from "../../../dist/ludus-templates.js";
import { State } from "../../core/state.js";
import { DataStore } from "../../core/dataStore.js";
import { Extension } from "../../core/extensions.js";
import { showScreen, hideModal } from "../../utils.js";
import "../validators.js";
import "../middleware.js";
import { renderLevelCards } from "./levels.js";
import { onWorkClick, goBackFromWork, showResults } from "./router.js";
import { openOrgList, openEmpList, openProblems } from "./reference.js";
import { bootstrapKb, buildKb, openKb } from "./kb.js";

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
  State.reset();
  resetWorkloads();
}

function restart() {
  resetState();
  showScreen("screen-start");
}

export function init() {
  Extension.registerTemplates(templates);

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
    Extension.getProgressStore().reset();
    resetState();
    renderLevelCards();
  });

  document.querySelector("[data-intro-start]").addEventListener("click", () => {
    hideModal("modal-intro");
  });

  document.getElementById("screen-work").addEventListener("click", onWorkClick);

  document.querySelectorAll(".modal-close, [data-close]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-close");
      if (id) hideModal(id);
    });
  });

  document.querySelectorAll("[id^='btn-org-list']").forEach(b => b.addEventListener("click", openOrgList));
  document.querySelectorAll("[id^='btn-emp-list']").forEach(b => b.addEventListener("click", () =>
    openEmpList(DataStore.getLevelWorkflow(State.level) === "engineer" ? DataStore.getEmployeesL3() : DataStore.getEmployees())
  ));
  document.querySelectorAll("[id^='btn-kb']").forEach(b => b.addEventListener("click", openKb));
  document.querySelectorAll("[id^='btn-problems']").forEach(b => b.addEventListener("click", openProblems));
  const queueProbBtn = document.querySelector("[data-queue-problems]");
  if (queueProbBtn) queueProbBtn.addEventListener("click", openProblems);
  document.getElementById("btn-res-restart").addEventListener("click", restart);

  document.getElementById("btn-reg-ok").addEventListener("click", () => {
    hideModal("modal-reg");
    goBackFromWork();
  });
  document.getElementById("btn-assign-ok").addEventListener("click", () => {
    hideModal("modal-assign");
    goBackFromWork();
  });

  const queueFinishBtn = document.querySelector("[data-queue-finish]");
  if (queueFinishBtn) queueFinishBtn.addEventListener("click", () => showResults(State.level));

  buildKb();
}

export { resetState, restart };
