/**
 * state.js — централизованное состояние приложения.
 */
var State = {
  level: 1,
  currentId: null,
  results: {},
  resultsL2: {},
  resultsL3: {},
  orgVersions: [],
  createdProblems: [],
  l3: { requestedClarify: false, clarified: false, diagOpen: null },

  // Метод для полного сброса состояния (полезно при рестарте)
  reset: function() {
    this.level = 1;
    this.currentId = null;
    this.results = {};
    this.resultsL2 = {};
    this.resultsL3 = {};
    this.orgVersions = [];
    this.createdProblems = [];
    this.l3 = { requestedClarify: false, clarified: false, diagOpen: null };
  },

  // Получить результаты для текущего уровня
  getResults: function(level) {
    if (level === 1) return this.results;
    if (level === 2) return this.resultsL2;
    return this.resultsL3;
  }
};
