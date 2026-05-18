// Mock data for the prototype.
//
// Multi-CSV model:
//   FILE_FIXTURES is a map keyed by fixture name (matches the filename
//   without the .csv) used by the demo / preset paths. Each fixture is
//   the parsed shape we store in `files[i]`. `DATASET` is kept as an
//   alias for the customer_churn fixture so legacy reads still work.
//
// Helpers exported on `window`:
//   makeFile(name)               — clones a fixture, assigns a fresh id
//   migrateInitialAssumptions(f) — rekeys INITIAL_ASSUMPTIONS under fileId
//   classify(prev, candidate, hint) — pure-heuristic merge classifier
//   mergedSchema(files, merges)  — derives Domain's view
//   topbarSubtitle(files)        — copy for the topbar's right-of-brand
//                                  meta. Returns a React element tree.
//   buildDemoState(presetName)   — returns { files, merges, assumptions,
//                                  stage, maxStage, mergeRevision,
//                                  mergeRevisionAtDomainEntry } snapshots
//                                  for every state the Tweaks panel
//                                  exposes.

const FILE_FIXTURES = {
  customer_churn: {
    name: 'customer_churn.csv',
    size: '847 KB',
    rows: 4271,
    cols: 9,
    blurb: "A customer subscription dataset with 4,271 rows and 9 columns. Each row represents one customer, including their tenure, monthly charges, contract type, and whether they churned. Looks like a binary classification problem.",
    columns: [
      { name: 'customer_id', type: 'categorical' },
      { name: 'tenure_months', type: 'numeric' },
      { name: 'monthly_charges', type: 'numeric' },
      { name: 'contract_type', type: 'categorical' },
      { name: 'payment_method', type: 'categorical' },
      { name: 'support_tickets', type: 'numeric' },
      { name: 'avg_session_min', type: 'numeric' },
      { name: 'plan_tier', type: 'categorical' },
      { name: 'churned', type: 'boolean' },
    ],
    preview: [
      ['C-1041', 14, 79.95, 'Month-to-month', 'Credit card', 3, 22.4, 'Standard', 'Yes'],
      ['C-1042', 62, 104.20, 'Two year', 'Bank transfer', 0, 41.7, 'Premium', 'No'],
      ['C-1043', 3, 49.50, 'Month-to-month', 'Mailed check', 5, 8.2, 'Basic', 'Yes'],
      ['C-1044', 38, 89.80, 'One year', 'Credit card', 1, 33.9, 'Standard', 'No'],
      ['C-1045', 27, 115.30, 'Two year', 'Credit card', 0, 52.1, 'Premium', 'No'],
      ['C-1046', 9, 62.40, 'Month-to-month', 'Electronic check', 4, 14.8, 'Basic', 'Yes'],
      ['C-1047', 49, 98.10, 'Two year', 'Bank transfer', 1, 38.6, 'Premium', 'No'],
      ['C-1048', 21, 71.20, 'One year', 'Credit card', 2, 26.3, 'Standard', 'No'],
      ['C-1049', 6, 54.80, 'Month-to-month', 'Mailed check', 6, 11.5, 'Basic', 'Yes'],
      ['C-1050', 55, 121.40, 'Two year', 'Bank transfer', 0, 47.9, 'Premium', 'No'],
    ],
  },
  support_tickets: {
    name: 'support_tickets.csv',
    size: '212 KB',
    rows: 4019,
    cols: 4,
    blurb: "A support log with 4,019 rows and 4 columns. Each row counts how many tickets a customer filed and how they were resolved. Shares customer_id with the main dataset — looks like it can be joined.",
    columns: [
      { name: 'customer_id', type: 'categorical' },
      { name: 'ticket_count', type: 'numeric' },
      { name: 'avg_resolution_hours', type: 'numeric' },
      { name: 'escalated', type: 'boolean' },
    ],
    preview: [
      ['C-1041', 3, 14.2, 'No'],
      ['C-1042', 0, 0, 'No'],
      ['C-1043', 5, 22.8, 'Yes'],
      ['C-1044', 1, 6.1, 'No'],
      ['C-1045', 0, 0, 'No'],
      ['C-1046', 4, 18.9, 'No'],
      ['C-1047', 1, 8.4, 'No'],
      ['C-1048', 2, 11.7, 'No'],
      ['C-1049', 6, 31.5, 'Yes'],
      ['C-1050', 0, 0, 'No'],
    ],
  },
  sales_2023: {
    name: 'sales_2023.csv',
    size: '512 KB',
    rows: 2840,
    cols: 5,
    blurb: "Sales records for 2023 — 2,840 rows, 5 columns: region, product, units, revenue, and the order date.",
    columns: [
      { name: 'order_date', type: 'categorical' },
      { name: 'region', type: 'categorical' },
      { name: 'product', type: 'categorical' },
      { name: 'units', type: 'numeric' },
      { name: 'revenue', type: 'numeric' },
    ],
    preview: [
      ['2023-01-04', 'EU-North', 'Premium', 4, 480.0],
      ['2023-01-04', 'NA-West', 'Basic', 1, 49.5],
      ['2023-01-05', 'APAC', 'Standard', 2, 159.8],
      ['2023-01-05', 'EU-North', 'Premium', 1, 120.0],
      ['2023-01-06', 'NA-East', 'Standard', 3, 239.7],
    ],
  },
  sales_2024: {
    name: 'sales_2024.csv',
    size: '548 KB',
    rows: 3102,
    cols: 5,
    blurb: "Sales records for 2024 — 3,102 rows, same schema as 2023.",
    columns: [
      { name: 'order_date', type: 'categorical' },
      { name: 'region', type: 'categorical' },
      { name: 'product', type: 'categorical' },
      { name: 'units', type: 'numeric' },
      { name: 'revenue', type: 'numeric' },
    ],
    preview: [
      ['2024-01-02', 'EU-North', 'Premium', 5, 605.0],
      ['2024-01-02', 'NA-West', 'Basic', 2, 99.0],
      ['2024-01-03', 'APAC', 'Standard', 4, 319.6],
      ['2024-01-04', 'EU-North', 'Premium', 1, 121.0],
      ['2024-01-05', 'NA-East', 'Standard', 6, 479.4],
    ],
  },
  weather_2023: {
    name: 'weather_2023.csv',
    size: '64 KB',
    rows: 365,
    cols: 4,
    blurb: "Daily weather observations for 2023 — 365 rows, 4 columns. No shared columns with the customer dataset.",
    columns: [
      { name: 'date', type: 'categorical' },
      { name: 'temperature', type: 'numeric' },
      { name: 'rainfall', type: 'numeric' },
      { name: 'humidity', type: 'numeric' },
    ],
    preview: [
      ['2023-01-01', 12.4, 0.0, 71],
      ['2023-01-02', 11.8, 2.1, 79],
      ['2023-01-03', 9.2, 5.3, 88],
      ['2023-01-04', 7.5, 0.0, 64],
      ['2023-01-05', 10.1, 1.8, 73],
    ],
  },
};

