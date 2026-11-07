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

  getTickets: (level) => {
    if (level === 1) return TICKETS;
    if (level === 2) return TICKETS_L2;
    return TICKETS_L3;
  },

  getTicket: (level, id) => {
    const tickets = DataStore.getTickets(level);
    return tickets.find(t => t.id === id);
  },

  getProblems: () => PROBLEMS,
  getKbL3: () => KB_L3,

  getSchemas: () => ({
    1: SCHEMA_L1,
    2: SCHEMA_L2,
    3: SCHEMA_L3
  }),
  getProblemMethods: () => PROBLEM_METHODS
};
