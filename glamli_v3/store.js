// store.js — sessionStorage persistence layer for the multi-page
// GLAMLI v3. Loaded FIRST on every page (before any JSX module).
//
// The v2 prototype kept all workflow state in one React closure.
// Splitting into separate HTML pages means a full-page navigation
// destroys React memory, so the durable subset of state is mirrored
// here under a single sessionStorage key and rehydrated on each page
// load.
//
// sessionStorage (not localStorage): survives navigation within a tab
// but a brand-new tab resets to empty — each evaluator opens the demo
// clean.

(function () {
  var KEY = 'glamli_v3_state';

  // Durable state shape. Defaults match v2's initial App() state with
  // ONE deliberate change: v3 starts empty on Upload (stage 1) rather
  // than auto-applying the join preset.
  function defaults() {
    return {
      files: [],
      merges: [],
      mergeRevision: 0,
      mergeRevisionAtDomainEntry: 0,
      assumptions: {},
      typeOverrides: {},        // { 'fileId:colName' -> type } from Domain
      testCases: [],            // seeded from INITIAL_TEST_CASES by page roots
      messages: [],
      shownIntros: [],          // array form of the Set
      targetCol: null,
      runDone: false,
      hasTested: false,
      predictInputs: {},
      predictResult: null,
      lastPredictedTargetKey: null,
      tweaks: { theme: 'light', density: 'comfortable', accent: 'sage' },
      stage: 1,
      maxStage: 1,
    };
  }

  // stage → page filename
  var NAV = {
    1: 'upload.html',
    2: 'domain.html',
    3: 'setup.html',
    4: 'run.html',
    5: 'predict.html',
  };

  function load() {
    var base = defaults();
    var raw;
    try {
      raw = sessionStorage.getItem(KEY);
    } catch (e) {
      return base;
    }
    if (!raw) return base;
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return base;
    }
    if (!parsed || typeof parsed !== 'object') return base;
    // Shallow-merge over defaults so a new key added later still has a
    // sane default for an old stored blob.
    var out = base;
    for (var k in parsed) {
      if (Object.prototype.hasOwnProperty.call(parsed, k)) out[k] = parsed[k];
    }
    return out;
  }

  function save(partial) {
    var cur;
    try {
      var raw = sessionStorage.getItem(KEY);
      cur = raw ? JSON.parse(raw) : defaults();
    } catch (e) {
      cur = defaults();
    }
    if (!cur || typeof cur !== 'object') cur = defaults();
    if (partial && typeof partial === 'object') {
      for (var k in partial) {
        if (Object.prototype.hasOwnProperty.call(partial, k)) cur[k] = partial[k];
      }
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(cur));
    } catch (e) {
      // Quota or serialization failure — non-fatal for a demo.
      // eslint-disable-next-line no-console
      console.warn('Store.save failed', e);
    }
    return cur;
  }

  function clear() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  // Persist {stage,maxStage} then navigate to the page for stage n.
  // Callers should Store.save(currentState) BEFORE calling go() so the
  // destination hydrates the latest state.
  function go(n) {
    var cur = load();
    var max = Math.max(cur.maxStage || 1, n);
    save({ stage: n, maxStage: max });
    var dest = NAV[n] || NAV[1];
    window.location.href = dest;
  }

  window.Store = {
    KEY: KEY,
    NAV: NAV,
    defaults: defaults,
    load: load,
    save: save,
    clear: clear,
    go: go,
  };
})();