// Back-compat alias — some legacy reads still look at DATASET.*
const DATASET = FILE_FIXTURES.customer_churn;

const INITIAL_ASSUMPTIONS = {
  customer_id: [
    "Unique identifier for each customer — shared across our data sources.",
  ],
  tenure_months: [
    "How many months the customer has been subscribed.",
    "Likely a strong predictor — long-tenured customers tend to stay.",
  ],
  monthly_charges: [
    "What the customer pays per month, in dollars.",
    "Higher charges may correlate with churn if value isn't perceived.",
  ],
  contract_type: [
    "Length of the customer's contract commitment.",
    "Month-to-month customers historically churn more than annual.",
  ],
  payment_method: [
    "How the customer pays each cycle.",
    "Electronic check users have shown higher churn in similar datasets.",
  ],
  support_tickets: [
    "Number of support tickets opened in the last 90 days.",
    "Frustration signal — many tickets often precedes churn.",
  ],
  avg_session_min: [
    "Average minutes spent in-product per session.",
    "Engagement proxy; lower values suggest disengagement.",
  ],
  plan_tier: [
    "Subscription tier (Basic, Standard, Premium).",
    "Premium users often have stickier usage patterns.",
  ],
  churned: [
    "The target variable — did this customer cancel?",
    "Yes/No outcome. This is what the model should predict.",
  ],
  ticket_count: [
    "Total support tickets this customer has logged across all time.",
    "High counts often pair with churn — repeated friction with the product.",
  ],
  avg_resolution_hours: [
    "Average time, in hours, between a ticket being opened and closed.",
    "Slow resolutions can erode customer satisfaction over time.",
  ],
  escalated: [
    "Whether any of this customer's tickets were escalated to a senior agent.",
    "Yes/No flag — escalations usually signal an unresolved or serious issue.",
  ],
  date: [
    "The calendar day this observation was recorded.",
    "Used to align weather conditions with customer activity on the same day.",
  ],
  temperature: [
    "Daily average temperature, in degrees Celsius.",
    "Possible driver of seasonal demand — extreme temperatures may push usage up or down.",
  ],
  rainfall: [
    "Total daily precipitation, in millimetres.",
    "Wet days may correlate with indoor activity and different engagement patterns.",
  ],
  humidity: [
    "Daily average relative humidity, as a percentage.",
    "Comfort proxy — high humidity often coincides with longer indoor sessions.",
  ],
};

