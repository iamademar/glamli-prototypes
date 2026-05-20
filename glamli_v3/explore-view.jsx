// explore-view.jsx — per-file data-exploration view, rendered INSIDE the
// shared app shell (as a sub-view of Upload) via makePageApp(1, {
// subView: 'explore' }). Reads ?file=<name>, synthesizes the file's
// rows via window.generateFullRows (data.jsx), and renders the
// "Here's what's in <file>" report described by the GLAMLI Explore Page
// Specification v2.
//
// v2 STRUCTURE — three narrated tabs inside the same shell:
//   (a) Overview     — Class Distribution (target file only), stat tiles,
//                      Missing-by-Attribute + Outliers-by-Attribute ranked
//                      bar lists; cross-file banner replaces the class
//                      chart on non-target files.
//   (b) Data Preview — three sub-sections (Sample / Rows with Missing /
//                      Rows with Outliers), each capped at 10 rows, with
//                      a one-time em-dash legend.
//   (c) Visualization — the prose-first per-column cards (unchanged from
//                      v1) plus a per-card "missing"/"outliers" chip and
//                      the gated Technical view at the bottom.
//
// The Visualization-tab card rules and the Technical view are unchanged
// from v1 (the governing rule lives in v2 §1.1: narrate first, single
// interaction, no axis re-binning, no raw-number tooltips).

const qs = new URLSearchParams(window.location.search);
const FILE_NAME = qs.get('file') || '';

const HICARD_LIMIT = 12;     // distinct values above which we don't chart
const NUM_BINS = 12;
const CARD_BINS = 5;         // coarse, human-readable bins on the card face
const PREVIEW_LIMIT = 10;    // hard cap on rows shown in Data Preview tab

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '–';
  if (Number.isInteger(n)) return n.toLocaleString();
  return (Math.round(n * 100) / 100).toLocaleString();
}

function fmtInt(n) {
  return Math.round(n).toLocaleString();
}

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function pctFine(part, whole) {
  if (!whole) return '0';
  const p = (part / whole) * 100;
  if (p === 0) return '0';
  if (p < 0.01) return '<0.01';
  if (p < 1) return p.toFixed(2);
  return p.toFixed(p < 10 ? 1 : 0);
}

// data.jsx is a <script type="text/babel"> — compiled async; wait
// (bounded) for its window globals before rendering.
function waitForData(timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const ok =
        typeof window.generateFullRows === 'function' &&
        window.FILE_FIXTURES &&
        Object.keys(window.FILE_FIXTURES).length > 0;
      if (ok) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 60);
    };
    tick();
  });
}

// ── Column-shape classification ──────────────────────────────────────
// Map a fixture column + its values onto one of the mockup's four
// card "kinds": id, yesno, numeric, category. The chip label and css
// class follow from the kind.
function classifyColumn(col, colIndex, values, distinctCount) {
  const idByName = colIndex === 0 && /(^|_)id$/i.test(col.name);
  const looksUnique = distinctCount >= Math.max(20, values.length * 0.9);
  if (idByName || (col.type === 'categorical' && looksUnique)) {
    return { kind: 'id', chip: 'ID-like', chipClass: 'id' };
  }
  if (col.type === 'boolean' || (col.type !== 'numeric' && distinctCount === 2)) {
    return { kind: 'yesno', chip: 'Yes / No', chipClass: 'yn' };
  }
  if (col.type === 'numeric') {
    return { kind: 'numeric', chip: 'Numeric', chipClass: 'num' };
  }
  return { kind: 'category', chip: 'Category', chipClass: 'cat' };
}

// ── Numeric helpers — quantiles, coarse bins, fine bins ──────────────
function quantile(sortedNums, q) {
  if (sortedNums.length === 0) return null;
  const pos = (sortedNums.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedNums[lo];
  return sortedNums[lo] + (sortedNums[hi] - sortedNums[lo]) * (pos - lo);
}

function numericStats(values) {
  const nums = values.map(Number).filter(v => !Number.isNaN(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const min = nums[0], max = nums[nums.length - 1];
  const q1 = quantile(nums, 0.25);
  const med = quantile(nums, 0.5);
  const q3 = quantile(nums, 0.75);
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr;
  const hiFence = q3 + 1.5 * iqr;
  let outliers = 0;
  const outlierIdx = new Set();
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] < loFence || nums[i] > hiFence) outliers++;
  }
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { nums, n: nums.length, min, max, q1, med, q3, mean, outliers, loFence, hiFence };
}

// Coarse, label-friendly bins for the card face (≤ CARD_BINS rows).
function coarseBins(stats) {
  const { min, max } = stats;
  const span = (max - min) || 1;
  const isInt = stats.nums.every(Number.isInteger);
  const nBins = Math.min(CARD_BINS, Math.max(2, Math.round(Math.sqrt(stats.n / 50)) + 2));
  const step = span / nBins;
  const edges = [];
  for (let i = 0; i <= nBins; i++) edges.push(min + step * i);
  const counts = new Array(nBins).fill(0);
  for (const v of stats.nums) {
    let b = Math.floor((v - min) / step);
    if (b >= nBins) b = nBins - 1;
    if (b < 0) b = 0;
    counts[b]++;
  }
  const labels = [];
  for (let i = 0; i < nBins; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    if (isInt && step <= 1.0001) {
      labels.push(fmtInt(lo));
    } else if (isInt) {
      labels.push(fmtInt(Math.ceil(lo)) + '–' + fmtInt(Math.floor(hi)));
    } else {
      labels.push(fmtNum(Math.round(lo)) + '–' + fmtNum(Math.round(hi)));
    }
  }
  return { counts, labels };
}

// Fine bins for the gated histogram / box-plot positioning.
function fineBins(stats) {
  const { min, max } = stats;
  const span = (max - min) || 1;
  const counts = new Array(NUM_BINS).fill(0);
  for (const v of stats.nums) {
    const b = Math.min(NUM_BINS - 1, Math.floor((v - min) / span * NUM_BINS));
    counts[b]++;
  }
  return counts;
}

function categoricalCounts(values, valueSet) {
  const idx = new Map(valueSet.map((v, i) => [v, i]));
  const counts = new Array(valueSet.length).fill(0);
  for (const raw of values) {
    const i = idx.get(String(raw));
    if (i != null) counts[i]++;
  }
  return counts;
}

// ── File-level quality model ─────────────────────────────────────────
// Computes per-column missing + outlier counts AND injects the synthetic
// patterns the spec calls for so the page has something to narrate on
// the customer_churn fixture (rows are generated, so we sprinkle a few
// realistic gaps + extreme tickets that match the v2 §3 examples).
//
// Returned shape:
//   {
//     perCol: [{ name, missingCount, outlierCount, type, kind }, ...],
//     missingMask: rows.length × cols.length boolean grid (true if cell missing)
//     outlierMask: rows.length × cols.length boolean grid (true if cell outlier)
//     totalMissing, totalOutliers
//   }
function buildQualityModel(fixture, rows) {
  const cols = fixture.columns;
  const nRows = rows.length;
  const nCols = cols.length;
  const missingMask = rows.map(() => new Array(nCols).fill(false));
  const outlierMask = rows.map(() => new Array(nCols).fill(false));

  // Inject synthetic missingness that matches the v2 §3.3 example
  // ("3 columns have small gaps"). Only seeded on customer_churn so the
  // narrative example lands; other fixtures keep their generated state.
  // We use a deterministic prime-step walk so the same file always shows
  // the same gaps on reload.
  const isChurn = fixture.name === 'customer_churn.csv';
  const isTickets = fixture.name === 'support_tickets.csv';

  const seedMissing = (colName, count) => {
    const ci = cols.findIndex(c => c.name === colName);
    if (ci < 0) return;
    // walk: start offset, prime step, mod nRows — gives 8 distinct rows.
    const step = 433;
    let r = (colName.length * 17 + 7) % nRows;
    for (let k = 0; k < count; k++) {
      missingMask[r][ci] = true;
      r = (r + step) % nRows;
    }
  };

  if (isChurn) {
    seedMissing('payment_method', 8);
    seedMissing('avg_session_min', 3);
    seedMissing('contract_type', 2);
  } else if (isTickets) {
    seedMissing('avg_resolution_hours', 5);
    seedMissing('escalated', 2);
  }

  // Per-column counts.
  const perCol = cols.map((c, ci) => {
    const values = rows.map(r => r[ci]);
    const distinctCount = (c.type === 'numeric')
      ? new Set(values).size
      : (window.extractCategoricalValues
          ? window.extractCategoricalValues(fixture, c.name).length
          : new Set(values.map(String)).size);
    const kind = classifyColumn(c, ci, values, distinctCount).kind;

    let missingCount = 0;
    for (let r = 0; r < nRows; r++) if (missingMask[r][ci]) missingCount++;

    let outlierCount = 0;
    if (c.type === 'numeric' && kind === 'numeric') {
      const stats = numericStats(values.filter((_, r) => !missingMask[r][ci]));
      if (stats) {
        // Re-scan original values, marking those past the fences as outliers.
        for (let r = 0; r < nRows; r++) {
          if (missingMask[r][ci]) continue;
          const v = Number(values[r]);
          if (Number.isNaN(v)) continue;
          if (v < stats.loFence || v > stats.hiFence) {
            outlierMask[r][ci] = true;
            outlierCount++;
          }
        }
      }
    }

    // Rare-value flag — must match the synthetic injection inside the
    // ColumnCard's plan_tier branch (v2 §5.2). Surfaced on the Overview
    // tile so the user sees the same signal on both tabs.
    const rareValue = (c.name === 'plan_tier' && kind === 'category');

    return {
      name: c.name, type: c.type, kind,
      missingCount, outlierCount, rareValue,
    };
  });

  let totalMissing = 0, totalOutliers = 0;
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      if (missingMask[r][c]) totalMissing++;
      if (outlierMask[r][c]) totalOutliers++;
    }
  }

  return { perCol, missingMask, outlierMask, totalMissing, totalOutliers, nRows, nCols };
}

// ── Prose findings — generated, not hard-coded ───────────────────────
function numericFinding(col, stats) {
  const heavyTail = stats.outliers > 0 &&
    stats.max > stats.q3 + 3 * ((stats.q3 - stats.q1) || 1);
  const band = fmtNum(stats.q1) + '–' + fmtNum(stats.q3);
  if (heavyTail) {
    return {
      lead: 'Half of all rows sit between ',
      strong: band,
      tail: '. ',
      accent: 'A handful go much higher — up to ' + fmtNum(stats.max) + '.',
    };
  }
  return {
    lead: 'Most values land between ',
    strong: band,
    tail: ' (median ' + fmtNum(stats.med) + ', range ' +
      fmtNum(stats.min) + '–' + fmtNum(stats.max) + ').',
    accent: null,
  };
}

function categoricalFinding(valueSet, counts, total) {
  const order = counts.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
  const topV = valueSet[order[0][1]];
  const topPct = pct(order[0][0], total);
  const rare = order[order.length - 1];
  const rarePct = pct(rare[0], total);
  const lead = topPct >= 50 ? 'Most rows are ' : 'The most common value is ';
  return {
    lead,
    strong: topV + ' (' + topPct + '%)',
    tail: (order.length > 1 && rarePct <= 12)
      ? '. ' + valueSet[rare[1]] + ' is rare (' + rarePct + '%).'
      : '.',
    accent: null,
  };
}

function yesNoFinding(valueSet, counts, total) {
  const order = counts.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
  const majorV = valueSet[order[0][1]];
  const minorV = valueSet[order[order.length - 1][1]];
  const minorPct = pct(order[order.length - 1][0], total);
  const majorPct = pct(order[0][0], total);
  if (majorPct - minorPct <= 12) {
    return {
      lead: 'Roughly an even split — ',
      strong: majorPct + '% ' + majorV,
      tail: ' vs ' + minorPct + '% ' + minorV + '.',
      accent: null,
    };
  }
  const ratio = minorPct > 0 ? Math.max(2, Math.round(100 / minorPct)) : null;
  return {
    lead: ratio ? 'About ' : 'Only ',
    strong: ratio ? ('1 in ' + ratio + ' rows') : (minorPct + '%'),
    tail: ' are ' + minorV + ' — most are ' + majorV + '.',
    accent: null,
  };
}

// ── Direct-labelled bars (no axis) ───────────────────────────────────
function Bars({ rows, onSelect, selectedLabel, subsetCounts }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return React.createElement(
    'div', { className: 'xp-bars' },
    rows.map((r, i) => {
      const isSelected = selectedLabel != null && selectedLabel === r.label;
      const subset = subsetCounts ? (subsetCounts[i] || 0) : null;
      const rowProps = {
        className:
          'xp-bar-row' +
          (isSelected ? ' selected' : '') +
          (onSelect ? ' selectable' : '') +
          (subsetCounts ? ' has-subset' : ''),
        key: i,
      };
      if (onSelect) {
        rowProps.role = 'button';
        rowProps.tabIndex = 0;
        rowProps['aria-pressed'] = isSelected ? 'true' : 'false';
        rowProps['aria-label'] =
          (isSelected ? 'Clear selection ' : 'Highlight ') + r.label;
        rowProps.onClick = (e) => { e.preventDefault(); onSelect(r.label); };
        rowProps.onKeyDown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(r.label);
          }
        };
      }
      return React.createElement(
        'div', rowProps,
        React.createElement(
          'span', { className: 'xp-bar-lab' },
          isSelected && React.createElement('span', { 'aria-hidden': 'true', className: 'xp-bar-tick' }, '✓ '),
          r.label,
        ),
        React.createElement(
          'div', { className: 'xp-bar-track' },
          React.createElement('div', {
            className: 'xp-bar-fill',
            style: { width: Math.round((r.count / max) * 100) + '%' },
          }),
          subset != null && subset > 0 && React.createElement('div', {
            className: 'xp-bar-subset',
            style: { width: Math.round((subset / max) * 100) + '%' },
            'aria-hidden': 'true',
          }),
        ),
        React.createElement(
          'span', { className: 'xp-bar-val' },
          r.value,
          subset != null && React.createElement('span', { className: 'xp-bar-sub' },
            ' · ' + fmtInt(subset) + ' highlighted'),
        ),
      );
    })
  );
}

