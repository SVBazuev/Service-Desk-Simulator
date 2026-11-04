function fillSelect(sel, items) {
  if (!sel) return;
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "Выберите...";
  sel.appendChild(def);
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    sel.appendChild(opt);
  }
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}

// ИСПОЛЬЗУЕМ DataStore
function getOrg(id) { return DataStore.getOrg(id); }
function getContactsByOrg(id) { return DataStore.getContactsByOrg(id); }

function getCatList(group) {
  const tax = DataStore.getTax();
  if (!group || !tax[group]) return [];
  return tax[group];
}

function getSubList(group, catName) {
  const list = getCatList(group);
  const c = list.find(x => x.name === catName);
  if (!c) return [];
  return c.subs;
}

function calcPriority(imp, urg) {
  const matrix = DataStore.getMatrix();
  const key = imp + "|" + urg;
  return matrix[key] || null;
}

function getOrgVersions(org) {
  if (!org || !org.products) return [];
  return org.products.map(p => ({ name: p.name, ver: p.ver }));
}

// ИСПОЛЬЗУЕМ State и DataStore
function getTickets() { return DataStore.getTickets(State.level); }
function getResults() { return State.getResults(State.level); }
function getTicket(id) { return DataStore.getTicket(State.level, id); }