const INITIAL_TEST_CASES = [
  {
    id: 1,
    name: 'Long-tenured, low charges',
    inputs: { tenure_months: 48, monthly_charges: 65, contract_type: 'Two year', support_tickets: 0, avg_session_min: 38 },
    expected: 'No',
    predicted: 'No',
    confidence: 0.94,
  },
  {
    id: 2,
    name: 'New customer, many tickets',
    inputs: { tenure_months: 4, monthly_charges: 88, contract_type: 'Month-to-month', support_tickets: 5, avg_session_min: 9 },
    expected: 'Yes',
    predicted: 'Yes',
    confidence: 0.89,
  },
  {
    id: 3,
    name: 'Premium, mid-tenure',
    inputs: { tenure_months: 18, monthly_charges: 110, contract_type: 'One year', support_tickets: 1, avg_session_min: 31 },
    expected: 'No',
    predicted: 'No',
    confidence: 0.78,
  },
];

const AUTOML_STEPS = [
  { label: 'Profiling data and detecting types', t: 1200 },
  { label: 'Generating data preparation plan', t: 1600 },
  { label: 'Training candidate models', t: 3500 },
  { label: 'Hyperparameter optimization (32 trials)', t: 3000 },
  { label: 'Evaluating on hold-out set', t: 1400 },
  { label: 'Selecting best model', t: 800 },
];

const MODEL_PLANS = [
  { name: 'GradientBoostingClassifier', score: 0.847, time: '12s', best: true },
  { name: 'RandomForestClassifier', score: 0.831, time: '8s' },
  { name: 'XGBoostClassifier', score: 0.829, time: '14s' },
  { name: 'LogisticRegression', score: 0.792, time: '2s' },
  { name: 'LightGBMClassifier', score: 0.838, time: '9s' },
  { name: 'KNeighborsClassifier', score: 0.741, time: '4s' },
];

// ─────────────────────────────────────────────────────────────────────
// Multi-CSV helpers
// ─────────────────────────────────────────────────────────────────────

let __fileIdSeq = 0;
function nextFileId() { __fileIdSeq += 1; return 'f' + __fileIdSeq; }

// Build a fresh `file` entry from a fixture name.
function makeFile(fixtureName, opts) {
  const base = FILE_FIXTURES[fixtureName];
  if (!base) throw new Error('Unknown fixture: ' + fixtureName);
  return {
    id: (opts && opts.id) || nextFileId(),
    name: base.name,
    size: base.size,
    rows: base.rows,
    cols: base.cols,
    blurb: base.blurb,
    columns: base.columns.map(c => ({ ...c })),
    preview: base.preview.map(r => r.slice()),
    status: (opts && opts.status) || 'parsed',
  };
}

// Re-key INITIAL_ASSUMPTIONS under a specific fileId. Called when the
// first file lands so the seed text survives the keying change.
function migrateInitialAssumptions(file) {
  const out = {};
  for (const col of file.columns) {
    const seed = INITIAL_ASSUMPTIONS[col.name];
    if (seed && seed.length) out[file.id + ':' + col.name] = seed.slice();
  }
  return out;
}

// Assumption stubs for a newly-arrived file. If INITIAL_ASSUMPTIONS has
// seed text for a column, use it; otherwise insert an empty array so
// Domain flags it as "needs a note".
function blankAssumptionsForFile(file, existing) {
  const next = { ...(existing || {}) };
  for (const col of file.columns) {
    const k = file.id + ':' + col.name;
    if (k in next) continue;
    const seed = INITIAL_ASSUMPTIONS[col.name];
    next[k] = seed && seed.length ? seed.slice() : [];
  }
  return next;
}