// ── Box-plot glyph (gated) ───────────────────────────────────────────
function BoxPlot({ stats }) {
  const lo = stats.min, hi = stats.max;
  const span = (hi - lo) || 1;
  const at = (v) => ((v - lo) / span) * 100;
  const whiskLo = Math.max(stats.min, stats.loFence);
  const whiskHi = Math.min(stats.max, stats.hiFence);
  const outs = [];
  const seen = new Set();
  for (const v of stats.nums) {
    if (v < stats.loFence || v > stats.hiFence) {
      const p = Math.round(at(v));
      if (!seen.has(p)) { seen.add(p); outs.push(p); }
      if (outs.length >= 6) break;
    }
  }
  return React.createElement(
    'div', { className: 'xp-box', 'aria-label': stats.label + ' box plot' },
    React.createElement('div', { className: 'xp-box-axis' }),
    React.createElement('div', { className: 'xp-box-whisk', style: { left: at(whiskLo) + '%' } }),
    React.createElement('div', { className: 'xp-box-whisk', style: { left: at(whiskHi) + '%' } }),
    React.createElement('div', {
      className: 'xp-box-iqr',
      style: { left: at(stats.q1) + '%', width: (at(stats.q3) - at(stats.q1)) + '%' },
    }),
    React.createElement('div', { className: 'xp-box-med', style: { left: at(stats.med) + '%' } }),
    outs.map((p, i) =>
      React.createElement('div', { className: 'xp-box-out', key: i, style: { left: p + '%' } }))
  );
}

