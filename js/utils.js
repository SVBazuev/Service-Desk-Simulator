import { DataStore } from "@ludus/core/js/dataStore.js";
import { State } from "@ludus/core/js/state.js";

export { fillSelect } from "@ludus/core/js/utils.js";

export function q(sel) { return document.querySelector(sel); }

export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g,
    ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

export function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

export function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}

export function getOrg(id) { return DataStore.getOrg(id); }
export function getContactsByOrg(id) { return DataStore.getContactsByOrg(id); }

export function getCatList(group) {
  const tax = DataStore.getTax();
  if (!group || !tax[group]) return [];
  return tax[group];
}

export function getSubList(group, catName) {
  const list = getCatList(group);
  const c = list.find(x => x.name === catName);
  if (!c) return [];
  return c.subs;
}

export function calcPriority(imp, urg) {
  const matrix = DataStore.getMatrix();
  const key = imp + "|" + urg;
  return matrix[key] || null;
}

export function getOrgVersions(org) {
  if (!org || !org.products) return [];
  return org.products.map(p => ({ name: p.name, ver: p.ver }));
}

export function getTickets() { return DataStore.getTickets(State.level); }
export function getResults() { return State.getResults(State.level); }
export function getTicket(id) { return DataStore.getTicket(State.level, id); }