// ─────────────────────────────────────────────────────────────────────
// classify — pure heuristic on column overlap.
//
//   prev      — null on file 1, else the previous mergedSchema(...)
//   candidate — the file being classified
//   hint      — optional user-typed hint string from the escape hatch
//
// Returns { kind, keys?, coercions?, stats } and is intended to be
// folded straight into a `merges[i]` entry.
// ─────────────────────────────────────────────────────────────────────
function classify(prevSchema, candidate, hint) {
  if (!prevSchema) {
    return null; // file 1 is always accepted, no merge
  }

  const prevColMap = new Map();
  for (const g of prevSchema.groups) {
    for (const c of g.columns) prevColMap.set(c.name, c.type);
  }
  for (const c of prevSchema.sharedColumns || []) prevColMap.set(c.name, c.type);

  const candCols = candidate.columns;
  const sharedNames = [];
  const typeMismatches = [];
  for (const c of candCols) {
    if (prevColMap.has(c.name)) {
      sharedNames.push(c.name);
      const prevType = prevColMap.get(c.name);
      if (prevType !== c.type) typeMismatches.push({ col: c.name, from: prevType, to: c.type });
    }
  }

  const candNames = new Set(candCols.map(c => c.name));
  const prevColCount = prevColMap.size;
  const schemaOverlapPct = prevColCount === 0
    ? 0
    : Math.round((sharedNames.length / prevColCount) * 100);

  // Concat — heavy column overlap, same shape
  if (schemaOverlapPct >= 80 && candCols.length === prevColCount) {
    return {
      kind: 'concat',
      coercions: typeMismatches,
      stats: {
        sharedSchema: sharedNames.length + '/' + Math.max(prevColCount, candCols.length),
        resultRows: prevSchema.rows + candidate.rows,
        resultCols: prevColCount,
      },
    };
  }

  // Join — at least one shared column name, used as key. Prefer
  // canonical id-shaped names (customer_id, user_id, *_id) when
  // multiple shared columns exist.
  if (sharedNames.length >= 1) {
    let key = sharedNames.find(n => /(^|_)id$/i.test(n)) || sharedNames[0];

    // If the user hinted, try to honour it.
    if (hint) {
      const hintLower = hint.toLowerCase();
      const hinted = sharedNames.find(n => hintLower.includes(n.toLowerCase()));
      if (hinted) key = hinted;
    }
    const overlap = Math.round(
      Math.min(prevSchema.rows, candidate.rows) /
      Math.max(prevSchema.rows, candidate.rows) * 100
    );
    return {
      kind: 'join',
      keys: [[key, key]],
      stats: {
        overlap,
        resultRows: Math.max(prevSchema.rows, candidate.rows),
        resultCols: prevColCount + (candCols.length - 1), // minus shared key column
      },
    };
  }

  // Hint escape hatch — relaxed substring match.
  if (hint) {
    const hintLower = hint.toLowerCase();
    const hintedLeft = [...prevColMap.keys()].find(n => hintLower.includes(n.toLowerCase()));
    const hintedRight = candCols.map(c => c.name).find(n => hintLower.includes(n.toLowerCase()));
    if (hintedLeft && hintedRight) {
      const overlap = Math.round(
        Math.min(prevSchema.rows, candidate.rows) /
        Math.max(prevSchema.rows, candidate.rows) * 100
      );
      return {
        kind: 'join',
        keys: [[hintedLeft, hintedRight]],
        stats: {
          overlap,
          resultRows: Math.max(prevSchema.rows, candidate.rows),
          resultCols: prevColCount + candCols.length - 1,
        },
      };
    }
  }

  return {
    kind: 'refused',
    stats: { resultRows: prevSchema.rows, resultCols: prevColCount },
  };
}

