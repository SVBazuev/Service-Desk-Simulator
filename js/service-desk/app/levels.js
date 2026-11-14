/**
 * levels.js — level selection screen, snapshots, and level startup.
 */
import { State } from "@ludus/core/js/state.js";
import { DataStore } from "@ludus/core/js/dataStore.js";
import { Extension } from "@ludus/core/js/extensions.js";
import { showScreen, showModal } from "../../utils.js";
import { renderQueue } from "./router.js";
import { resetState } from "./init.js";

export function makeSnapshot() {
  const level = State.level;
  const snap = {
    level: level,
    results: State.getResults(level),
    total: DataStore.getTickets(level).length
  };
  if (DataStore.getLevelWorkflow(level) === "engineer") {
    snap.createdProblems = State.createdProblems;
  }
  return snap;
}

export function applySnapshot(snap) {
  if (!snap || !snap.level) return false;
  State.resultsByLevel[snap.level] = snap.results || {};
  if (snap.createdProblems) State.createdProblems = snap.createdProblems;
  return true;
}

export function renderLevelCards() {
  const summary = Extension.getProgressStore().getSummary();
  const wrap = document.getElementById("level-cards");
  wrap.innerHTML = "";
  for (const lvl of DataStore.getLevels()) {
    if (!lvl.queue) continue;
    const total = DataStore.getTickets(lvl.id).length;
    const s = summary["level" + lvl.id];
    const done = s ? s.done : 0;
    const badge = s && s.finishedAt ? " · завершён" : "";

    const card = document.createElement("div");
    card.className = "level-card";
    card.innerHTML = `
      <div class="level-title">${lvl.title}</div>
      <div class="level-desc">${lvl.desc}</div>
      <div class="level-meta">${done} / ${total} обработано${badge}</div>
      <button class="btn primary" data-level="${lvl.id}">Начать</button>
    `;
    card.querySelector("button").addEventListener("click", () => startLevel(lvl.id));
    wrap.appendChild(card);
  }
}

export function startLevel(n) {
  resetState();
  State.level = n;
  const saved = Extension.getProgressStore().load(n);
  if (saved) applySnapshot(saved);

  const lvl = DataStore.getLevel(n);
  if (!lvl || !lvl.queue) return;
  renderQueue();
  showScreen("screen-queue");
  if (lvl.intro) {
    const intro = DataStore.getIntro(lvl.intro);
    if (!intro) {
      console.warn("[service-desk] Unknown intro:", lvl.intro);
    } else {
      const modal = document.getElementById("modal-intro");
      modal.querySelector("[data-intro-title]").textContent = intro.title;
      modal.querySelector("[data-intro-body]").innerHTML = intro.body;
      showModal("modal-intro");
    }
  }
}
