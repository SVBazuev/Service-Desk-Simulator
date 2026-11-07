/**
 * state.js — централизованное состояние приложения.
 */
var State = {
  level: 1,
  currentId: null,
  resultsByLevel: {},  // { 1: {}, 2: {}, 3: {}, ... }
  orgVersions: [],
  createdProblems: [],
  l3: { requestedClarify: false, clarified: false, diagOpen: null },

  reset: function() {
    this.level = 1;
    this.currentId = null;
    this.resultsByLevel = {};
    this.orgVersions = [];
    this.createdProblems = [];
    this.l3 = { requestedClarify: false, clarified: false, diagOpen: null };
  },

  getResults: function(level) {
    if (!this.resultsByLevel[level]) this.resultsByLevel[level] = {};
    return this.resultsByLevel[level];
  },

  // Backward-compat accessors (используются autotests.js)
  get results()   { return this.getResults(1); },
  set results(v)  { this.resultsByLevel[1] = v; },
  get resultsL2() { return this.getResults(2); },
  set resultsL2(v){ this.resultsByLevel[2] = v; },
  get resultsL3() { return this.getResults(3); },
  set resultsL3(v){ this.resultsByLevel[3] = v; }
};