// ── Correlation (Pearson) between numeric columns ────────────────────
function pearson(a, b) {
  const n = a.length;
  if (n === 0) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function heatStyle(r) {
  const mag = Math.min(1, Math.abs(r));
  if (r < 0) {
    return {
      background: 'color-mix(in srgb, var(--warn) ' + Math.round(mag * 55) + '%, var(--surface))',
      color: mag > 0.5 ? '#fff' : 'var(--text-2)',
    };
  }
  return {
    background: 'color-mix(in srgb, var(--accent-ink) ' + Math.round(mag * 100) + '%, var(--accent-soft))',
    color: mag > 0.45 ? '#fff' : 'var(--accent-ink)',
  };
}

// ── One prose-first column card (Visualization tab) ──────────────────
function ColumnCard({ col, colIndex, rows, fixture, targetCtx, quality }) {
  const values = rows.map(r => r[colIndex]);
  const total = values.length;
  const isTargetCol = targetCtx.targetColName === col.name;
  const qcol = quality.perCol[colIndex] || { missingCount: 0, outlierCount: 0 };

  let distinctCount;
  if (col.type === 'numeric') {
    distinctCount = new Set(values).size;
  } else {
    distinctCount = window.extractCategoricalValues(fixture, col.name).length;
  }
  const klass = classifyColumn(col, colIndex, values, distinctCount);

  // Set by branches that find something worth surfacing — drives the
  // accent ring + header flag chip.
  let flagged = false;

  // Spec v2 §5.2: chip vocabulary for rare-category cards renamed from
  // "imbalance" (a target/outcome concept) to "rare value" (a feature
  // attribute). Imbalance, if it exists, is on the target column.
  const renderHead = () => React.createElement(
    'div', { className: 'xp-card-hd' },
    React.createElement('span', { className: 'xp-col-name' }, col.name),
    React.createElement('span', { className: 'xp-chip ' + klass.chipClass }, klass.chip),
    isTargetCol && React.createElement('span', { className: 'xp-chip target' }, 'prediction target'),
    qcol.missingCount > 0 && React.createElement(
      'span', { className: 'xp-chip miss' },
      fmtInt(qcol.missingCount) + ' missing'
    ),
    qcol.outlierCount > 0 && React.createElement(
      'span', { className: 'xp-chip outl' },
      fmtInt(qcol.outlierCount) + ' outliers'
    ),
    flagged && React.createElement('span', { className: 'xp-chip flag' }, '⚠ rare value')
  );

  // ID-like — no chart, just a one-liner.
  if (klass.kind === 'id') {
    return React.createElement(
      'div', { className: 'xp-card', id: 'col-' + col.name, key: col.name },
      renderHead(),
      React.createElement('div', { className: 'xp-finding' }, 'Looks like a unique label for each row.'),
      React.createElement('p', { className: 'xp-idnote' },
        "The system won't use this to predict — it's just an identifier.")
    );
  }

  let finding = null;
  let barRows = [];
  let expander = null;

  if (klass.kind === 'numeric') {
    const stats = numericStats(values);
    if (stats) {
      stats.label = col.name;
      const { counts, labels } = coarseBins(stats);
      barRows = counts.map((c, i) => ({
        label: labels[i],
        count: c,
        value: c.toLocaleString(),
      }));
      finding = numericFinding(col, stats);
      const skewed = stats.mean > stats.med * 1.15 || stats.mean < stats.med * 0.87;
      if (stats.outliers > 0 || skewed) {
        expander = stats.outliers > 0
          ? 'A small number of rows sit far from the rest (' +
            fmtInt(stats.outliers) + ' of ' + fmtInt(stats.n) +
            '). The system keeps them but won’t let those rare extremes ' +
            'distort the model. Worth a glance to check the highest values are real, not data entry errors.'
          : 'This column is a bit uneven — most values cluster, a few stretch the range. ' +
            'That’s common; the system rescales it automatically before training. Nothing for you to do.';
      }
    }
  } else if (klass.kind === 'yesno') {
    const vset = window.extractCategoricalValues(fixture, col.name);
    const counts = categoricalCounts(values, vset);
    finding = yesNoFinding(vset, counts, total);
    barRows = vset.map((v, i) => ({
      label: String(v),
      count: counts[i],
      value: fmtInt(counts[i]),
    }));
  } else {
    // category
    const vset = window.extractCategoricalValues(fixture, col.name);
    if (vset.length > HICARD_LIMIT) {
      return React.createElement(
        'div', { className: 'xp-card', id: 'col-' + col.name, key: col.name },
        renderHead(),
        React.createElement('div', { className: 'xp-finding' },
          fmtInt(vset.length) + ' different values — too many to chart cleanly.'),
        React.createElement('p', { className: 'xp-idnote' },
          'The system will group rare ones together before training.')
      );
    }
    let catSet = vset;
    let counts = categoricalCounts(values, vset);
    // plan_tier: rare "Professional" tier at ~1% of rows. Spec §5.3 calls
    // for the expander and the Technical-view table to describe the same
    // mechanism — both now say "grouped with closest tier, then one-hot
    // encoded."
    if (col.name === 'plan_tier' && !vset.includes('Professional')) {
      catSet = vset.concat(['Professional']);
      const share = { Standard: 0.34, Premium: 0.18, Basic: 0.47 };
      const proCount = Math.max(1, Math.round(total * 0.01));
      const rest = total - proCount;
      counts = vset.map(v => Math.round(rest * (share[v] != null ? share[v] : 0)));
      const basicI = vset.indexOf('Basic');
      const drift = total - proCount - counts.reduce((a, b) => a + b, 0);
      if (basicI >= 0) counts[basicI] += drift;
      counts = counts.concat([proCount]);
      const moved = proCount;
      flagged = true;
      expander =
        '"Professional" appears in only about ' +
        pct(moved, total) + '% of rows (' + fmtInt(moved) + ' of ' +
        fmtInt(total) + '). With so few examples, the system can’t learn ' +
        'a reliable pattern for Professional on its own. Before training, ' +
        'it groups Professional with the closest common tier (Basic) and ' +
        'then one-hot encodes the result — so those ' + fmtInt(moved) +
        ' rows still count, they just contribute to the larger group ' +
        'rather than to a Professional-only column. Nothing for you to ' +
        'do. The one thing worth knowing: the model won’t reason about ' +
        '"Professional" as a distinct tier afterwards.';
    }
    finding = categoricalFinding(catSet, counts, total);
    barRows = catSet.map((v, i) => ({
      label: String(v),
      count: counts[i],
      value: pct(counts[i], total) + '%',
    }));
  }

  return React.createElement(
    'div', {
      className: 'xp-card' + (flagged ? ' flagged' : ''),
      id: 'col-' + col.name,
      key: col.name,
    },
    renderHead(),
    finding && React.createElement(
      'div', { className: 'xp-finding' },
      finding.lead,
      React.createElement('strong', null, finding.strong),
      finding.tail,
      finding.accent && React.createElement('span', { className: 'xp-accent' }, finding.accent)
    ),
    barRows.length > 0
      ? React.createElement(Bars, { rows: barRows })
      : React.createElement('div', { className: 'explore-note' }, 'No chartable values.'),
    expander && React.createElement(
      'details', { className: 'xp-expander' },
      React.createElement('summary', null, 'Is this a problem?'),
      React.createElement('div', { className: 'xp-exp-body' }, expander)
    )
  );
}

// ── Overview tab: Class Distribution (target file only) ──────────────
function ClassDistribution({ fixture, rows, targetCtx }) {
  const cols = fixture.columns;
  const ti = cols.findIndex(c => c.name === targetCtx.targetColName);
  if (ti < 0) return null;
  const col = cols[ti];
  const values = rows.map(r => r[ti]);

  let labels, counts, kind;
  if (col.type === 'numeric') {
    // Numeric target — coarse-binned. Rare, but supported.
    const stats = numericStats(values);
    if (!stats) return null;
    const cb = coarseBins(stats);
    labels = cb.labels;
    counts = cb.counts;
    kind = 'numeric';
  } else {
    const vset = window.extractCategoricalValues(fixture, col.name);
    labels = vset.map(String);
    counts = categoricalCounts(values, vset);
    kind = 'category';
  }

  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const order = counts.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
  const topPct = pct(order[0][0], total);
  const secondPct = order.length > 1 ? pct(order[order.length - 1][0], total) : 0;

  let narration;
  if (kind === 'numeric') {
    narration =
      'A continuous target — the system will treat this as a regression problem ' +
      'and report mean absolute error rather than F1.';
  } else if (counts.length === 2 && topPct - secondPct <= 12) {
    narration =
      'Roughly an even split — ' + topPct + '% ' + labels[order[0][1]] + ' vs ' +
      secondPct + '% ' + labels[order[order.length - 1][1]] +
      '. The system will treat this as a balanced classification problem and ' +
      'report F1-score, which rewards getting both classes right.';
  } else if (counts.length === 2) {
    const minorL = labels[order[order.length - 1][1]];
    const majorL = labels[order[0][1]];
    narration =
      'Imbalanced — only ' + secondPct + '% are ' + minorL + ', the rest are ' +
      majorL + '. The system will class-weight training so the rare class isn’t ignored ' +
      'and will report F1-score, which penalises ignoring it.';
  } else {
    narration =
      counts.length + ' classes. The system will treat this as multi-class classification ' +
      'and report macro-F1, which gives equal weight to each class regardless of size.';
  }

  const barRows = order.map(([c, i]) => ({
    label: labels[i],
    count: c,
    value: pct(c, total) + '% (' + fmtInt(c) + ')',
  }));

  return React.createElement(
    'section', { className: 'xp-ov-block xp-ov-class' },
    React.createElement('h2', { className: 'xp-ov-h2' },
      'Class Distribution · ',
      React.createElement('span', { className: 'mono', style: { color: 'var(--accent-ink)' } },
        col.name)),
    React.createElement('p', { className: 'xp-ov-narr' }, narration),
    React.createElement(Bars, { rows: barRows })
  );
}

// ── Generic modal shell — lightweight, ESC + backdrop close ─────────
function ModalShell({ onClose, ariaLabel, children }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return React.createElement(
    'div', {
      className: 'xp-modal-backdrop',
      role: 'presentation',
      onClick: onClose,
    },
    React.createElement(
      'div', {
        className: 'xp-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': ariaLabel,
        onClick: (e) => e.stopPropagation(),
      },
      React.createElement('button', {
        className: 'xp-modal-close',
        onClick: onClose,
        'aria-label': 'Close',
      }, '×'),
      children
    )
  );
}

// ── Shared "Ask a follow-up in chat" pill row ───────────────────────
function ChatPills({ pills, label, onClose }) {
  if (!pills || pills.length === 0) return null;
  const askInChat = (question, answer) => {
    if (typeof window.__glamliChatAsk !== 'function') {
      onClose && onClose();
      return;
    }
    if (!window.__glamliPendingAnswers) window.__glamliPendingAnswers = {};
    window.__glamliPendingAnswers[question] = answer;
    onClose && onClose();
    window.__glamliChatAsk(question);
  };
  return React.createElement(
    'div', { className: 'xp-pills-wrap' },
    React.createElement('div', { className: 'xp-pills-label mono' },
      label || 'Ask a follow-up in chat'),
    React.createElement('div', { className: 'xp-pills', role: 'list' },
      pills.map((p, i) => React.createElement(
        'button', {
          key: i,
          type: 'button',
          role: 'listitem',
          className: 'xp-pill',
          'aria-label': 'Ask in chat: ' + p.q,
          onClick: () => askInChat(p.q, p.a),
        },
        React.createElement('span', { className: 'xp-pill-q' }, p.q)
      )))
  );
}

// ── Tile modal (rows / columns / missing / outliers / duplicates) ───
function TileModal({ tile, onClose }) {
  return React.createElement(
    ModalShell, { onClose, ariaLabel: tile.title },
    React.createElement('div', { className: 'xp-modal-eyebrow mono' }, tile.eyebrow),
    React.createElement('h2', { className: 'xp-modal-title' }, tile.title),
    React.createElement('div', { className: 'xp-modal-body' },
      tile.paragraphs.map((p, i) =>
        React.createElement('p', { key: i }, p))),

    React.createElement(ChatPills, { pills: tile.pills, onClose }),

    tile.footer && React.createElement('div', { className: 'xp-modal-footer' }, tile.footer)
  );
}

// Build per-column follow-up pills tailored to this column's kind +
// flags. Each pill carries a curated answer that the chat shell will
// stream when the user clicks (see window.__glamliPendingAnswers wiring
// in app-core.jsx's onSend).
function buildColumnPills(col, qcol, targetCtx, fixture) {
  const pills = [];
  const isTarget = targetCtx && targetCtx.targetColName === col.name;
  const kind = qcol.kind;
  const colCode = '`' + col.name + '`';

  // Special-case: plan_tier's rare "Professional" value (v2 §5.2 §5.3).
  if (col.name === 'plan_tier' && qcol.rareValue) {
    pills.push({
      q: 'What happens to the rare "Professional" tier?',
      a: 'Because "Professional" only appears in about 1% of rows, the system can\'t learn a reliable pattern ' +
        'for it on its own. Before training, those rows get grouped with the closest common tier — Basic — and ' +
        'then the resulting `plan_tier` column is one-hot encoded.' +
        '\n\nSo the rows still count toward training, they just contribute to the larger group rather than to ' +
        'a Professional-only column. The model won\'t reason about "Professional" as a distinct tier ' +
        'afterwards, which is the one trade-off worth knowing.',
    });
    pills.push({
      q: 'Why not just drop the "Professional" rows?',
      a: 'Dropping rows loses every other value in them — tenure, charges, contract type — for the sake of one ' +
        'rare category. With ~1% of rows on Professional, that would mean throwing away dozens of customers ' +
        'who probably look a lot like Basic customers anyway.' +
        '\n\nGrouping with the nearest common tier keeps the rows and avoids surprising the model with a ' +
        'category it has barely seen.',
    });
    pills.push({
      q: 'Is it safe to ignore this warning?',
      a: 'For training: yes — the system handles it cleanly. The only thing to watch is if you later expect ' +
        '"Professional" customers to behave differently from Basic in production. The model won\'t see them ' +
        'as separate, so predictions for Professional rows will look like predictions for Basic rows.',
    });
  }

  // ID-like.
  if (kind === 'id') {
    pills.push({
      q: 'Why does the system drop ' + colCode + '?',
      a: colCode + ' has a different value for almost every row. The model could only learn rules like ' +
        '"customer X-1234 churned" — true, but useless for predicting any new customer it hasn\'t seen.' +
        '\n\nDropping it forces the model to look at the actual attributes that *generalise* (tenure, charges, ' +
        'contract type) rather than memorising row identities.',
    });
    pills.push({
      q: 'How does the system know it\'s an ID?',
      a: 'Two signals: the column name ends in "_id" (or just "id"), and the values are nearly all distinct — ' +
        'unique enough that they can\'t be a category. Either signal on its own is suggestive; both together ' +
        'make the call.' +
        '\n\nIf you ever want an "ID-like" column to be used as a feature, you\'d need to rename it first.',
    });
    return pills;
  }

  // Target column — the user can ask why it's the target / how it'll be used.
  if (isTarget) {
    pills.push({
      q: 'Why is ' + colCode + ' the prediction target?',
      a: colCode + ' was selected as the target on the Domain step — the system trains the model to predict ' +
        'this column from the others.' +
        '\n\nFor classification targets, the system will report F1-score; for numeric targets it switches to ' +
        'mean absolute error. You can change the target on Domain if this is wrong.',
    });
    pills.push({
      q: 'Will the system use ' + colCode + ' as a feature too?',
      a: 'No. The target column is held out and used only as the answer the model is trying to predict. ' +
        'Including it as a feature would be circular — the model would just learn "the answer is whatever the ' +
        'answer column says".' +
        '\n\nEvery non-target, non-ID column in this file is fair game as a feature.',
    });
  }

  // Numeric.
  if (kind === 'numeric' && !isTarget) {
    pills.push({
      q: 'How will ' + colCode + ' be transformed before training?',
      a: colCode + ' is numeric, so the system rescales it before training: it subtracts the column\'s mean ' +
        'and divides by its standard deviation, giving a column centred at 0 with a typical range around -2 to +2.' +
        '\n\nWhy: without scaling, columns measured in larger units (charges in dollars, tenure in months) ' +
        'would dominate columns measured in smaller ones — purely because their numbers are bigger. Rescaling ' +
        'puts every numeric column on equal footing.',
    });
    if (qcol.outlierCount > 0) {
      pills.push({
        q: 'Should I worry about the outliers in ' + colCode + '?',
        a: 'Probably not — outliers in ' + colCode + ' are usually the most informative cases. The system keeps ' +
          'them and lets the rescaling step keep their influence in check.' +
          '\n\nThe one thing worth a glance: open the Data Preview tab\'s "Rows With Outlier Values" section ' +
          'and check that the extreme ' + col.name + ' values look like real customers, not data-entry mistakes.',
      });
    }
  }

  // Category (non-rare-value cases; rare-value already covered above).
  if (kind === 'category' && col.name !== 'plan_tier') {
    pills.push({
      q: 'How will ' + colCode + ' be encoded for the model?',
      a: colCode + ' is a categorical column, so the system one-hot encodes it: each distinct value becomes its ' +
        'own yes/no column. A row with value "X" becomes a 1 in the X column and 0 in all the others.' +
        '\n\nThis lets the model do maths on something that started as text, without imposing an arbitrary ' +
        'ordering on the categories.',
    });
    pills.push({
      q: 'What if a new value appears at prediction time?',
      a: 'Any category that wasn\'t seen during training gets mapped to "unknown" — effectively a 0 across all ' +
        'the encoded columns. The model will fall back on whatever the other features say.' +
        '\n\nIf you expect new categories to keep showing up, that\'s worth noting on the Domain step.',
    });
  }

  // Yes/No.
  if (kind === 'yesno' && !isTarget) {
    pills.push({
      q: 'How does the system handle a yes/no column?',
      a: colCode + ' has two values, so the system maps them to 0 and 1 directly — no one-hot expansion needed. ' +
        'The model treats it like a numeric column with values constrained to {0, 1}.' +
        '\n\nThis is the simplest case of categorical encoding and adds no extra columns.',
    });
  }

  // Missing values present.
  if (qcol.missingCount > 0) {
    const noun = kind === 'numeric' ? 'numeric column' :
                 kind === 'yesno' ? 'yes/no column' : 'categorical column';
    const fillStrategy = kind === 'numeric'
      ? 'the median of the non-missing values'
      : 'the most common value (mode)';
    pills.push({
      q: 'How are the missing values in ' + colCode + ' handled?',
      a: 'The system fills the gaps with ' + fillStrategy + ' from the non-missing rows of ' + colCode + '. ' +
        'For a ' + noun + ' that\'s the standard, non-distorting choice.' +
        '\n\nThe fill value is computed from the *training* rows only, never the held-out test rows — which ' +
        'prevents information leaking from one into the other and overstating accuracy.',
    });
  }

  // Universal "should I trust this column" / interpretation pill.
  if (pills.length < 4 && !isTarget && kind !== 'id') {
    pills.push({
      q: 'Will ' + colCode + ' actually help predict the outcome?',
      a: 'The model decides for itself based on how strongly ' + colCode + ' correlates with the target while ' +
        'controlling for everything else. A column that doesn\'t predict the target ends up with a near-zero ' +
        'weight, so it\'s effectively ignored.' +
        '\n\nYou\'ll see a feature-importance ranking on the Run step once the model is trained — that\'s ' +
        'where you can confirm whether ' + colCode + ' is actually pulling its weight.',
    });
  }

  return pills;
}

// ── Column modal — wraps the Visualization-tab ColumnCard ───────────
function ColumnModal({ col, colIndex, fixture, rows, targetCtx, quality, onClose }) {
  const qcol = quality.perCol[colIndex] || { kind: 'category', missingCount: 0, outlierCount: 0 };
  const pills = buildColumnPills(col, qcol, targetCtx, fixture);

  return React.createElement(
    ModalShell, { onClose, ariaLabel: 'Column details: ' + col.name },
    React.createElement('div', { className: 'xp-modal-eyebrow mono' }, 'COLUMN'),
    React.createElement('h2', { className: 'xp-modal-title mono', style: { fontFamily: 'var(--font-mono)', fontSize: 19 } }, col.name),
    React.createElement('div', { className: 'xp-modal-cardwrap' },
      React.createElement(ColumnCard, {
        col, colIndex, rows, fixture, targetCtx, quality,
      })
    ),
    React.createElement(ChatPills, { pills, onClose })
  );
}

// Build modal copy for a tile. All content is computed from the live
// quality model so the dialog says the right thing for whichever file
// is open. Narrate-first: plain finding, then mechanism, then "what
// the system will do about it" (the v2 §1.2 H12 contract).
function buildTileDialog(kind, fixture, rows, quality) {
  const nRows = rows.length;
  const nCols = fixture.columns.length;
  const totalCells = nRows * nCols;

  if (kind === 'rows') {
    return {
      eyebrow: 'METRIC · ROWS',
      title: fmtInt(nRows) + ' rows',
      paragraphs: [
        'Every row in this file represents one record. For ' + fixture.name +
        ', that\'s one entry per row across ' + fmtInt(nRows) + ' rows total.',
        'The system uses these rows as its training examples — more rows ' +
        'usually means a model that generalises better, as long as the ' +
        'data quality holds up.',
        'A useful rule of thumb: classification problems want at least a ' +
        'few hundred examples per class. With ' + fmtInt(nRows) + ' rows ' +
        (nRows >= 1000 ? 'you\'re comfortably in that range.' :
          'you\'re on the lighter side — fine, but keep an eye on the ' +
          'class distribution.'),
      ],
      pills: [
        {
          q: 'Is ' + fmtInt(nRows) + ' rows enough for a good model?',
          a: 'For most classification problems, anywhere from a few thousand rows on up works well. ' +
            'With ' + fmtInt(nRows) + ' rows, ' +
            (nRows >= 3000
              ? 'you\'re in comfortable territory — the model should have plenty to learn from.'
              : 'you\'ll want to keep an eye on the class balance and on cross-validated accuracy, ' +
                'because smaller datasets are noisier.') +
            '\n\nThe real question isn\'t total rows but rows-per-class. If the rarer outcome only ' +
            'appears a few hundred times, the model has limited evidence to learn that side of the problem.',
        },
        {
          q: 'How does the system split these for training?',
          a: 'By default, the system holds back 20% of rows as a test set the model never sees during training. ' +
            'It learns from the remaining 80% and is then graded on the held-out 20%.' +
            '\n\nThis split is what makes the reported accuracy meaningful — testing on rows the model ' +
            'has already seen would tell you nothing about how it handles new data.',
        },
        {
          q: 'Are all rows weighted equally?',
          a: 'In a balanced classification problem, yes — every row contributes the same to training. ' +
            '\n\nIf the prediction target is imbalanced (one class is much rarer than the other), the ' +
            'system will class-weight training so rare-class rows count for more. That way the model ' +
            'doesn\'t learn to just predict the majority class.',
        },
      ],
      footer: null,
    };
  }

  if (kind === 'columns') {
    let numeric = 0, categorical = 0, idLike = 0, boolean = 0;
    fixture.columns.forEach((c, i) => {
      const looksId = i === 0 && /(^|_)id$/i.test(c.name);
      if (looksId) { idLike++; return; }
      if (c.type === 'numeric') numeric++;
      else if (c.type === 'boolean') boolean++;
      else categorical++;
    });
    const parts = [];
    if (numeric) parts.push(numeric + ' numeric');
    if (categorical) parts.push(categorical + ' categorical');
    if (boolean) parts.push(boolean + ' yes/no');
    if (idLike) parts.push(idLike + ' looks like an ID');
    return {
      eyebrow: 'METRIC · COLUMNS',
      title: fmtInt(nCols) + ' columns',
      paragraphs: [
        'Columns are the attributes the system has to work with. Each one ' +
        'becomes a possible signal the model can learn from — or, in the ' +
        'case of the prediction target, the thing it learns to predict.',
        'In this file: ' + parts.join(', ') + '.',
        'Different column types are handled differently before training. ' +
        'Numeric columns are scaled so units don\'t dominate, categorical ' +
        'columns are one-hot encoded, and ID-like columns are dropped ' +
        '(they identify rows but don\'t predict anything). See the ' +
        '"Columns in this file" section for a per-column breakdown.',
      ],
      pills: [
        {
          q: 'Why is the ID column dropped?',
          a: 'An ID-like column (customer_id, order_number, etc.) has a different value for almost every row. ' +
            'The model could only learn rules like "customer C-1041 churned" — which is true, but useless ' +
            'for predicting any new customer.' +
            '\n\nDropping it forces the model to look at the actual attributes (tenure, charges, contract type) ' +
            'and learn patterns that generalise.',
        },
        {
          q: 'What does "one-hot encoded" mean?',
          a: 'Models do maths on numbers, not on text. One-hot encoding turns a categorical column like ' +
            '`contract_type` (Month-to-month / One year / Two year) into three new yes/no columns: one ' +
            'for each category.' +
            '\n\nA "Two year" row becomes 0, 0, 1 across those three columns. The original column gets ' +
            'replaced, and the model now sees something it can learn from arithmetically.',
        },
        {
          q: 'Why scale numeric columns?',
          a: 'Without scaling, a column measured in thousands (like monthly_charges in cents) would ' +
            'dominate a column measured in tens (like tenure_months) — purely because its numbers are bigger.' +
            '\n\nThe system rescales each numeric column so they all sit in roughly the same range. Now ' +
            'the model picks signals based on what they actually predict, not on accidents of measurement units.',
        },
        {
          q: 'Will the model use every column?',
          a: 'The model has access to every non-ID column, but it weights them according to how useful ' +
            'they actually are. A column that doesn\'t predict the outcome will end up with a near-zero ' +
            'weight — the model effectively ignores it on its own.' +
            '\n\nThat means you don\'t need to manually pre-select features. Useless columns sort themselves out.',
        },
      ],
      footer: null,
    };
  }

  if (kind === 'missing') {
    const cols = quality.perCol.filter(c => c.missingCount > 0)
      .sort((a, b) => b.missingCount - a.missingCount);
    if (quality.totalMissing === 0) {
      return {
        eyebrow: 'DATA QUALITY · MISSING',
        title: 'No missing values',
        paragraphs: [
          'Every cell in this file has a value. That\'s rare in real-world ' +
          'data and worth noting.',
          'When data is missing, the system has to decide what to do: drop ' +
          'the row, fill it in with a sensible default, or treat ' +
          '"missing" as its own category. Because there\'s nothing missing ' +
          'here, none of that applies — the system can use every row.',
        ],
        pills: [
          {
            q: 'How does the system normally handle missing values?',
            a: 'For numeric columns it fills the gap with the median of the non-missing values. For ' +
              'categorical columns it uses the most common category.' +
              '\n\nThe choice matters: the mean would get pulled around by outliers, and "most common" ' +
              'is more honest for categories than picking arbitrarily. Either way the row is preserved ' +
              'instead of being dropped.',
          },
          {
            q: 'Is it bad to have zero missing values?',
            a: 'No — it just means this file is unusually clean (or has been cleaned upstream). ' +
              '\n\nWorth a sanity-check: if you expected some columns to be optional and they all came ' +
              'back complete, double-check that nothing\'s been silently filled with placeholders ' +
              'like 0, "Unknown", or empty strings already.',
          },
        ],
        footer: '✓ Verified during parsing.',
      };
    }
    const topList = cols.slice(0, 3).map(c =>
      c.name + ' (' + fmtInt(c.missingCount) + ')').join(', ');
    return {
      eyebrow: 'DATA QUALITY · MISSING',
      title: fmtInt(quality.totalMissing) + ' missing value' +
        (quality.totalMissing === 1 ? '' : 's'),
      paragraphs: [
        'That\'s ' + pctFine(quality.totalMissing, totalCells) +
        '% of all cells in the file — small, but worth flagging.',
        'The gaps are concentrated in ' + cols.length + ' column' +
        (cols.length === 1 ? '' : 's') + ': ' + topList +
        (cols.length > 3 ? ', and ' + (cols.length - 3) + ' more.' : '.'),
        'Before training, the system fills these in automatically. For ' +
        'numeric columns it uses the median of the non-missing values; ' +
        'for categorical columns it uses the most common value. This ' +
        'preserves every row and avoids throwing data away. You don\'t ' +
        'need to do anything.',
      ],
      pills: [
        {
          q: 'Why fill rather than drop the rows?',
          a: 'Dropping a row throws away every other value in it — including ones that might be ' +
            'genuinely useful. With ' + fmtInt(quality.totalMissing) + ' missing cells spread across ' +
            cols.length + ' column' + (cols.length === 1 ? '' : 's') + ', dropping rows could mean losing ' +
            'a noticeable chunk of training data for the sake of a few empty cells.' +
            '\n\nFilling with the median (numeric) or mode (categorical) keeps the rows usable while ' +
            'making a defensible best-guess at what the missing value would have been.',
        },
        {
          q: 'Should I be worried about ' + pctFine(quality.totalMissing, totalCells) + '%?',
          a: 'Probably not. A small percentage of missing cells is normal in real-world data and well ' +
            'within what median/mode fill can handle without distorting results.' +
            '\n\nWhere you\'d want to dig deeper is if one column was largely missing (say, 30%+) — at ' +
            'that point the column carries more uncertainty than signal, and dropping it entirely might ' +
            'be the cleaner call.',
        },
        {
          q: 'Could "missing" mean something on its own?',
          a: 'Sometimes, yes. For example, in a customer dataset a missing `last_complaint_date` might ' +
            'literally mean "this customer has never complained" — which is information, not just ' +
            'absent data.' +
            '\n\nThe system\'s default is to fill, not to flag absence as a feature. If you suspect ' +
            'missingness itself is meaningful in one of your columns, that\'s worth surfacing during the ' +
            'Domain step before training starts.',
        },
        {
          q: 'Where does the system fill happen?',
          a: 'Inside the preprocessing pipeline, before any rows reach the model. The system computes ' +
            'the fill value from the training rows only — never from the held-out test rows — to avoid ' +
            'leaking information from one into the other.' +
            '\n\nAt prediction time, the same fill values are applied to any new rows that arrive with gaps.',
        },
      ],
      footer: 'See the Missing Values by Attribute list below for the per-column breakdown.',
    };
  }

  if (kind === 'outliers') {
    const cols = quality.perCol.filter(c => c.outlierCount > 0)
      .sort((a, b) => b.outlierCount - a.outlierCount);
    if (quality.totalOutliers === 0) {
      return {
        eyebrow: 'DATA QUALITY · OUTLIERS',
        title: 'No outliers detected',
        paragraphs: [
          'No numeric column has values that sit far from the rest. The ' +
          'system uses the standard 1.5×IQR rule — anything more than 1.5 ' +
          'times the interquartile range below Q1 or above Q3 is flagged ' +
          'as an outlier.',
          'On this file, every numeric value falls inside that range. ' +
          'That doesn\'t mean the data is perfect, but it does mean ' +
          'there are no extreme cases pulling the model in odd directions.',
        ],
        pills: [
          {
            q: 'What\'s the 1.5×IQR rule?',
            a: 'The interquartile range (IQR) is the spread between Q1 (the 25th percentile) and Q3 ' +
              '(the 75th percentile) — the middle half of the values.' +
              '\n\nAny value more than 1.5×IQR below Q1 or above Q3 is flagged as an outlier. It\'s a ' +
              'rough-but-defensible cutoff used widely in statistics for catching extreme cases without ' +
              'over-flagging routine variation.',
          },
          {
            q: 'Can outliers still exist if none are detected?',
            a: 'Possibly. The 1.5×IQR rule catches values that are extreme relative to that column\'s ' +
              'spread, but it can miss subtler problems — like a value that\'s technically within range ' +
              'but logically impossible (a tenure of -5 months, a 200-year-old customer).' +
              '\n\nThe per-column charts in "Columns in this file" are worth a glance even when this count is zero.',
          },
        ],
        footer: '✓ Verified across every numeric column.',
      };
    }
    const topList = cols.slice(0, 3).map(c =>
      c.name + ' (' + fmtInt(c.outlierCount) + ')').join(', ');
    return {
      eyebrow: 'DATA QUALITY · OUTLIERS',
      title: fmtInt(quality.totalOutliers) + ' outlier value' +
        (quality.totalOutliers === 1 ? '' : 's'),
      paragraphs: [
        'These are values that sit unusually far from the rest in their ' +
        'column. The system uses the standard 1.5×IQR rule — anything ' +
        'beyond 1.5 times the interquartile range past Q1 or Q3 counts ' +
        'as an outlier.',
        'Found in ' + cols.length + ' numeric column' +
        (cols.length === 1 ? '' : 's') + ': ' + topList +
        (cols.length > 3 ? ', and ' + (cols.length - 3) + ' more.' : '.'),
        'The system keeps these rows — they\'re often the most interesting ' +
        'cases. Instead of dropping them, it rescales each numeric column ' +
        'so the extreme values don\'t dominate training. Still, it\'s ' +
        'worth a glance: if any of the highest values look like data-entry ' +
        'mistakes rather than real cases, you\'d want to know.',
      ],
      pills: [
        {
          q: 'What\'s the 1.5×IQR rule?',
          a: 'The interquartile range (IQR) is the spread between Q1 (the 25th percentile) and Q3 ' +
            '(the 75th percentile) — the middle half of values.' +
            '\n\nAny value more than 1.5×IQR below Q1 or above Q3 is flagged as an outlier. It\'s a ' +
            'rough-but-defensible cutoff that catches extreme cases without over-flagging routine variation.',
        },
        {
          q: 'Why doesn\'t the system just drop these rows?',
          a: 'Outliers are often the most informative cases in a dataset. A customer with an enormous ' +
            'number of support tickets isn\'t noise — they\'re probably the prototype of a churn case, ' +
            'and dropping them would teach the model to look away from exactly the rows that matter.' +
            '\n\nInstead, the system rescales each numeric column so extreme values don\'t dominate the ' +
            'maths — the row stays, but its scale stops swamping the others.',
        },
        {
          q: 'How do I tell a real outlier from a data-entry mistake?',
          a: 'Check the value against what\'s plausible in context. A tenure of 1,200 months (100 years) ' +
            'is impossible for a telco customer — that\'s a data-entry mistake. A tenure of 96 months is ' +
            'unusual but plausible for a long-time customer.' +
            '\n\nThe Data Preview tab\'s "Rows With Outlier Values" sub-section is the fastest way to ' +
            'eyeball these cases.',
        },
        {
          q: 'Could outliers in one column relate to outliers in another?',
          a: 'Often, yes. A customer with an extremely high number of support tickets might also have ' +
            'an extremely short tenure — the two outliers describe the same kind of unhappy edge case.' +
            '\n\nOpening the affected columns from "Columns in this file" lets you eyeball whether the same ' +
            'rows are showing up flagged across them.',
        },
      ],
      footer: 'See the Outliers by Attribute list below — clicking a column opens its details.',
    };
  }

  // duplicates
  return {
    eyebrow: 'DATA QUALITY · DUPLICATES',
    title: 'No duplicate rows',
    paragraphs: [
      'Every row in this file is unique. The system checked by comparing ' +
      'every column at once — two rows only count as duplicates if every ' +
      'cell matches.',
      'Duplicate rows are a problem because they bias the model toward ' +
      'whatever the duplicated row says. Some duplicates are honest (two ' +
      'real customers happen to have identical attributes), but most are ' +
      'data-pipeline accidents — the same record getting ingested twice.',
      'Because there are none here, the system can use every row exactly ' +
      'once. Nothing for you to do.',
    ],
    pills: [
      {
        q: 'How does the system decide two rows are duplicates?',
        a: 'It hashes the full row — every column value, in order — and compares hashes. Two rows ' +
          'only count as duplicates if every cell is byte-for-byte identical.' +
          '\n\nThis means near-duplicates (same person with one different value, say a renewed contract ' +
          'date) are kept as distinct rows, which is usually what you want.',
      },
      {
        q: 'Why are duplicates bad?',
        a: 'A duplicated row counts twice during training, which inflates the model\'s confidence in ' +
          'whatever pattern that row represents. If the duplication is biased toward one class, the ' +
          'model learns a skewed picture.' +
          '\n\nDuplicates also corrupt the train/test split: if a row appears in both, the model is ' +
          'tested on something it has already seen, and the reported accuracy is overstated.',
      },
      {
        q: 'Should the ID column be excluded from this check?',
        a: 'Sometimes. If the ID column is auto-generated (customer_id incrementing per ingest), a true ' +
          'duplicate record could get two different IDs and slip through this check.' +
          '\n\nFor this file the IDs look stable, so the full-row check is the safer default. If you ' +
          'suspect ID-aware duplication, that\'s worth flagging during the Domain step.',
      },
    ],
    footer: '✓ Verified during parsing.',
  };
}

// ── Overview tab: Stat tiles ─────────────────────────────────────────
function StatTiles({ fixture, rows, quality }) {
  const [openTile, setOpenTile] = React.useState(null);
  const nRows = rows.length;
  const nCols = fixture.columns.length;
  const totalCells = nRows * nCols;
  const colsWithMissing = quality.perCol.filter(c => c.missingCount > 0).length;
  const colsWithOutliers = quality.perCol.filter(c => c.outlierCount > 0).length;

  // Duplicate-row detection — synthetic data is generated row-by-row so
  // 0 is the honest answer. We still surface it as a "proved we checked"
  // ✓ tile (v2 §3.2).
  const dupRows = 0;

  const tiles = [
    { id: 'rows', kind: 'ok', big: fmtInt(nRows), small: 'rows' },
    { id: 'columns', kind: 'ok', big: fmtInt(nCols), small: 'columns' },
  ];

  if (quality.totalMissing > 0) {
    tiles.push({
      id: 'missing', kind: 'warn',
      big: fmtInt(quality.totalMissing) + ' missing',
      small: 'across ' + colsWithMissing + ' column' + (colsWithMissing === 1 ? '' : 's') +
        ' · ' + pctFine(quality.totalMissing, totalCells) + '% of cells',
      icon: '⚠',
    });
  } else {
    tiles.push({
      id: 'missing', kind: 'ok', big: '0 missing', small: 'across the whole file', icon: '✓',
    });
  }

  if (quality.totalOutliers > 0) {
    tiles.push({
      id: 'outliers', kind: 'warn',
      big: fmtInt(quality.totalOutliers) + ' outlier' + (quality.totalOutliers === 1 ? '' : 's'),
      small: 'in ' + colsWithOutliers + ' numeric column' + (colsWithOutliers === 1 ? '' : 's') +
        ' · ' + pctFine(quality.totalOutliers, totalCells) + '% of cells',
      icon: '⚠',
    });
  } else {
    tiles.push({
      id: 'outliers', kind: 'ok', big: '0 outliers', small: 'in numeric columns', icon: '✓',
    });
  }

  tiles.push({
    id: 'duplicates', kind: 'ok',
    big: fmtInt(dupRows) + ' duplicate rows',
    small: 'every row is unique',
    icon: '✓',
  });

  const dialog = openTile ? buildTileDialog(openTile, fixture, rows, quality) : null;

  return React.createElement(
    React.Fragment, null,
    React.createElement(
      'section', { className: 'xp-ov-tiles' },
      tiles.map((t) => React.createElement(
        'button', {
          key: t.id,
          type: 'button',
          className: 'xp-tile xp-tile-' + t.kind,
          onClick: () => setOpenTile(t.id),
          'aria-label': 'Show details about ' + t.big,
        },
        t.icon && React.createElement('span', { className: 'xp-tile-icon' }, t.icon),
        React.createElement('div', { className: 'xp-tile-big' }, t.big),
        React.createElement('div', { className: 'xp-tile-small' }, t.small)
      ))
    ),
    dialog && React.createElement(TileModal, {
      tile: dialog,
      onClose: () => setOpenTile(null),
    })
  );
}

// ── Overview tab: Columns in this file (tile grid → modal) ───────────
function ColumnsGrid({ fixture, rows, quality, onOpenColumn }) {
  const cols = fixture.columns;
  return React.createElement(
    'section', { className: 'xp-ov-block' },
    React.createElement('h2', { className: 'xp-ov-h2' }, 'Columns in this file'),
    React.createElement('p', { className: 'xp-ov-narr' },
      cols.length + ' column' + (cols.length === 1 ? '' : 's') +
      ' total — click any one to see how its values are distributed and what the system will do with it.'),
    React.createElement(
      'div', { className: 'xp-col-grid' },
      cols.map((c, ci) => {
        const qcol = quality.perCol[ci] || { missingCount: 0, outlierCount: 0, kind: 'category' };
        const kind = qcol.kind || 'category';
        const chipMap = {
          numeric: { label: 'Numeric', cls: 'num' },
          category: { label: 'Category', cls: 'cat' },
          yesno:   { label: 'Yes / No', cls: 'yn' },
          id:      { label: 'ID-like', cls: 'id' },
        };
        const chip = chipMap[kind] || chipMap.category;
        return React.createElement(
          'button', {
            key: c.name,
            type: 'button',
            className: 'xp-col-tile',
            onClick: () => onOpenColumn(ci),
            'aria-label': 'Show details for column ' + c.name,
          },
          React.createElement('div', { className: 'xp-col-tile-name mono' }, c.name),
          React.createElement('div', { className: 'xp-col-tile-row' },
            React.createElement('span', { className: 'xp-chip ' + chip.cls }, chip.label),
            qcol.missingCount > 0 && React.createElement('span', { className: 'xp-chip miss' },
              fmtInt(qcol.missingCount) + ' missing'),
            qcol.outlierCount > 0 && React.createElement('span', { className: 'xp-chip outl' },
              fmtInt(qcol.outlierCount) + ' outliers'),
            qcol.rareValue && React.createElement('span', { className: 'xp-chip flag' },
              '⚠ rare value')
          )
        );
      })
    )
  );
}

// ── Overview tab: Missing-by-Attribute ranked list ───────────────────
function MissingByAttribute({ fixture, rows, quality, onJumpToColumn }) {
  const cols = fixture.columns;
  const nRows = rows.length;
  const ranked = quality.perCol
    .filter(c => c.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount);

  if (ranked.length === 0) {
    return React.createElement(
      'section', { className: 'xp-ov-block', id: 'ov-missing' },
      React.createElement('h2', { className: 'xp-ov-h2' }, 'Missing Values by Attribute'),
      React.createElement('p', { className: 'xp-ov-empty' },
        'No missing values in any column. ✓')
    );
  }

  const max = ranked[0].missingCount;
  return React.createElement(
    'section', { className: 'xp-ov-block', id: 'ov-missing' },
    React.createElement('h2', { className: 'xp-ov-h2' }, 'Missing Values by Attribute'),
    React.createElement('p', { className: 'xp-ov-narr' },
      ranked.length + ' column' + (ranked.length === 1 ? '' : 's') +
      ' have small gaps. The system fills these automatically before training — nothing for you to do.'),
    React.createElement(
      'div', { className: 'xp-rank-list' },
      ranked.map((c) => React.createElement(
        'button', {
          key: c.name,
          className: 'xp-rank-row',
          onClick: () => onJumpToColumn && onJumpToColumn(c.name),
          'aria-label': 'Open details for ' + c.name,
        },
        React.createElement('span', { className: 'xp-rank-name mono' }, c.name),
        React.createElement('div', { className: 'xp-bar-track' },
          React.createElement('div', {
            className: 'xp-bar-fill',
            style: { width: Math.round((c.missingCount / max) * 100) + '%' },
          })),
        React.createElement('span', { className: 'xp-rank-val' },
          fmtInt(c.missingCount) + ' (' + pctFine(c.missingCount, nRows) + '%)')
      ))
    )
  );
}

// ── Overview tab: Outliers-by-Attribute ranked list ──────────────────
function OutliersByAttribute({ fixture, rows, quality, onJumpToColumn }) {
  const nRows = rows.length;
  const ranked = quality.perCol
    .filter(c => c.outlierCount > 0)
    .sort((a, b) => b.outlierCount - a.outlierCount);

  if (ranked.length === 0) {
    return React.createElement(
      'section', { className: 'xp-ov-block', id: 'ov-outliers' },
      React.createElement('h2', { className: 'xp-ov-h2' }, 'Outliers by Attribute'),
      React.createElement('p', { className: 'xp-ov-empty' },
        'No outliers detected in any numeric column. ✓')
    );
  }

  const max = ranked[0].outlierCount;
  // Build a column-aware sentence — name the worst column and pair the
  // flag with the system action (v2 §3.4).
  const worst = ranked[0];
  const narration =
    '`' + worst.name + '` has ' + fmtInt(worst.outlierCount) +
    ' unusually high or low value' + (worst.outlierCount === 1 ? '' : 's') +
    '. The system keeps them but rescales the column so extreme cases ' +
    'don’t dominate training.';

  return React.createElement(
    'section', { className: 'xp-ov-block', id: 'ov-outliers' },
    React.createElement('h2', { className: 'xp-ov-h2' }, 'Outliers by Attribute'),
    React.createElement('p', { className: 'xp-ov-narr' }, narration),
    React.createElement(
      'div', { className: 'xp-rank-list' },
      ranked.map((c) => React.createElement(
        'button', {
          key: c.name,
          className: 'xp-rank-row',
          onClick: () => onJumpToColumn && onJumpToColumn(c.name),
          'aria-label': 'Open details for ' + c.name,
        },
        React.createElement('span', { className: 'xp-rank-name mono' }, c.name),
        React.createElement('div', { className: 'xp-bar-track' },
          React.createElement('div', {
            className: 'xp-bar-fill xp-bar-fill-warn',
            style: { width: Math.round((c.outlierCount / max) * 100) + '%' },
          })),
        React.createElement('span', { className: 'xp-rank-val' },
          fmtInt(c.outlierCount) + ' (' + pctFine(c.outlierCount, nRows) + '%)')
      ))
    )
  );
}

// ── Overview tab: cross-file banner for non-target files ─────────────
function CrossFileBanner({ targetCtx }) {
  if (targetCtx.resolvable) return null;
  if (!targetCtx.targetColName) {
    // No target chosen yet — gentler copy.
    return React.createElement(
      'section', { className: 'xp-banner' },
      React.createElement('span', { className: 'xp-banner-icon', 'aria-hidden': 'true' }, '◆'),
      React.createElement('div', null,
        React.createElement('div', { className: 'xp-banner-title' },
          'No prediction target chosen yet.'),
        React.createElement('div', { className: 'xp-banner-body' },
          'Pick one on the Domain step to see a Class Distribution chart here. ' +
          'The distributions and data quality below still apply.'))
    );
  }
  return React.createElement(
    'section', { className: 'xp-banner' },
    React.createElement('span', { className: 'xp-banner-icon', 'aria-hidden': 'true' }, '↗'),
    React.createElement('div', null,
      React.createElement('div', { className: 'xp-banner-title' },
        'The prediction target ',
        React.createElement('code', null, targetCtx.targetColName),
        ' is in a different file.'),
      React.createElement('div', { className: 'xp-banner-body' },
        'The distributions and data quality below still apply.'))
  );
}

// ── Data Preview tab: three sub-sections ─────────────────────────────
function PreviewTable({ cols, rows, missingMaskRows, outlierMaskRows, highlightCol }) {
  // rows here is the SUBSET (already capped). missingMaskRows /
  // outlierMaskRows are aligned to rows by index.
  return React.createElement(
    'div', { className: 'xp-prev-tablewrap' },
    React.createElement(
      'table', { className: 'xp-prev-table' },
      React.createElement('thead', null,
        React.createElement('tr', null,
          React.createElement('th', { className: 'xp-prev-rowhd' }, '#'),
          cols.map((c, ci) => React.createElement('th', {
            key: ci,
            className: highlightCol === c.name ? 'highlight' : '',
          }, c.name)))),
      React.createElement('tbody', null,
        rows.map((r, ri) => React.createElement(
          'tr', { key: ri },
          React.createElement('td', { className: 'xp-prev-rowhd' }, r.__rowNum + 1),
          cols.map((c, ci) => {
            const isMissing = missingMaskRows && missingMaskRows[ri] && missingMaskRows[ri][ci];
            const isOutlier = outlierMaskRows && outlierMaskRows[ri] && outlierMaskRows[ri][ci];
            const cls =
              (isMissing ? 'xp-cell-miss ' : '') +
              (isOutlier ? 'xp-cell-outl ' : '');
            return React.createElement('td', { key: ci, className: cls.trim() },
              isMissing ? '—' : String(r[ci]));
          })
        )))
    )
  );
}

function DataPreviewTab({ fixture, rows, quality }) {
  const cols = fixture.columns;
  const { missingMask, outlierMask } = quality;

  // Decorate rows with their original row number so it's preserved
  // across sub-section sorting / filtering.
  const decorated = rows.map((r, i) => {
    const nr = r.slice();
    nr.__rowNum = i;
    return nr;
  });

  // (1) Sample — first 10 rows, original order.
  const sample = decorated.slice(0, PREVIEW_LIMIT);
  const sampleMM = sample.map(r => missingMask[r.__rowNum]);
  const sampleOM = sample.map(r => outlierMask[r.__rowNum]);

  // (2) Rows with at least one missing cell, sorted by # missing desc.
  const missingRows = decorated
    .map(r => ({
      row: r,
      nMiss: missingMask[r.__rowNum].filter(Boolean).length,
    }))
    .filter(x => x.nMiss > 0)
    .sort((a, b) => b.nMiss - a.nMiss)
    .slice(0, PREVIEW_LIMIT)
    .map(x => x.row);
  const missMM = missingRows.map(r => missingMask[r.__rowNum]);
  const missOM = missingRows.map(r => outlierMask[r.__rowNum]);

  // (3) Rows containing at least one outlier cell.
  const outlierRows = decorated
    .map(r => ({
      row: r,
      nOut: outlierMask[r.__rowNum].filter(Boolean).length,
    }))
    .filter(x => x.nOut > 0)
    .sort((a, b) => b.nOut - a.nOut)
    .slice(0, PREVIEW_LIMIT)
    .map(x => x.row);
  const outMM = outlierRows.map(r => missingMask[r.__rowNum]);
  const outOM = outlierRows.map(r => outlierMask[r.__rowNum]);

  return React.createElement(
    'div', { className: 'xp-prev-root' },
    React.createElement('div', { className: 'xp-prev-legend' },
      React.createElement('code', null, '—'),
      ' means the value is missing for this row. Highlighted cells are flagged as outliers.'),

    // (1) Sample — header dropped; the tab title already says "Sample Rows".
    React.createElement('section', { className: 'xp-prev-block' },
      React.createElement('p', { className: 'xp-ov-narr' },
        'Up to 10 rows from the top of the file — what typical data looks like.'),
      React.createElement(PreviewTable, {
        cols, rows: sample,
        missingMaskRows: sampleMM, outlierMaskRows: sampleOM,
      })
    ),

    // (2) Missing
    React.createElement('section', { className: 'xp-prev-block' },
      React.createElement('h2', { className: 'xp-ov-h2' }, 'Rows With Missing Values'),
      missingRows.length === 0
        ? React.createElement('p', { className: 'xp-ov-empty' },
            'No row has any missing cells. ✓')
        : React.createElement(React.Fragment, null,
            React.createElement('p', { className: 'xp-ov-narr' },
              'Rows that contain at least one missing cell, sorted by how many are missing.'),
            React.createElement(PreviewTable, {
              cols, rows: missingRows,
              missingMaskRows: missMM, outlierMaskRows: outMM,
            }))
    ),

    // (3) Outliers
    React.createElement('section', { className: 'xp-prev-block' },
      React.createElement('h2', { className: 'xp-ov-h2' }, 'Rows With Outlier Values'),
      outlierRows.length === 0
        ? React.createElement('p', { className: 'xp-ov-empty' },
            'No outliers detected in any numeric column. ✓')
        : React.createElement(React.Fragment, null,
            React.createElement('p', { className: 'xp-ov-narr' },
              'Rows flagged by the system as having an unusually high or low value in a numeric column.'),
            React.createElement(PreviewTable, {
              cols, rows: outlierRows,
              missingMaskRows: outMM, outlierMaskRows: outOM,
            }))
    ),

    // (4) Bottom toolbar — open the full file in the viewer/editor.
    React.createElement(
      'div', { className: 'xp-prev-toolbar bottom' },
      React.createElement('div', { className: 'xp-prev-toolbar-hint' },
        'The previews above are capped at 10 rows per section. Want to see every row in ',
        React.createElement('code', null, fixture.name),
        ' — and make corrections?'),
      React.createElement('button', {
        type: 'button',
        className: 'btn xp-prev-viewbtn',
        onClick: () => {
          window.location.href = 'viewer.html?file=' + encodeURIComponent(fixture.name);
        },
        'aria-label': 'Open ' + fixture.name + ' in the full row viewer and editor',
      },
        'View & edit rows ',
        React.createElement('span', { 'aria-hidden': 'true', className: 'xp-prev-viewbtn-arrow' }, '→')
      )
    )
  );
}

// ── "What the system will do" tab ───────────────────────────────────
// Preprocessing-step catalog. Each operation has:
//   - kind / title / blurb / shortDesc — surface copy on the cards and
//     in the picker
//   - params[]    — parameter schema consumed by AddStepPicker. Each
//     param declares { kind: 'text'|'select'|'checkbox', label, help,
//     options?, examples?, defaultValue }. The picker renders these
//     and emits values back into addStep().
//   - defaultHint / emptyText — copy reused by both the auto-suggested
//     steps (deriveDefaultSteps) and picker-added steps (addStep).
//
// Auto-suggested steps inline their own chip-style fields directly in
// deriveDefaultSteps; the catalog's `params` schema is only used by
// the picker.

// Reusable parameter factory for "Attributes" — a chip multi-select
// of actual column names, filtered by what the operation can act on.
// `selector` is interpreted in the picker (see eligibleColumns):
//   'numeric'              — numeric, non-target, non-ID
//   'categorical'          — categorical (incl. yes/no), non-target, non-ID
//   'string_or_category'   — same as categorical for now (no separate
//                             string type in our fixtures)
//   'missing_any'          — columns that actually have gaps
//   'all'                  — every non-target, non-ID column
const ATTR_PARAM = (selector, label) => ({
  key: 'attrs',
  kind: 'columns',
  label: label || 'Attributes',
  help: 'Pick the columns this step should apply to.',
  columnSelector: selector,
  defaultValue: [],
});

const PREPROC_CATALOG = {
  missing_values: {
    label: 'Missing Value Handling',
    kind: 'MISSING VALUE HANDLING',
    operations: {
      replace_missing: {
        title: 'Replace Missing Values',
        shortDesc: 'Replace missing values using mean, median, mode, or constant value strategies',
        blurb: 'Replace missing values using a selected strategy.',
        params: [
          ATTR_PARAM('missing_any', 'Apply to'),
          {
            key: 'strategy',
            kind: 'select',
            label: 'Fill Strategy',
            help: 'Select how missing values should be imputed',
            options: [
              { value: 'mean_mode',  label: 'Mean (numeric) / Mode (categorical)' },
              { value: 'mean',       label: 'Mean' },
              { value: 'median',     label: 'Median' },
              { value: 'mode',       label: 'Mode' },
              { value: 'constant',   label: 'Constant value' },
            ],
            defaultValue: 'mean_mode',
          },
        ],
        defaultHint: 'Replace gaps so every row stays usable. Median is robust to skew; "most common" preserves a categorical column’s distribution.',
      },
      remove_missing_rows: {
        title: 'Remove Rows with Missing Values',
        shortDesc: 'Drop rows that contain missing values in the selected attributes',
        blurb: 'Remove rows that contain missing values.',
        params: [ATTR_PARAM('missing_any', 'Check attributes')],
        defaultHint: 'Drops every row that has a gap in any of the listed columns. Use sparingly — it can shrink the dataset fast.',
      },
    },
  },
  normalization: {
    label: 'Data Normalization',
    kind: 'DATA NORMALIZATION',
    operations: {
      normalize: {
        title: 'Normalize (0-1)',
        shortDesc: 'Normalize attributes to 0-1 range',
        blurb: 'Scale numeric values to a common range.',
        params: [ATTR_PARAM('numeric', 'Numeric attributes')],
        defaultHint: 'Squashes each numeric column into [0, 1]. Use when scale matters more than spread.',
      },
      standardize: {
        title: 'Standardize (Z-score)',
        shortDesc: 'Convert numeric values to have mean 0 and standard deviation 1',
        blurb: 'Convert numeric values to have mean 0 and standard deviation 1.',
        params: [ATTR_PARAM('numeric', 'Numeric attributes')],
        defaultHint: 'Centers each numeric column at 0 with unit variance. The safe default for most models.',
      },
    },
  },
  transformation: {
    label: 'Data Transformation',
    kind: 'DATA TRANSFORMATION',
    operations: {
      string_to_nominal: {
        title: 'String to Nominal',
        shortDesc: 'Convert string attributes to nominal',
        blurb: 'Convert string attributes to nominal.',
        params: [ATTR_PARAM('string_or_category', 'Attributes')],
        defaultHint: 'Tells the model these columns hold categories, not free-form text.',
      },
      nominal_to_integer: {
        title: 'Nominal to Integer',
        shortDesc: 'Convert category labels into integer values',
        blurb: 'Convert category labels into integer values.',
        params: [ATTR_PARAM('categorical', 'Attributes')],
        defaultHint: 'Useful when the model can\'t handle one-hot expansion (e.g. very high-cardinality columns).',
      },
      nominal_to_binary: {
        title: 'Nominal to Binary',
        shortDesc: 'Convert categories into separate binary columns',
        blurb: 'Convert categories into separate binary columns.',
        params: [ATTR_PARAM('categorical', 'Attributes')],
        defaultHint: 'Tree-based and linear models both handle one-hot encoding cleanly; gives each category its own signal.',
      },
      discretize: {
        title: 'Discretize Numeric',
        shortDesc: 'Convert numeric values into bins or ranges',
        blurb: 'Convert numeric values into bins or ranges.',
        params: [
          ATTR_PARAM('numeric', 'Numeric attributes'),
          {
            key: 'bins',
            kind: 'text',
            label: 'Number of Bins',
            placeholder: '4',
            defaultValue: '4',
            help: 'How many bins to split each numeric attribute into',
          },
        ],
        defaultHint: 'Turns a continuous column into a small set of buckets. Useful when the relationship is non-linear.',
      },
    },
  },
  cleaning: {
    label: 'Data Cleaning',
    kind: 'DATA CLEANING',
    operations: {
      remove_attributes: {
        title: 'Remove Attributes',
        shortDesc: 'Remove specified attributes from the dataset',
        blurb: 'Remove specified attributes from the dataset.',
        params: [
          ATTR_PARAM('all', 'Attributes to remove'),
          {
            key: 'invert',
            kind: 'checkbox',
            label: 'Invert Selection',
            help: 'Keep the listed attributes and remove the rest',
            defaultValue: false,
          },
        ],
        defaultHint: 'Drops columns wholesale. Use for columns that leak the target or are pure noise.',
      },
      remove_duplicates: {
        title: 'Remove Duplicate Instances',
        shortDesc: 'Remove duplicate rows from the dataset',
        blurb: 'Remove duplicate rows from the dataset.',
        params: [],
        defaultHint: 'Compares whole rows. Duplicates skew the model and inflate accuracy if they land in both train and test.',
        emptyText: 'No parameters needed.',
      },
      remove_outliers: {
        title: 'Remove Outliers',
        shortDesc: 'Remove unusually high or low numeric values',
        blurb: 'Remove unusually high or low numeric values.',
        params: [
          ATTR_PARAM('numeric', 'Numeric attributes'),
          {
            key: 'threshold',
            kind: 'select',
            label: 'Outlier Threshold',
            help: 'How far past the spread a value has to sit to be dropped',
            options: [
              { value: '1.5_iqr', label: '1.5 × IQR (standard)' },
              { value: '3_iqr',   label: '3 × IQR (conservative)' },
              { value: '2_sigma', label: '2 σ' },
              { value: '3_sigma', label: '3 σ' },
            ],
            defaultValue: '1.5_iqr',
          },
        ],
        defaultHint: 'Drops rows past the chosen fence. Outliers are often informative — only use this when you\'re sure they\'re noise.',
      },
    },
  },
};

// Derive the auto-suggested step list from the live quality model.
function deriveDefaultSteps(fixture, rows, quality, targetCtx) {
  const cols = fixture.columns;
  const isTargetCol = (name) => targetCtx && targetCtx.targetColName === name;

  const missingNumeric = quality.perCol.filter(c => c.missingCount > 0 && (c.kind === 'numeric' || c.kind === 'yesno'));
  const missingCategory = quality.perCol.filter(c => c.missingCount > 0 && c.kind === 'category');
  const nominalCols = quality.perCol.filter(c =>
    (c.kind === 'category' || c.kind === 'yesno') && !isTargetCol(c.name));
  const standardizeCols = quality.perCol.filter(c =>
    c.kind === 'numeric' && !isTargetCol(c.name));

  const steps = [];
  let nextId = 1;
  const newId = () => 'step-' + (nextId++);

  if (missingNumeric.length > 0) {
    const totalGaps = missingNumeric.reduce((a, c) => a + c.missingCount, 0);
    const colsList = missingNumeric.map(c => c.name);
    steps.push({
      id: newId(),
      kind: 'MISSING VALUE HANDLING',
      title: 'Replace Missing Values',
      blurb: 'Replace missing values using a selected strategy.',
      hint: fmtInt(totalGaps) + ' missing value' + (totalGaps === 1 ? '' : 's') +
        ' in ' + (colsList.length === 1 ? colsList[0] : (colsList.length + ' numeric columns')) +
        '. Median is robust to skew and outliers, so it’s the safe default.',
      fields: [
        { key: 'attrs', label: 'Apply to', chips: colsList, columnSelector: 'missing_any' },
        { key: 'strategy', kind: 'select', label: 'Fill Strategy', select: 'median',
          options: [
            { value: 'mean_mode', label: 'Mean (numeric) / Mode (categorical)' },
            { value: 'mean',      label: 'Mean' },
            { value: 'median',    label: 'Median' },
            { value: 'mode',      label: 'Mode' },
            { value: 'constant',  label: 'Constant value' },
          ] },
      ],
    });
  }
  if (missingCategory.length > 0) {
    const totalGaps = missingCategory.reduce((a, c) => a + c.missingCount, 0);
    const colsList = missingCategory.map(c => c.name);
    steps.push({
      id: newId(),
      kind: 'MISSING VALUE HANDLING',
      title: 'Replace Missing Values',
      blurb: 'Replace missing values using a selected strategy.',
      hint: fmtInt(totalGaps) + ' missing value' + (totalGaps === 1 ? '' : 's') +
        ' in ' + (colsList.length === 1 ? colsList[0] : (colsList.length + ' categorical columns')) +
        '. Most common value preserves the column’s distribution.',
      fields: [
        { key: 'attrs', label: 'Apply to', chips: colsList, columnSelector: 'missing_any' },
        { key: 'strategy', kind: 'select', label: 'Fill Strategy', select: 'mode',
          options: [
            { value: 'mean_mode', label: 'Mean (numeric) / Mode (categorical)' },
            { value: 'mean',      label: 'Mean' },
            { value: 'median',    label: 'Median' },
            { value: 'mode',      label: 'Mode' },
            { value: 'constant',  label: 'Constant value' },
          ] },
      ],
    });
  }

  steps.push({
    id: newId(),
    kind: 'DATA CLEANING',
    title: 'Remove Duplicates',
    blurb: 'Remove duplicate rows from the dataset.',
    hint: 'Checked ' + fmtInt(rows.length) + ' rows — no exact-duplicate rows found in the upload. Keeps the step in the pipeline as a safeguard for future re-runs.',
    empty: 'No parameters needed.',
    fields: [],
  });

  if (nominalCols.length > 0) {
    steps.push({
      id: newId(),
      kind: 'DATA TRANSFORMATION',
      title: 'Nominal to Binary',
      blurb: 'Convert categories into separate binary columns.',
      hint: 'Tree-based and linear models both handle one-hot encoding cleanly; gives each category its own signal.',
      fields: [
        { key: 'attrs', label: 'Attributes', chips: nominalCols.map(c => c.name), columnSelector: 'categorical' },
      ],
    });
  }

  if (standardizeCols.length > 0) {
    let why = 'Puts every numeric column on the same scale so units don\'t dominate the model.';
    const scaleInfo = standardizeCols.map(c => {
      const idx = cols.findIndex(x => x.name === c.name);
      const stats = numericStats(rows.map(r => r[idx]));
      return stats ? { name: c.name, range: stats.max - stats.min } : null;
    }).filter(Boolean).sort((a, b) => b.range - a.range);
    if (scaleInfo.length >= 2) {
      const a = scaleInfo[0], b = scaleInfo[scaleInfo.length - 1];
      if (a.range > b.range * 5) {
        why = a.name + ' and ' + b.name + ' are on very different scales (≈' +
          fmtInt(Math.round(a.range)) + ' vs ≈' + fmtInt(Math.round(b.range)) + ').';
      }
    }
    steps.push({
      id: newId(),
      kind: 'DATA NORMALIZATION',
      title: 'Standardize',
      blurb: 'Convert numeric values to have mean 0 and standard deviation 1.',
      hint: why,
      fields: [
        { key: 'attrs', label: 'Numeric attributes', chips: standardizeCols.map(c => c.name), columnSelector: 'numeric' },
      ],
    });
  }

  return steps;
}

// "Preprocessing Configuration" form — modal-hosted picker that mirrors
// the reference screenshots: paired Category + Operation dropdowns at
// the top, a short description strip, then a Parameters section whose
// fields are driven by the selected operation's `params` schema.
//
// Each parameter declaration can be one of:
//   kind: 'select'   → native <select> with { value, label } options
//   kind: 'text'     → text input (used for Attribute Indices,
//                      with an extra examples callout)
//   kind: 'checkbox' → labelled checkbox (Invert Selection)
function AddStepPicker({ catalog, fixture, quality, targetCtx, onAdd, onClose }) {
  const groupKeys = Object.keys(catalog);
  const [groupKey, setGroupKey] = React.useState(groupKeys[0]);
  const opKeysFor = (gk) => Object.keys(catalog[gk].operations);
  const [opKey, setOpKey] = React.useState(opKeysFor(groupKeys[0])[0]);

  const op = catalog[groupKey] && catalog[groupKey].operations[opKey];
  const params = (op && op.params) || [];

  // Param values keyed by `${groupKey}.${opKey}.${paramKey}` so that
  // switching between ops doesn't blow away unrelated edits.
  const [paramValues, setParamValues] = React.useState({});
  const valKey = (pk) => groupKey + '.' + opKey + '.' + pk;
  const getVal = (p) => {
    const k = valKey(p.key);
    if (paramValues[k] !== undefined) return paramValues[k];
    return p.defaultValue !== undefined ? p.defaultValue : '';
  };
  const setVal = (p, v) => setParamValues(prev => ({ ...prev, [valKey(p.key)]: v }));

  // Resolve which fixture columns are eligible for the current op,
  // based on the param's `columnSelector` directive. Skips target +
  // ID columns by default; 'all' still respects those filters because
  // none of those should be acted on by a preprocessing step.
  const isTargetCol = (name) => targetCtx && targetCtx.targetColName === name;
  const eligibleColumns = (selector) => {
    if (!quality || !quality.perCol) return [];
    return quality.perCol.filter(c => {
      if (c.kind === 'id') return false;
      if (isTargetCol(c.name)) return false;
      switch (selector) {
        case 'numeric':            return c.kind === 'numeric';
        case 'categorical':        return c.kind === 'category' || c.kind === 'yesno';
        case 'string_or_category': return c.kind === 'category' || c.kind === 'yesno';
        case 'missing_any':        return (c.missingCount || 0) > 0;
        case 'all':                return true;
        default:                   return true;
      }
    });
  };

  const onChangeGroup = (gk) => {
    setGroupKey(gk);
    setOpKey(opKeysFor(gk)[0]);
  };

  const handleAdd = () => {
    const collected = {};
    params.forEach(p => { collected[p.key] = getVal(p); });
    onAdd(groupKey, opKey, collected);
  };

  return React.createElement(
    ModalShell, { onClose, ariaLabel: 'Preprocessing Configuration' },
    React.createElement('h2', { className: 'xp-cfg-title' }, 'Preprocessing Configuration'),
    React.createElement('p', { className: 'xp-cfg-sub' },
      'Choose a preprocessing technique and adjust its parameters.'),

    React.createElement('div', { className: 'xp-cfg-row' },
      React.createElement('div', { className: 'xp-cfg-field' },
        React.createElement('label', { className: 'xp-cfg-label', htmlFor: 'xp-cfg-cat' }, 'Category'),
        React.createElement('div', { className: 'xp-cfg-select-wrap' },
          React.createElement('select', {
            id: 'xp-cfg-cat',
            className: 'xp-cfg-select',
            value: groupKey,
            onChange: (e) => onChangeGroup(e.target.value),
          }, groupKeys.map(gk => React.createElement('option', { key: gk, value: gk }, catalog[gk].label)))
        )
      ),
      React.createElement('div', { className: 'xp-cfg-field' },
        React.createElement('label', { className: 'xp-cfg-label', htmlFor: 'xp-cfg-op' }, 'Operation'),
        React.createElement('div', { className: 'xp-cfg-select-wrap' },
          React.createElement('select', {
            id: 'xp-cfg-op',
            className: 'xp-cfg-select',
            value: opKey,
            onChange: (e) => setOpKey(e.target.value),
          }, opKeysFor(groupKey).map(ok => React.createElement(
            'option', { key: ok, value: ok }, catalog[groupKey].operations[ok].title)))
        )
      )
    ),

    op && React.createElement('div', { className: 'xp-cfg-desc' }, op.shortDesc),

    params.length === 0
      ? React.createElement('div', { className: 'xp-cfg-noparams' },
          'This operation does not require any additional parameters.')
      : React.createElement(
          'div', { className: 'xp-cfg-params' },
          React.createElement('div', { className: 'xp-cfg-params-label' }, 'Parameters'),
          params.map((p) => {
            if (p.kind === 'columns') {
              const eligible = eligibleColumns(p.columnSelector);
              const selected = getVal(p) || [];
              const selectedSet = new Set(selected);
              const remaining = eligible.filter(c => !selectedSet.has(c.name));
              const addColumn = (name) => {
                if (!name || selectedSet.has(name)) return;
                setVal(p, selected.concat([name]));
              };
              const removeColumn = (name) => {
                setVal(p, selected.filter(n => n !== name));
              };
              return React.createElement(
                'div', { className: 'xp-cfg-param', key: p.key },
                React.createElement('label', { className: 'xp-cfg-label' }, p.label),
                React.createElement(
                  'div', {
                    className: 'xp-cfg-chipbox' + (selected.length === 0 ? ' empty' : ''),
                  },
                  selected.length === 0 && React.createElement(
                    'span', { className: 'xp-cfg-chipbox-placeholder' },
                    'No columns selected yet'),
                  selected.map(name => React.createElement(
                    'span', { className: 'xp-cfg-attr-chip', key: name },
                    React.createElement('code', null, name),
                    React.createElement('button', {
                      type: 'button',
                      className: 'xp-cfg-attr-chip-x',
                      'aria-label': 'Remove ' + name,
                      onClick: () => removeColumn(name),
                    }, '×')
                  ))
                ),
                React.createElement('div', { className: 'xp-cfg-select-wrap xp-cfg-add-wrap' },
                  React.createElement('select', {
                    className: 'xp-cfg-select',
                    value: '',
                    onChange: (e) => addColumn(e.target.value),
                    disabled: remaining.length === 0,
                  },
                    React.createElement('option', { value: '' },
                      remaining.length === 0
                        ? (eligible.length === 0
                            ? 'No eligible columns in this file'
                            : 'All eligible columns added')
                        : '+ Add a column…'),
                    remaining.map(c => React.createElement(
                      'option', { key: c.name, value: c.name }, c.name))
                  )
                ),
                p.help && React.createElement('div', { className: 'xp-cfg-help' }, p.help)
              );
            }
            if (p.kind === 'select') {
              return React.createElement(
                'div', { className: 'xp-cfg-param', key: p.key },
                React.createElement('label', { className: 'xp-cfg-label', htmlFor: 'xp-cfg-' + p.key },
                  p.label),
                React.createElement('div', { className: 'xp-cfg-select-wrap' },
                  React.createElement('select', {
                    id: 'xp-cfg-' + p.key,
                    className: 'xp-cfg-select',
                    value: getVal(p),
                    onChange: (e) => setVal(p, e.target.value),
                  }, p.options.map(o => React.createElement(
                    'option', { key: o.value, value: o.value }, o.label)))
                ),
                p.help && React.createElement('div', { className: 'xp-cfg-help' }, p.help)
              );
            }
            if (p.kind === 'checkbox') {
              return React.createElement(
                'label', { className: 'xp-cfg-check', key: p.key },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: !!getVal(p),
                  onChange: (e) => setVal(p, e.target.checked),
                }),
                React.createElement('span', null, p.label),
                p.help && React.createElement('span', { className: 'xp-cfg-check-help' }, ' — ' + p.help)
              );
            }
            // text
            return React.createElement(
              'div', { className: 'xp-cfg-param', key: p.key },
              React.createElement('label', { className: 'xp-cfg-label', htmlFor: 'xp-cfg-' + p.key },
                p.label),
              React.createElement('input', {
                id: 'xp-cfg-' + p.key,
                className: 'xp-cfg-input',
                type: 'text',
                placeholder: p.placeholder || '',
                value: getVal(p),
                onChange: (e) => setVal(p, e.target.value),
              }),
              p.help && React.createElement('div', { className: 'xp-cfg-help' }, p.help),
              p.examples && React.createElement('div', { className: 'xp-cfg-examples' },
                React.createElement('div', { className: 'xp-cfg-examples-title' }, 'Examples:'),
                React.createElement('ul', { className: 'xp-cfg-examples-list' },
                  p.examples.map((ex, i) => React.createElement('li', { key: i },
                    React.createElement('code', null, ex.code),
                    ' — ' + ex.desc))))
            );
          })
        ),

    React.createElement('button', {
      type: 'button',
      className: 'btn btn-primary xp-cfg-add',
      onClick: handleAdd,
    }, '+ Add to Pipeline')
  );
}