// ─────────────────────────────────────────────────────────────────────
// mergedSchema — fold (files, merges) into the structure Domain renders.
//
// Skips files marked status: 'refused'. Returns:
//   { rows, cols, parsedCount,
//     sharedColumns, groups, joinKeys }
//
// For a single parsed file: one group, no sharedColumns, no joinKeys.
// For a join chain: one group per file, the join-key column on each
// non-leftmost file gets role: 'joinKey'.
// For a concat chain: ALL files contribute to a single `sharedColumns`
// list (their schemas match by definition); groups stays empty.
// ─────────────────────────────────────────────────────────────────────
function mergedSchema(files, merges) {
  const parsed = (files || []).filter(f => f.status !== 'refused');
  if (parsed.length === 0) {
    return { rows: 0, cols: 0, parsedCount: 0, sharedColumns: [], groups: [], joinKeys: [] };
  }
  if (parsed.length === 1) {
    return {
      rows: parsed[0].rows,
      cols: parsed[0].cols,
      parsedCount: 1,
      sharedColumns: [],
      groups: [{
        fileId: parsed[0].id,
        name: parsed[0].name,
        columns: parsed[0].columns.map(c => ({ ...c, role: 'normal' })),
      }],
      joinKeys: [],
    };
  }

  // Determine chain kind by majority — if every merge is concat, treat as concat;
  // otherwise treat as join (mixed chains are rare in this prototype, so the
  // dominant kind picks).
  const parsedMerges = (merges || []).filter(m => m && m.kind !== 'refused');
  const allConcat = parsedMerges.length > 0 && parsedMerges.every(m => m.kind === 'concat');

  if (allConcat) {
    // All files share schema; render columns once.
    const first = parsed[0];
    const totalRows = parsed.reduce((s, f) => s + f.rows, 0);
    return {
      rows: totalRows,
      cols: first.cols,
      parsedCount: parsed.length,
      sharedColumns: first.columns.map(c => ({
        ...c,
        sourceIds: parsed.map(f => f.id),
      })),
      groups: [],
      joinKeys: [],
    };
  }

  // Join (or mixed) — one group per file, join-key column on the right side
  // gets a role marker. Total rows = max across files, cols = sum minus
  // the duplicated keys.
  const groups = [];
  const joinKeys = [];
  let totalCols = 0;
  let maxRows = 0;

  parsed.forEach((file, i) => {
    const merge = parsedMerges[i - 1]; // merge that brought this file in
    const keyOnThisFile = merge && merge.keys ? merge.keys[0][1] : null;
    groups.push({
      fileId: file.id,
      name: file.name,
      columns: file.columns.map(c => ({
        ...c,
        role: (i > 0 && c.name === keyOnThisFile) ? 'joinKey' : 'normal',
      })),
    });
    if (i === 0) totalCols += file.columns.length;
    else totalCols += file.columns.length - (keyOnThisFile ? 1 : 0);
    if (file.rows > maxRows) maxRows = file.rows;
    if (merge && merge.keys) {
      const prevFile = parsed[i - 1];
      joinKeys.push([prevFile.id, merge.keys[0][0], file.id, merge.keys[0][1]]);
    }
  });

  return {
    rows: maxRows,
    cols: totalCols,
    parsedCount: parsed.length,
    sharedColumns: [],
    groups,
    joinKeys,
  };
}

// ─────────────────────────────────────────────────────────────────────
// inferTaskType — map a target column's dtype to a task description.
// Used by Stage 3 (Setup) for the plain-language summary and the
// cascade-confirm copy when the user changes target.
// ─────────────────────────────────────────────────────────────────────
function inferTaskType(col) {
  if (!col) return { kind: 'classification', phrase: 'yes or no', metric: 'accuracy' };
  if (col.type === 'boolean') return { kind: 'classification', phrase: 'yes or no', metric: 'accuracy' };
  if (col.type === 'numeric')  return { kind: 'regression',     phrase: 'a number',  metric: 'RMSE' };
  if (col.type === 'categorical') return { kind: 'multiclass',  phrase: 'one of N categories', metric: 'macro F1' };
  return { kind: 'classification', phrase: 'yes or no', metric: 'accuracy' };
}

// ─────────────────────────────────────────────────────────────────────
// defaultTargetKey — heuristic pick for the target column on Domain
// entry. Skips join-key columns. Order of preference:
//   1. Last boolean column
//   2. Last column whose name matches /churn|target|label|outcome|status|predict/i
//   3. Last entry overall
// Returns a string keyed identically to assumption keys
// (`fileId:colName` or `shared:colName`), or null for an empty schema.
// ─────────────────────────────────────────────────────────────────────
function defaultTargetKey(schema) {
  if (!schema || schema.parsedCount === 0) return null;
  const flat = [
    ...schema.sharedColumns.map(c => ({ key: 'shared:' + c.name, col: c })),
    ...schema.groups.flatMap(g => g.columns.map(c => ({ key: g.fileId + ':' + c.name, col: c }))),
  ].filter(({ col }) => col.role !== 'joinKey');
  if (flat.length === 0) return null;

  let lastBoolean = null;
  let lastNameMatch = null;
  const nameRe = /(churn|target|label|outcome|status|predict)/i;
  for (const entry of flat) {
    if (entry.col.type === 'boolean') lastBoolean = entry;
    if (nameRe.test(entry.col.name)) lastNameMatch = entry;
  }
  if (lastBoolean) return lastBoolean.key;
  if (lastNameMatch) return lastNameMatch.key;
  return flat[flat.length - 1].key;
}

