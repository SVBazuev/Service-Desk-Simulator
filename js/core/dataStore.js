/**
 * dataStore.js — centralized data store.
 * Encapsulates global variables created by the bundler (data-bundle.js).
 */

var DataStore = {
  getOrgs: () => ORGS,
  getOrg: (id) => ORGS.find(o => o.id === id),

  getContacts: () => CONTACTS,
  getContactsByOrg: (orgId) => CONTACTS.filter(c => c.orgId === orgId),

  getEmployees: () => EMPLOYEES,
  getEmployeesL3: () => EMPLOYEES_L3,
  getCommentsL2: () => COMMENTS_L2,
  // Intro dictionary: lookup by name or by { template, title?, body? }
  // object. String → base entry; object → base entry with overrides.
  getIntro: (def) => {
    if (!def) return null;
    const key = typeof def === "string" ? def : def.template;
    const base = INTROS[key];
    if (!base) return null;
    if (typeof def === "string") return base;
    return {
      title: (def.title !== undefined) ? def.title : base.title,
      body:  (def.body  !== undefined) ? def.body  : base.body
    };
  },

  getTax: () => TAX,
  getMatrix: () => MATRIX,

  // Levels (metadata from manifests)
  getLevels: () => LEVELS,
  getLevel: (id) => LEVELS.find(l => l.id === id) || null,
  getLevelWorkflow: (id) => {
    const lvl = LEVELS.find(l => l.id === id);
    return lvl ? lvl.workflow : null;
  },

  // Tickets by level (from LEVEL_DATA)
  getTickets: (level) => {
    const data = LEVEL_DATA[level];
    return data ? data.tickets : [];
  },
  getTicket: (level, id) => {
    const tickets = DataStore.getTickets(level);
    return tickets.find(t => t.id === id);
  },

  // Schemas by level
  getSchema: (level) => {
    const data = LEVEL_DATA[level];
    return data ? data.schema : null;
  },
  getSchemas: () => {
    const map = {};
    for (const lvl of LEVELS) map[lvl.id] = LEVEL_DATA[lvl.id].schema;
    return map;
  },

  getProblems: () => PROBLEMS,
  getKbL3: () => KB_L3,
  getProblemMethods: () => PROBLEM_METHODS
};
