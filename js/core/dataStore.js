/**
 * dataStore.js — централизованное хранилище данных.
 * Инкапсулирует глобальные переменные, созданные сборщиком (data-bundle.js).
 */
var DataStore = {
  getOrgs: () => ORGS,
  getOrg: (id) => ORGS.find(o => o.id === id),

  getContacts: () => CONTACTS,
  getContactsByOrg: (orgId) => CONTACTS.filter(c => c.orgId === orgId),

  getEmployees: () => EMPLOYEES,
  getEmployeesL3: () => EMPLOYEES_L3,
  getCommentsL2: () => COMMENTS_L2,

  getTax: () => TAX,
  getMatrix: () => MATRIX,

  // Уровни (метаданные из манифестов)
  getLevels: () => LEVELS,
  getLevel: (id) => LEVELS.find(l => l.id === id) || null,
  getLevelWorkflow: (id) => {
    const lvl = LEVELS.find(l => l.id === id);
    return lvl ? lvl.workflow : null;
  },

  // Тикеты по уровню (из LEVEL_DATA)
  getTickets: (level) => {
    const data = LEVEL_DATA[level];
    return data ? data.tickets : [];
  },
  getTicket: (level, id) => {
    const tickets = DataStore.getTickets(level);
    return tickets.find(t => t.id === id);
  },

  // Схемы по уровню
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