// ─────────────────────────────────────────────────────────────────────
// extractCategoricalValues — walk a fixture's preview rows for one
// column and return the unique, insertion-ordered list of cell values
// (coerced to strings). Used by Stage 5's form to populate <select>s.
// Accepts either a fixture object or a filename string.
// ─────────────────────────────────────────────────────────────────────
function extractCategoricalValues(fixtureOrName, colName) {
  const fixture = typeof fixtureOrName === 'string'
    ? Object.values(FILE_FIXTURES).find(f => f.name === fixtureOrName)
    : fixtureOrName;
  if (!fixture) return [];
  const idx = fixture.columns.findIndex(c => c.name === colName);
  if (idx < 0) return [];
  const seen = new Set();
  const out = [];
  for (const row of fixture.preview || []) {
    const v = row[idx];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

// firstPreviewValue — return the first preview row's cell for a column.
// Used by Stage 5's form to seed default field values.
function firstPreviewValue(fixtureOrName, colName) {
  const fixture = typeof fixtureOrName === 'string'
    ? Object.values(FILE_FIXTURES).find(f => f.name === fixtureOrName)
    : fixtureOrName;
  if (!fixture) return undefined;
  const idx = fixture.columns.findIndex(c => c.name === colName);
  if (idx < 0) return undefined;
  const row = (fixture.preview || [])[0];
  return row ? row[idx] : undefined;
}

// ─────────────────────────────────────────────────────────────────────
// PREP_NOTES — per-column auto data-preparation notes surfaced on the
// Stage 3 input-node hover tooltip. Each entry returns null or a
// { headline, paragraphs[], rowsAffected, before[][], after[][] }
// object given the row count from the column's source file. Currently
// only `plan_tier` has a note; add more entries here as the prototype
// grows.
// ─────────────────────────────────────────────────────────────────────
const PREP_NOTES = {
  plan_tier: (rows) => ({
    headline: "I'll group discontinued plan tiers into `Basic` before training.",
    paragraphs: [
      "Your data has 5 plan tiers. Two — `Legacy-Bronze` and `Legacy-Silver` — only appear in 47 rows total. That's not enough for the model to learn a reliable pattern from, so I'll roll them into `Basic` (the closest current tier in price).",
      "Rows affected: 47 of " + (rows ? rows.toLocaleString() : '?') + " (" + (rows ? ((47 / rows) * 100).toFixed(1) : '?') + "%)",
    ],
    before: [
      ['Basic',          '2,104'],
      ['Standard',       '1,389'],
      ['Premium',          '731'],
      ['Legacy-Bronze',     '29'],
      ['Legacy-Silver',     '18'],
    ],
    after: [
      ['Basic',          '2,151'],
      ['Standard',       '1,389'],
      ['Premium',          '731'],
      ['Legacy-Bronze',      '—'],
      ['Legacy-Silver',      '—'],
    ],
  }),
};

function getPrepNote(colName, sourceFile) {
  const factory = PREP_NOTES[colName];
  if (!factory) return null;
  return factory(sourceFile && sourceFile.rows);
}

// ─────────────────────────────────────────────────────────────────────
// topbarSubtitle — string copy for the topbar's right-of-brand meta.
// Returns a plain string; the caller wraps the mono span itself.
// ─────────────────────────────────────────────────────────────────────
function topbarSubtitle(files) {
  const parsed = (files || []).filter(f => f.status !== 'refused');
  if (parsed.length === 0) return '';
  if (parsed.length === 1) return parsed[0].name.replace(/\.csv$/i, '');
  if (parsed.length === 2) {
    return parsed.map(f => f.name.replace(/\.csv$/i, '')).join(' + ');
  }
  return parsed.length + ' sources';
}

// ─────────────────────────────────────────────────────────────────────
// DEMO_PRESETS — pre-baked state snapshots wired into the Tweaks panel.
//
// Each entry returns:
//   { files, merges, assumptions, stage, maxStage, mergeRevision?,
//     mergeRevisionAtDomainEntry? }
//
// applyPreset in app.jsx slams these straight into state. Presets must
// not introduce keys outside the real Upload/Domain shapes.
// ─────────────────────────────────────────────────────────────────────
function buildDemoState(name) {
  // Helper closures share the file/merge generation logic.
  const f = (fixture, opts) => makeFile(fixture, opts);

  if (name === 'reset' || name === 'upload_empty') {
    return { files: [], merges: [], assumptions: {}, stage: 1, maxStage: 1, mergeRevision: 0, mergeRevisionAtDomainEntry: 0 };
  }

  if (name === 'upload_one') {
    const f1 = f('customer_churn', { id: 'f1' });
    return {
      files: [f1],
      merges: [],
      assumptions: migrateInitialAssumptions(f1),
      stage: 1, maxStage: 1, mergeRevision: 1, mergeRevisionAtDomainEntry: 0,
    };
  }

  if (name === 'upload_join') {
    const f1 = f('customer_churn', { id: 'f1' });
    const f2 = f('support_tickets', { id: 'f2' });
    const m = classify(mergedSchema([f1], []), f2);
    return {
      files: [f1, f2],
      merges: [m],
      assumptions: blankAssumptionsForFile(f2, migrateInitialAssumptions(f1)),
      stage: 1, maxStage: 1, mergeRevision: 2, mergeRevisionAtDomainEntry: 0,
    };
  }

  if (name === 'upload_concat') {
    const f1 = f('sales_2023', { id: 'f1' });
    const f2 = f('sales_2024', { id: 'f2' });
    const m = classify(mergedSchema([f1], []), f2);
    return {
      files: [f1, f2],
      merges: [m],
      assumptions: blankAssumptionsForFile(f2, migrateInitialAssumptions(f1)),
      stage: 1, maxStage: 1, mergeRevision: 2, mergeRevisionAtDomainEntry: 0,
    };
  }

  if (name === 'upload_refused') {
    const f1 = f('customer_churn', { id: 'f1' });
    const f2 = f('weather_2023', { id: 'f2', status: 'refused' });
    const prev = mergedSchema([f1], []);
    // classify against parsed file so the refused entry is realistic
    const m = classify(prev, f2) || { kind: 'refused', stats: { resultRows: prev.rows, resultCols: prev.cols } };
    return {
      files: [f1, f2],
      merges: [m],
      assumptions: migrateInitialAssumptions(f1),
      stage: 1, maxStage: 1, mergeRevision: 2, mergeRevisionAtDomainEntry: 0,
    };
  }

  if (name === 'upload_refused_resolved') {
    const f1 = f('customer_churn', { id: 'f1' });
    const f2 = f('weather_2023', { id: 'f2', status: 'parsed' });
    // Pretend the escape hatch landed a join on a fabricated common
    // key — for the demo we just stub a join entry on `date`/`obs_date`.
    const m = {
      kind: 'join',
      keys: [['customer_id', 'date']],
      stats: { overlap: 78, resultRows: f1.rows, resultCols: f1.cols + f2.cols - 1 },
    };
    return {
      files: [f1, f2],
      merges: [m],
      assumptions: blankAssumptionsForFile(f2, migrateInitialAssumptions(f1)),
      stage: 1, maxStage: 1, mergeRevision: 3, mergeRevisionAtDomainEntry: 0,
    };
  }

  // Unknown preset — return empty.
  return buildDemoState('reset');
}

const UPLOAD_PRESETS = [
  { value: 'upload_empty', label: 'A · empty' },
  { value: 'upload_one', label: 'B · one file' },
  { value: 'upload_join', label: 'D · join' },
  { value: 'upload_concat', label: 'E · concat' },
  { value: 'upload_refused', label: 'F · refused' },
  { value: 'upload_refused_resolved', label: 'F → resolved' },
];

Object.assign(window, {
  DATASET, FILE_FIXTURES,
  INITIAL_ASSUMPTIONS, INITIAL_TEST_CASES,
  AUTOML_STEPS, MODEL_PLANS,
  makeFile, migrateInitialAssumptions, blankAssumptionsForFile,
  classify, mergedSchema, topbarSubtitle,
  inferTaskType, defaultTargetKey,
  extractCategoricalValues, firstPreviewValue,
  getPrepNote,
  buildDemoState, UPLOAD_PRESETS,
});