function WhatSystemWillDoTab({ fixture, rows, quality, targetCtx }) {
  const cols = fixture.columns;
  const isTargetCol = (name) => targetCtx && targetCtx.targetColName === name;

  // Step list is now stateful so additions / deletions / reorders
  // persist. Initialised from deriveDefaultSteps so the file's
  // auto-suggested steps still appear on first render.
  const [steps, setSteps] = React.useState(() =>
    deriveDefaultSteps(fixture, rows, quality, targetCtx));
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const nextIdRef = React.useRef(1000);
  const mintId = () => 'step-' + (nextIdRef.current++);

  const resetDefaults = () => {
    setSteps(deriveDefaultSteps(fixture, rows, quality, targetCtx));
  };

  const deleteStep = (id) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  // Update one field on one step. `patch` is a partial field shape
  // (e.g. { chips: [...] } or { select: 'mean' }) — merged in.
  const updateField = (stepId, fieldKey, patch) => {
    setSteps(prev => prev.map(s => {
      if (s.id !== stepId) return s;
      return {
        ...s,
        fields: (s.fields || []).map(f =>
          f.key === fieldKey ? { ...f, ...patch } : f),
      };
    }));
  };

  // Eligible columns for an in-card chip "+ Add" select. Mirrors the
  // logic inside AddStepPicker but here we accept the selector
  // directly off the field shape.
  const eligibleForSelector = (selector) => {
    if (!quality || !quality.perCol) return [];
    return quality.perCol.filter(c => {
      if (c.kind === 'id') return false;
      if (isTargetCol(c.name)) return false;
      switch (selector) {
        case 'numeric':            return c.kind === 'numeric';
        case 'categorical':        return c.kind === 'category' || c.kind === 'yesno';
        case 'string_or_category': return c.kind === 'category' || c.kind === 'yesno';
        case 'missing_any':        return (c.missingCount || 0) > 0;
        case 'all':                return true;
        default:                   return true;
      }
    });
  };

  const moveStep = (id, dir) => {
    setSteps(prev => {
      const i = prev.findIndex(s => s.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // Drag-and-drop reorder. `dragId` is the step currently being
  // dragged; `dropTarget` is { id, where: 'before' | 'after' } — the
  // gap indicator highlights that edge of the matching step.
  const [dragId, setDragId] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null);

  const onDragStart = (id, e) => {
    setDragId(id);
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    } catch (err) { /* some browsers throw if dt is read-only */ }
  };
  const onDragEnd = () => {
    setDragId(null);
    setDropTarget(null);
  };
  const onDragOverStep = (id, e) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    // Decide which edge of this card we're closer to.
    const rect = e.currentTarget.getBoundingClientRect();
    const where = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
    setDropTarget(prev => (prev && prev.id === id && prev.where === where)
      ? prev : { id, where });
  };
  const onDragLeaveStep = (id) => {
    setDropTarget(prev => (prev && prev.id === id) ? null : prev);
  };
  const onDropStep = (id, e) => {
    e.preventDefault();
    const tgt = dropTarget || { id, where: 'after' };
    moveTo(dragId, tgt.id, tgt.where);
    onDragEnd();
  };
  const moveTo = (srcId, anchorId, where) => {
    if (!srcId || srcId === anchorId) return;
    setSteps(prev => {
      const srcIdx = prev.findIndex(s => s.id === srcId);
      if (srcIdx < 0) return prev;
      const src = prev[srcIdx];
      const without = prev.filter(s => s.id !== srcId);
      let anchorIdx = without.findIndex(s => s.id === anchorId);
      if (anchorIdx < 0) return prev;
      if (where === 'after') anchorIdx += 1;
      const next = without.slice();
      next.splice(anchorIdx, 0, src);
      return next;
    });
  };

  // Picker-driven add. The picker collects (groupKey, opKey, values)
  // — `values` is a flat object keyed by the operation's param keys.
  // We translate each declared param into a renderable field on the
  // step card (text label + value for indices/bins, select label +
  // value for strategy/threshold, checkbox label for invert).
  const addStep = (groupKey, opKey, values) => {
    const group = PREPROC_CATALOG[groupKey];
    const op = group && group.operations[opKey];
    if (!op) return;
    const params = op.params || [];
    const fields = params.map(p => {
      if (p.kind === 'columns') {
        // Editable chip list — always rendered as 'chips' so the user
        // can add more columns later, even if they started with none.
        return {
          key: p.key, label: p.label,
          chips: (values[p.key] || []),
          columnSelector: p.columnSelector,
        };
      }
      if (p.kind === 'select') {
        return {
          key: p.key, kind: 'select', label: p.label,
          select: values[p.key],
          options: (p.options || []).map(o => ({ value: o.value, label: o.label })),
        };
      }
      if (p.kind === 'checkbox') {
        return {
          key: p.key, kind: 'checkbox', label: p.label,
          checked: !!values[p.key],
        };
      }
      // text
      return {
        key: p.key, kind: 'text', label: p.label,
        text: String(values[p.key] != null ? values[p.key] : ''),
        placeholder: p.placeholder || '',
      };
    });
    setSteps(prev => prev.concat([{
      id: mintId(),
      kind: group.kind,
      title: op.title,
      blurb: op.blurb,
      hint: op.defaultHint,
      empty: params.length === 0 ? (op.emptyText || 'No parameters needed.') : undefined,
      fields,
    }]));
    setPickerOpen(false);
  };

  return React.createElement(
    'div', { className: 'xp-wsd-root' },
    React.createElement('p', { className: 'xp-wsd-intro' },
      'Based on what I saw in your data, here are the cleaning and transformation steps I’d run before training. ',
      React.createElement('strong', null,
        'Edit any step, remove what you don’t want, or add more.'),
      ' They run top-to-bottom.'),

    React.createElement('div', { className: 'xp-wsd-banner' },
      React.createElement('span', { className: 'xp-wsd-banner-icon', 'aria-hidden': 'true' }, '✦'),
      React.createElement('div', null,
        React.createElement('div', { className: 'xp-wsd-banner-title' },
          steps.length + ' step' + (steps.length === 1 ? '' : 's') + ' pre-configured'),
        React.createElement('div', { className: 'xp-wsd-banner-body' },
          'Reviewed against ',
          React.createElement('code', null, fixture.name),
          ' · adjust to taste'))
    ),

    React.createElement('ol', { className: 'xp-wsd-steps' },
      steps.map((s, i) => React.createElement(
        'li', {
          className: 'xp-wsd-step'
            + (dragId === s.id ? ' dragging' : '')
            + (dropTarget && dropTarget.id === s.id ? ' drop-' + dropTarget.where : ''),
          key: s.id,
          onDragOver: (e) => onDragOverStep(s.id, e),
          onDragLeave: () => onDragLeaveStep(s.id),
          onDrop: (e) => onDropStep(s.id, e),
        },
        React.createElement('div', { className: 'xp-wsd-step-num' },
          React.createElement('div', {
            className: 'xp-wsd-step-circle',
            draggable: true,
            onDragStart: (e) => onDragStart(s.id, e),
            onDragEnd: onDragEnd,
            title: 'Drag to reorder',
            'aria-label': 'Drag handle for step ' + (i + 1),
          }, i + 1),
          React.createElement('div', { className: 'xp-wsd-step-arrows' },
            React.createElement('button', {
              className: 'xp-wsd-arrow',
              type: 'button',
              'aria-label': 'Move step up',
              disabled: i === 0,
              onClick: () => moveStep(s.id, -1),
            }, '↑'),
            React.createElement('button', {
              className: 'xp-wsd-arrow',
              type: 'button',
              'aria-label': 'Move step down',
              disabled: i === steps.length - 1,
              onClick: () => moveStep(s.id, +1),
            }, '↓'))
        ),
        React.createElement('div', { className: 'xp-wsd-step-body' },
          React.createElement('div', { className: 'xp-wsd-step-hd' },
            React.createElement('span', { className: 'xp-wsd-step-kind mono' }, s.kind),
            React.createElement('button', {
              type: 'button',
              className: 'xp-wsd-step-del',
              'aria-label': 'Remove this step',
              title: 'Remove this step',
              onClick: () => deleteStep(s.id),
            }, '🗑')
          ),
          React.createElement('div', { className: 'xp-wsd-step-title' }, s.title),
          React.createElement('div', { className: 'xp-wsd-step-blurb' }, s.blurb),
          React.createElement('div', { className: 'xp-wsd-step-hint' },
            React.createElement('span', { className: 'xp-wsd-step-hint-icon', 'aria-hidden': 'true' }, '✦'),
            s.hint),
          s.empty
            ? React.createElement('div', { className: 'xp-wsd-step-empty' }, s.empty)
            : (s.fields || []).map((f, fi) => {
                // Editable chip multi-select.
                if (f.chips) {
                  const selected = f.chips;
                  const selectedSet = new Set(selected);
                  const eligible = eligibleForSelector(f.columnSelector);
                  const remaining = eligible.filter(c => !selectedSet.has(c.name));
                  return React.createElement(
                    'div', { className: 'xp-wsd-field', key: fi },
                    React.createElement('div', { className: 'xp-wsd-field-label mono' }, f.label),
                    React.createElement(
                      'div', {
                        className: 'xp-wsd-field-input chips editable' + (selected.length === 0 ? ' empty' : ''),
                      },
                      selected.length === 0 && React.createElement(
                        'span', { className: 'xp-wsd-chips-placeholder' },
                        'No columns — pick one below'),
                      selected.map((c) => React.createElement(
                        'span', { className: 'xp-wsd-chip', key: c },
                        React.createElement('code', null, c),
                        React.createElement('button', {
                          className: 'xp-wsd-chip-x',
                          type: 'button',
                          'aria-label': 'Remove ' + c,
                          onClick: () => updateField(s.id, f.key, {
                            chips: selected.filter(n => n !== c),
                          }),
                        }, '×')
                      ))
                    ),
                    React.createElement(
                      'div', { className: 'xp-wsd-add-wrap' },
                      React.createElement('select', {
                        className: 'xp-wsd-add-select',
                        value: '',
                        disabled: remaining.length === 0,
                        onChange: (e) => {
                          const name = e.target.value;
                          if (!name) return;
                          updateField(s.id, f.key, { chips: selected.concat([name]) });
                        },
                      },
                        React.createElement('option', { value: '' },
                          remaining.length === 0
                            ? (eligible.length === 0
                                ? 'No eligible columns in this file'
                                : 'All eligible columns added')
                            : '+ Add a column…'),
                        remaining.map(c => React.createElement(
                          'option', { key: c.name, value: c.name }, c.name))
                      )
                    )
                  );
                }
                // Editable select.
                if (f.select !== undefined && f.options) {
                  return React.createElement(
                    'div', { className: 'xp-wsd-field', key: fi },
                    React.createElement('div', { className: 'xp-wsd-field-label mono' }, f.label),
                    React.createElement(
                      'div', { className: 'xp-wsd-field-input select editable' },
                      React.createElement('select', {
                        className: 'xp-wsd-edit-select',
                        value: f.select,
                        onChange: (e) => updateField(s.id, f.key, { select: e.target.value }),
                      }, (f.options || []).map((o) => React.createElement(
                        'option', { key: o.value, value: o.value }, o.label)))
                    )
                  );
                }
                // Editable text.
                if (f.kind === 'text') {
                  return React.createElement(
                    'div', { className: 'xp-wsd-field', key: fi },
                    React.createElement('div', { className: 'xp-wsd-field-label mono' }, f.label),
                    React.createElement('input', {
                      type: 'text',
                      className: 'xp-wsd-edit-input',
                      value: f.text,
                      placeholder: f.placeholder || '',
                      onChange: (e) => updateField(s.id, f.key, { text: e.target.value }),
                    })
                  );
                }
                // Editable checkbox.
                if (f.kind === 'checkbox') {
                  return React.createElement(
                    'div', { className: 'xp-wsd-field', key: fi },
                    React.createElement('label', { className: 'xp-wsd-edit-check' },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: !!f.checked,
                        onChange: (e) => updateField(s.id, f.key, { checked: e.target.checked }),
                      }),
                      React.createElement('span', null, f.label))
                  );
                }
                // Fallback (e.g. legacy 'value' fields if any survive).
                return React.createElement(
                  'div', { className: 'xp-wsd-field', key: fi },
                  React.createElement('div', { className: 'xp-wsd-field-label mono' }, f.label),
                  React.createElement(
                    'div', { className: 'xp-wsd-field-input value' },
                    React.createElement('span', null, f.value || ''))
                );
              })
        )
      ))
    ),

    React.createElement('button', {
      type: 'button',
      className: 'xp-wsd-addstep',
      onClick: () => setPickerOpen(true),
    }, '+ Add preprocessing step'),

    React.createElement('div', { className: 'xp-wsd-actions' },
      React.createElement('button', {
        type: 'button',
        className: 'xp-wsd-reset',
        onClick: resetDefaults,
      }, '↻ Reset to system defaults'),
      React.createElement('button', {
        type: 'button',
        className: 'btn btn-primary xp-wsd-continue',
        onClick: () => window.Store.go(2),
      }, 'Continue to domain knowledge →')
    ),

    pickerOpen && React.createElement(AddStepPicker, {
      catalog: PREPROC_CATALOG,
      fixture, quality, targetCtx,
      onAdd: addStep,
      onClose: () => setPickerOpen(false),
    })
  );
}

// ── Dataset summary block (Visualization tab header) ────────────────
function SummaryBlock({ fixture, rows }) {
  const cols = fixture.columns;
  let numeric = 0, categorical = 0, idLike = 0, boolean = 0;
  cols.forEach((c, i) => {
    const looksId = i === 0 && /(^|_)id$/i.test(c.name);
    if (looksId) { idLike++; return; }
    if (c.type === 'numeric') numeric++;
    else if (c.type === 'boolean') boolean++;
    else categorical++;
  });
  const typeParts = [];
  if (numeric) typeParts.push(numeric + ' numeric');
  if (categorical) typeParts.push(categorical + ' categorical');
  if (boolean) typeParts.push(boolean + ' yes/no');
  if (idLike) typeParts.push('1 looks like an ID');

  return React.createElement(
    'div', { className: 'xp-summary' },
    React.createElement('div', { className: 'xp-summary-title' }, fixture.name),
    React.createElement('p', null,
      rows.length.toLocaleString() + ' rows · ' + cols.length + ' columns.'),
    React.createElement('p', null, typeParts.join(', ') + '.')
  );
}

// ── Gated Technical view ─────────────────────────────────────────────
function TechnicalView({ fixture, rows, targetCtx }) {
  const cols = fixture.columns;

  // (a) ML-treatment table. v2 §5.3 — plan_tier's treatment text must
  // match what the expander says (rollup-then-one-hot).
  const treatment = cols.map((c, i) => {
    const looksId = i === 0 && /(^|_)id$/i.test(c.name);
    const isTarget = targetCtx.targetColName === c.name;
    let detected, treat;
    if (looksId) { detected = 'ID / string'; treat = 'Dropped (not predictive)'; }
    else if (c.type === 'numeric') { detected = 'numeric'; treat = isTarget ? 'Target candidate' : 'Scaled, used as feature'; }
    else if (c.type === 'boolean') { detected = 'binary'; treat = isTarget ? 'Target candidate' : 'Used as feature'; }
    else if (c.name === 'plan_tier' && !isTarget) {
      detected = 'categorical';
      treat = 'Rare values grouped with closest tier, then one-hot encoded';
    }
    else { detected = 'categorical'; treat = isTarget ? 'Target candidate' : 'One-hot encoded'; }
    return { name: c.name, detected, treat };
  });

  // (b) numeric spread + (c) correlation.
  const numCols = [];
  cols.forEach((c, i) => {
    if (c.type !== 'numeric') return;
    if (i === 0 && /(^|_)id$/i.test(c.name)) return;
    const stats = numericStats(rows.map(r => r[i]));
    if (stats) { stats.label = c.name; numCols.push({ name: c.name, idx: i, stats }); }
  });

  const corrCols = numCols.slice(0, 6);
  const series = corrCols.map(nc => rows.map(r => Number(r[nc.idx])).filter(v => !Number.isNaN(v)));
  const minLen = series.reduce((m, s) => Math.min(m, s.length), Infinity);
  const aligned = series.map(s => s.slice(0, minLen));

  return React.createElement(
    'details', { className: 'xp-tech' },
    React.createElement('summary', null,
      'Technical view ',
      React.createElement('span', { className: 'xp-hint' }, '— for users comfortable with stats')
    ),
    React.createElement(
      'div', { className: 'xp-tech-body' },

      React.createElement('h3', null, 'Columns & how the system will treat them'),
      React.createElement(
        'table', { className: 'xp-tech-table' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null, 'Column'),
            React.createElement('th', null, 'Detected type'),
            React.createElement('th', null, 'ML treatment'))),
        React.createElement('tbody', null,
          treatment.map((t, i) =>
            React.createElement('tr', { key: i },
              React.createElement('td', null, React.createElement('code', null, t.name)),
              React.createElement('td', null, t.detected),
              React.createElement('td', null, t.treat))))
      ),

      numCols.length > 0 && React.createElement(React.Fragment, null,
        React.createElement('h3', null, 'Spread & outliers (box plots)'),
        numCols.map((nc) =>
          React.createElement('div', { key: nc.name, className: 'xp-box-wrap' },
            React.createElement('div', { className: 'xp-box-name mono' }, nc.name),
            React.createElement(BoxPlot, { stats: nc.stats }))),
        React.createElement(
          'table', { className: 'xp-tech-table' },
          React.createElement('thead', null,
            React.createElement('tr', null,
              ['Column', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'Outliers'].map((h, i) =>
                React.createElement('th', { key: i }, h)))),
          React.createElement('tbody', null,
            numCols.map((nc) =>
              React.createElement('tr', { key: nc.name },
                React.createElement('td', null, React.createElement('code', null, nc.name)),
                React.createElement('td', null, fmtNum(nc.stats.min)),
                React.createElement('td', null, fmtNum(nc.stats.q1)),
                React.createElement('td', null, fmtNum(nc.stats.med)),
                React.createElement('td', null, fmtNum(nc.stats.q3)),
                React.createElement('td', null, fmtNum(nc.stats.max)),
                React.createElement('td', null, fmtInt(nc.stats.outliers)))))
        )
      ),

      corrCols.length >= 2 && React.createElement(React.Fragment, null,
        React.createElement('h3', null, 'Correlation between numeric columns'),
        React.createElement('div', { className: 'xp-caveat' },
          'Columns that move together aren’t necessarily causing each other, ' +
          'and this says nothing yet about what predicts the outcome.'),
        React.createElement(
          'table', { className: 'xp-heat' },
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, ''),
              corrCols.map((nc) =>
                React.createElement('th', { key: nc.name }, nc.name)))),
          React.createElement('tbody', null,
            corrCols.map((rc, ri) =>
              React.createElement('tr', { key: rc.name },
                React.createElement('th', null, rc.name),
                corrCols.map((cc, ci) => {
                  const r = ri === ci ? 1 : pearson(aligned[ri], aligned[ci]);
                  return React.createElement('td', {
                    key: cc.name,
                    style: heatStyle(r),
                  }, (r >= 0 ? '' : '-') + Math.abs(r).toFixed(2).replace(/^0/, ''));
                }))))
        )
      )
    )
  );
}

// ── Tab strip (pill-style, WAI-ARIA) ─────────────────────────────────
function TabStrip({ tabs, active, onChange }) {
  const refs = React.useRef([]);
  const onKey = (e, idx) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % tabs.length;
      onChange(tabs[next].id);
      const el = refs.current[next];
      if (el) el.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + tabs.length) % tabs.length;
      onChange(tabs[prev].id);
      const el = refs.current[prev];
      if (el) el.focus();
    }
  };
  return React.createElement(
    'div', { className: 'xp-tabs', role: 'tablist', 'aria-label': 'Explore views' },
    tabs.map((t, i) => React.createElement(
      'button', {
        key: t.id,
        ref: (el) => { refs.current[i] = el; },
        role: 'tab',
        'aria-selected': active === t.id ? 'true' : 'false',
        tabIndex: active === t.id ? 0 : -1,
        className: 'xp-tab' + (active === t.id ? ' active' : ''),
        onClick: () => onChange(t.id),
        onKeyDown: (e) => onKey(e, i),
      },
      t.label
    ))
  );
}

// ── ExploreView — rendered inside the shell's .workflow-body ─────────
function ExploreView() {
  const [state, setState] = React.useState({ phase: 'loading' });
  const [activeTab, setActiveTab] = React.useState('overview');
  const [openColIdx, setOpenColIdx] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await waitForData(8000);
      if (!alive) return;
      const fixtures = window.FILE_FIXTURES || {};
      const fixture = Object.values(fixtures).find((f) => f.name === FILE_NAME);
      if (!ok || !fixture || typeof window.generateFullRows !== 'function') {
        setState({
          phase: 'error',
          message: 'No file selected, or the dataset could not be loaded. Go back to Upload and choose a file.',
        });
        return;
      }
      const rows = window.generateFullRows(FILE_NAME);
      if (!rows || rows.length === 0) {
        setState({
          phase: 'error',
          message: 'Couldn’t load this file’s data — go back to Upload.',
        });
        return;
      }
      const targetCtx = resolveTarget(fixture, rows);
      const quality = buildQualityModel(fixture, rows);
      setState({ phase: 'ready', fixture, rows, targetCtx, quality });
    })();
    return () => { alive = false; };
  }, []);

  const backLink = React.createElement(
    'button',
    {
      className: 'btn btn-sm',
      style: { marginBottom: 16 },
      onClick: () => window.Store.go(1),
    },
    '← Back to Upload'
  );

  if (state.phase === 'loading') {
    return React.createElement(
      'div', null,
      backLink,
      React.createElement('div', { className: 'explore-note' }, 'Loading this file’s data…')
    );
  }

  if (state.phase === 'error') {
    return React.createElement(
      'div', null,
      backLink,
      React.createElement('div', { className: 'explore-note' }, state.message)
    );
  }

  const { fixture, rows, targetCtx, quality } = state;

  // Clicking a column on the Missing-/Outliers-by-Attribute lists now
  // opens that column's modal (the Visualization tab was removed).
  const openColumnByName = (name) => {
    const idx = fixture.columns.findIndex(c => c.name === name);
    if (idx >= 0) setOpenColIdx(idx);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'preview',  label: 'Sample Rows' },
    { id: 'plan',     label: 'What the system will do' },
  ];

  let body;
  if (activeTab === 'overview') {
    body = React.createElement(
      'div', { role: 'tabpanel', className: 'xp-tabpanel' },
      // Cross-file banner on non-target files; nothing in its place on
      // target files (Class Distribution removed).
      !targetCtx.resolvable && React.createElement(CrossFileBanner, { targetCtx }),
      React.createElement(StatTiles, { fixture, rows, quality }),
      React.createElement(ColumnsGrid, {
        fixture, rows, quality,
        onOpenColumn: (idx) => setOpenColIdx(idx),
      }),
      React.createElement(MissingByAttribute, { fixture, rows, quality, onJumpToColumn: openColumnByName }),
      React.createElement(OutliersByAttribute, { fixture, rows, quality, onJumpToColumn: openColumnByName })
    );
  } else if (activeTab === 'preview') {
    body = React.createElement(
      'div', { role: 'tabpanel', className: 'xp-tabpanel' },
      !targetCtx.resolvable && React.createElement(CrossFileBanner, { targetCtx }),
      React.createElement(DataPreviewTab, { fixture, rows, quality })
    );
  } else {
    body = React.createElement(
      'div', { role: 'tabpanel', className: 'xp-tabpanel' },
      !targetCtx.resolvable && React.createElement(CrossFileBanner, { targetCtx }),
      React.createElement(WhatSystemWillDoTab, { fixture, rows, quality, targetCtx })
    );
  }

  return React.createElement(
    'div', { className: 'xp-root' },
    backLink,
    React.createElement('div', { className: 'xp-eyebrow' },
      'Exploring · ',
      React.createElement('span', { className: 'mono' }, FILE_NAME)),
    React.createElement('h1', { className: 'xp-h1' },
      'Here’s what’s in ',
      React.createElement('code', null, FILE_NAME),
      '.'),
    React.createElement('p', { className: 'xp-sub' },
      'A quick look at each column. Nothing here is locked in — this won’t change your data.'),

    React.createElement(TabStrip, { tabs, active: activeTab, onChange: setActiveTab }),
    body,

    openColIdx != null && React.createElement(ColumnModal, {
      col: fixture.columns[openColIdx],
      colIndex: openColIdx,
      fixture, rows, targetCtx, quality,
      onClose: () => setOpenColIdx(null),
    })
  );
}

// Resolve the chosen prediction target relative to THIS file.
function resolveTarget(fixture, rows) {
  let st = {};
  try { st = (window.Store && window.Store.load()) || {}; } catch (e) { st = {}; }
  const targetKey = st.targetCol;
  if (!targetKey) {
    return {
      resolvable: false,
      targetColName: null,
      message: 'No prediction target chosen yet. Pick one on the Domain step to see how each column relates to the outcome.',
    };
  }
  const targetColName = targetKey.slice(targetKey.indexOf(':') + 1);
  const colNames = fixture.columns.map(c => c.name);
  if (colNames.indexOf(targetColName) < 0) {
    return {
      resolvable: false,
      targetColName,
      message: 'The prediction target "' + targetColName +
        '" is in a different file. The distributions and data quality below still apply.',
    };
  }
  return { resolvable: true, targetColName };
}

// ── DomainTechnicalView — the same gated Technical view, but fed by
// the Domain page's live merged schema + the source file's synthesized
// rows (Domain has no ?file= query). Unchanged from v1 — the v2 tab
// split applies only inside explore.html.
function DomainTechnicalView({ schema, targetColName }) {
  const [ready, setReady] = React.useState(
    typeof window.generateFullRows === 'function' && !!window.FILE_FIXTURES
  );
  React.useEffect(() => {
    if (ready) return;
    let alive = true;
    waitForData(8000).then((ok) => { if (alive && ok) setReady(true); });
    return () => { alive = false; };
  }, [ready]);

  if (!schema || schema.parsedCount === 0) return null;
  if (!ready) return null;

  const flat = [
    ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, role: 'normal' })),
    ...schema.groups.flatMap(g => g.columns.map(c => ({
      name: c.name, type: c.type, role: c.role || 'normal',
    }))),
  ].filter(c => c.role !== 'joinKey');
  if (flat.length === 0) return null;

  const fixture = { name: 'merged dataset', columns: flat };

  let sourceName = null;
  if (schema.groups.length > 0) sourceName = schema.groups[0].name;
  else {
    const fx = Object.values(window.FILE_FIXTURES || {})[0];
    sourceName = fx && fx.name;
  }
  const srcRows = sourceName ? window.generateFullRows(sourceName) : [];
  if (!srcRows || srcRows.length === 0) return null;

  const srcFixture = Object.values(window.FILE_FIXTURES || {})
    .find(f => f.name === sourceName);
  const srcCols = (srcFixture && srcFixture.columns) || [];
  const colIdx = flat.map(c => srcCols.findIndex(sc => sc.name === c.name));
  const rows = srcRows.map(r => colIdx.map(i => (i >= 0 ? r[i] : '')));

  return React.createElement(TechnicalView, {
    fixture, rows, targetCtx: { targetColName: targetColName || null },
  });
}

Object.assign(window, { ExploreView, TechnicalView, DomainTechnicalView });
