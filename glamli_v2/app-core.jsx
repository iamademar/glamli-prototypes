// app-core.jsx — shared page-root factory for the multi-page GLAMLI v3.
//
// v2 had one monolithic App() that switched stages in-memory. v3 splits
// each stage into its own HTML page. This module exposes
// `makePageApp(PAGE_STAGE)` which returns a React component that:
//   - hydrates the durable state from Store on mount,
//   - renders the shared topbar + WorkflowRail + ChatPanel + the one
//     Stage component for PAGE_STAGE,
//   - persists durable state back to Store on change,
//   - turns advance(n) / rail clicks into real page navigations.
//
// Each page-*.jsx is a one-liner that mounts makePageApp(N).

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "accent": "sage"
} /*EDITMODE-END*/;

const ACCENTS = {
  sage: { '--accent': '#6f8a6a', '--accent-soft': '#e3ebde', '--accent-ink': '#43583f' },
  clay: { '--accent': '#a86b50', '--accent-soft': '#f1e2d8', '--accent-ink': '#6e4633' },
  slate: { '--accent': '#6a7a8c', '--accent-soft': '#dee3ea', '--accent-ink': '#3f4a58' },
  plum: { '--accent': '#8a6a82', '--accent-soft': '#ebdde7', '--accent-ink': '#583f50' }
};

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function streamMessage(setMessages, fullText, onDone, chunkSize, stage) {
  setMessages((prev) => [...prev, { who: 'assistant', text: '', t: nowTime(), stage: stage || null }]);
  let i = 0;
  if (!chunkSize) chunkSize = 3;
  const interval = setInterval(() => {
    i += chunkSize;
    setMessages((prev) => {
      const copy = prev.slice();
      copy[copy.length - 1] = { ...copy[copy.length - 1], text: fullText.slice(0, i) };
      return copy;
    });
    if (i >= fullText.length) {
      clearInterval(interval);
      if (onDone) onDone();
    }
  }, 18);
}

function buildSetupSummary(schema, targetKey, opts) {
  const flatCols = [
    ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, role: 'normal', key: 'shared:' + c.name })),
    ...schema.groups.flatMap(g => g.columns.map(c => ({
      name: c.name, type: c.type, role: c.role || 'normal', key: g.fileId + ':' + c.name,
    }))),
  ];
  if (flatCols.length === 0) return null;
  const targetEntry = flatCols.find(c => c.key === targetKey) || flatCols[flatCols.length - 1];
  const inputs = flatCols.filter(c => c.key !== targetEntry.key && c.role !== 'joinKey');
  const task = (typeof inferTaskType === 'function') ? inferTaskType(targetEntry) : { phrase: 'a value' };
  const prefix = (opts && opts.prefix) ? opts.prefix : '';
  const bulletInputs = inputs.map(c => '· `' + c.name + '`').join('\n\n');
  return (
    prefix +
    "It will look at **" + inputs.length + " things** about each row:" +
    "\n\n" + bulletInputs +
    "\n\nAnd it will predict: `" + targetEntry.name + "` (" + task.phrase + ")."
  );
}

function explainRefusalCopy(prevFile, file, fileColList) {
  const left = prevFile ? prevFile.name : 'the existing dataset';
  const leftCols = prevFile ? fileColList(prevFile) : '(none yet)';
  const rightCols = fileColList(file);
  const leftN = prevFile ? prevFile.columns.length : 0;
  const rightN = file.columns.length;
  return [
    "Sure — happy to walk through it.",
    "",
    "To combine two CSV files into one table I can train a model on, the files need to relate to each other in one of two ways:",
    "",
    "**1. They share a column with matching values.** For example, if both files had a `customer_id` column and the same customer IDs appeared in both, I could **join** them — line up each customer's churn record with their support tickets, side by side.",
    "",
    "**2. They have the same columns and just hold different rows.** For example, two months of sales data with the same columns — I'd **stack** one on top of the other.",
    "",
    "Here's what I found between your two files:",
    "",
    "· `" + left + "` has " + leftN + " columns: " + leftCols + ".",
    "· `" + file.name + "` has " + rightN + " columns: " + rightCols + ".",
    "",
    "No column names match between the two files, so I have nothing obvious to line them up on. I also checked whether values in any column from one file appeared in any column of the other — they don't.",
    "",
    "They're also not stackable, because they describe completely different things — one row in `" + left + "` is a different kind of record than one row in `" + file.name + "`. Stacking them would put unrelated values in the same column.",
    "",
    "**What would let me combine them:** if your data has a column I missed that links the two files — for example a date both files cover, or a shared identifier — tell me in the composer below which column to use and I'll re-check.",
    "",
    "If they're genuinely unrelated and you only meant to analyse one of them, hit **Remove this file** on the panel and we'll continue with `" + left + "`.",
  ].join("\n\n");
}

function generateReply(text, stage) {
  const lower = text.toLowerCase();
  if (lower.includes('why') && lower.includes('f1')) {
    return "Good question. **F1-score** balances precision and recall, which matters here because only ~26% of customers churn. If we used plain accuracy, a model could predict \"No\" for everyone and still score 74% — useless for retention. F1 forces the model to actually catch the churners.";
  }
  if (lower.includes('test') && lower.includes('case')) {
    return "Test cases are the heart of this approach. Each one says: *given these inputs, expect this output.* The system uses them to (a) infer your objective, and (b) sanity-check the trained model. Two is the minimum, but **5–10 cases gives a much better picture**.";
  }
  if (lower.includes('column') || lower.includes('assumption')) {
    return "Each assumption becomes part of the model's context. The AutoML backend uses them to pick reasonable feature transformations — for example, knowing `tenure_months` is *months* (not days) prevents weird scaling choices.";
  }
  if (lower.includes('stage') || lower.includes('next') || lower.includes('continue')) {
    return "We're on **stage " + stage + "**. When you're done with this step, the **Continue** button at the bottom will unlock the next one. Anything you set here can still be edited later.";
  }
  return "Got it. I'll keep that in mind. If you'd like me to explain any part of the workflow — the assumptions, test cases, or how the AutoML backend uses them — just ask.";
}

// ─────────────────────────────────────────────────────────────────────
// makePageApp(PAGE_STAGE) — returns the page-root component pinned to
// the given workflow stage.
// ─────────────────────────────────────────────────────────────────────
function makePageApp(PAGE_STAGE) {
  return function PageApp() {
    const boot = React.useRef(Store.load());
    const s0 = boot.current;

    const [tweaks, setTweak] = useTweaks(s0.tweaks || TWEAK_DEFAULTS);

    // `stage` is fixed to this page. `maxStage` still tracked + persisted.
    const stage = PAGE_STAGE;
    const [maxStage, setMaxStage] = React.useState(Math.max(s0.maxStage || 1, PAGE_STAGE));

    const [files, setFiles] = React.useState(s0.files || []);
    const [merges, setMerges] = React.useState(s0.merges || []);
    const [mergeRevision, setMergeRevision] = React.useState(s0.mergeRevision || 0);
    const [mergeRevisionAtDomainEntry, setMergeRevisionAtDomainEntry] = React.useState(s0.mergeRevisionAtDomainEntry || 0);

    const [assumptions, setAssumptions] = React.useState(s0.assumptions || {});
    const [testCases, setTestCases] = React.useState(
      (s0.testCases && s0.testCases.length)
        ? s0.testCases
        : INITIAL_TEST_CASES.map((tc) => ({ ...tc, predicted: null, confidence: null }))
    );
    const [messages, setMessages] = React.useState(s0.messages || []);
    const [streaming, setStreaming] = React.useState(false);
    const [shownIntros, setShownIntros] = React.useState(new Set(s0.shownIntros || []));

    const [composerDraft, setComposerDraft] = React.useState('');
    const pendingHintForFileId = React.useRef(null);

    const [sourcesOpen, setSourcesOpen] = React.useState(true);

    const [targetCol, setTargetCol] = React.useState(s0.targetCol || null);

    const [runProgress, setRunProgress] = React.useState(0);
    const [runActive, setRunActive] = React.useState(0);
    const [runDone, setRunDone] = React.useState(!!s0.runDone);
    const [hasTested, setHasTested] = React.useState(!!s0.hasTested);

    const [predictInputs, setPredictInputs] = React.useState(s0.predictInputs || {});
    const [predictResult, setPredictResult] = React.useState(s0.predictResult || null);
    const [lastPredictedTargetKey, setLastPredictedTargetKey] = React.useState(s0.lastPredictedTargetKey || null);

    const schema = React.useMemo(() => mergedSchema(files, merges), [files, merges]);
    const topbarLabel = topbarSubtitle(files);

    // ── Persist the durable slice on any change ──────────────────────
    React.useEffect(() => {
      Store.save({
        files, merges, mergeRevision, mergeRevisionAtDomainEntry,
        assumptions, testCases, messages,
        shownIntros: [...shownIntros],
        targetCol, runDone, hasTested,
        predictInputs, predictResult, lastPredictedTargetKey,
        tweaks, stage: PAGE_STAGE, maxStage,
      });
    }, [
      files, merges, mergeRevision, mergeRevisionAtDomainEntry,
      assumptions, testCases, messages, shownIntros,
      targetCol, runDone, hasTested,
      predictInputs, predictResult, lastPredictedTargetKey,
      tweaks, maxStage,
    ]);

    // Auto-default the target column whenever the schema changes.
    React.useEffect(() => {
      if (schema.parsedCount === 0) {
        if (targetCol !== null) setTargetCol(null);
        return;
      }
      const flatKeys = new Set([
        ...schema.sharedColumns.map(c => 'shared:' + c.name),
        ...schema.groups.flatMap(g => g.columns.map(c => g.fileId + ':' + c.name)),
      ]);
      if (!targetCol || !flatKeys.has(targetCol)) {
        setTargetCol(defaultTargetKey(schema));
      }
    }, [schema]);

    // Stage 5 form: reconcile predictInputs against the live schema.
    React.useEffect(() => {
      if (schema.parsedCount === 0) {
        if (Object.keys(predictInputs).length) setPredictInputs({});
        if (predictResult) setPredictResult(null);
        return;
      }
      const filesByName = new Map(files.map(f => [f.name, f]));
      const desired = schema.groups.length > 0
        ? schema.groups.flatMap(g =>
            g.columns
              .filter(c => c.role !== 'joinKey')
              .map(c => ({ key: g.fileId + ':' + c.name, name: c.name, file: filesByName.get(g.name) }))
          )
        : schema.sharedColumns.map(c => ({
            key: 'shared:' + c.name,
            name: c.name,
            file: files.find(f => f.status === 'parsed'),
          }));
      const visible = desired.filter(d => d.key !== targetCol);
      let changed = false;
      const next = {};
      const desiredKeys = new Set(visible.map(d => d.key));
      for (const k of Object.keys(predictInputs)) {
        if (desiredKeys.has(k)) next[k] = predictInputs[k];
        else changed = true;
      }
      for (const d of visible) {
        if (!(d.key in next)) {
          next[d.key] = d.file ? firstPreviewValue(d.file, d.name) : '';
          changed = true;
        }
      }
      if (changed) setPredictInputs(next);
      if (predictResult && lastPredictedTargetKey !== targetCol) {
        setPredictResult(null);
      }
    }, [schema, targetCol]);

    // Apply theme + density + accent to root.
    React.useEffect(() => {
      const root = document.documentElement;
      root.dataset.theme = tweaks.theme;
      root.dataset.density = tweaks.density;
      const accent = ACCENTS[tweaks.accent] || ACCENTS.sage;
      Object.entries(accent).forEach(([k, v]) => root.style.setProperty(k, v));
    }, [tweaks]);

    // Stage intro — fires once per stage (guarded by persisted shownIntros).
    React.useEffect(() => {
      if (stage === 2 && mergeRevisionAtDomainEntry === 0) {
        setMergeRevisionAtDomainEntry(mergeRevision);
      }
      if (shownIntros.has(stage)) return;

      if (stage === 3) {
        const summary = buildSetupSummary(schema, targetCol, {
          prefix: "Here's how your model will work. ",
        });
        if (!summary) return;
        const intro = summary +
          "\n\nIf that's right, hit **continue**. If not, hit **Something's off** and tell me what to change.";
        setShownIntros((prev) => new Set(prev).add(stage));
        setStreaming(true);
        streamMessage(setMessages, intro, () => setStreaming(false), 10, stage);
        return;
      }

      if (stage === 5) {
        if (schema.parsedCount === 0) return;
        const flatCols = [
          ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, key: 'shared:' + c.name })),
          ...schema.groups.flatMap(g => g.columns.map(c => ({ name: c.name, type: c.type, key: g.fileId + ':' + c.name }))),
        ];
        const target = flatCols.find(c => c.key === targetCol) || flatCols[flatCols.length - 1];
        const intro =
          "Now let's test the model on a new row. Enter values for the inputs on the right and I'll predict `" +
          target.name + "` for you. Try changing one field at a time to see what moves the prediction.";
        setShownIntros((prev) => new Set(prev).add(stage));
        setStreaming(true);
        streamMessage(setMessages, intro, () => setStreaming(false), 10, stage);
        return;
      }

      const intro = STAGE_INTROS[stage];
      if (!intro) return;
      setShownIntros((prev) => new Set(prev).add(stage));
      setStreaming(true);
      streamMessage(setMessages, intro[0].text, () => setStreaming(false), undefined, stage);
    }, [stage, schema, targetCol]);

    // advance(n) / rail clicks → persist then navigate.
    const navTo = (n) => {
      Store.save({
        files, merges, mergeRevision, mergeRevisionAtDomainEntry,
        assumptions, testCases, messages,
        shownIntros: [...shownIntros],
        targetCol, runDone, hasTested,
        predictInputs, predictResult, lastPredictedTargetKey,
        tweaks,
      });
      Store.go(n);
    };
    const advance = (n) => { navTo(n); };
    // WorkflowRail expects setStage(n); route it through navTo.
    const railSetStage = (n) => { navTo(n); };

    // ── multi-CSV handlers ───────────────────────────────────────────

    const startUploadFixture = (fixtureName) => {
      const newFile = makeFile(fixtureName);
      newFile._pending = 'parsing';
      newFile._progress = 0;
      setFiles(prev => [...prev, newFile]);
    };

    const parsingFileIdRef = React.useRef(null);
    React.useEffect(() => {
      const parsing = files.find(f => f._pending === 'parsing');
      if (!parsing) { parsingFileIdRef.current = null; return; }
      if (parsingFileIdRef.current === parsing.id) return;
      parsingFileIdRef.current = parsing.id;
      const targetId = parsing.id;
      const DURATION = 1600;
      const start = performance.now();
      let raf;
      let cancelled = false;
      const tick = (now) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        const pct = Math.min(100, Math.round(eased * 100));
        setFiles(prev => prev.map(f => f.id === targetId ? { ...f, _progress: pct } : f));
        if (t < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setTimeout(() => {
            if (cancelled) return;
            setFiles(prev => prev.map(f => f.id === targetId ? { ...f, _pending: 'classifying', _progress: 100 } : f));
          }, 220);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => { cancelled = true; cancelAnimationFrame(raf); };
    }, [files]);

    const classifyingFileIdRef = React.useRef(null);
    React.useEffect(() => {
      const classifying = files.find(f => f._pending === 'classifying');
      if (!classifying) { classifyingFileIdRef.current = null; return; }
      if (classifyingFileIdRef.current === classifying.id) return;
      classifyingFileIdRef.current = classifying.id;
      const t = setTimeout(() => {
        const idx = files.findIndex(f => f.id === classifying.id);
        if (idx < 0) return;
        const isFirst = idx === 0;
        const prevParsedSchema = mergedSchema(files.slice(0, idx), merges.slice(0, idx));
        const result = isFirst ? null : classify(prevParsedSchema, classifying);
        const isRefused = !isFirst && result && result.kind === 'refused';
        const finalised = {
          ...classifying,
          _pending: null,
          status: isRefused ? 'refused' : 'parsed',
        };
        setFiles(prev => {
          const next = prev.slice();
          const i = next.findIndex(f => f.id === classifying.id);
          if (i < 0) return prev;
          next[i] = finalised;
          return next;
        });
        if (!isFirst) {
          setMerges(prev => {
            const next = prev.slice();
            next[idx - 1] = result;
            return next;
          });
        }
        if (finalised.status === 'parsed') {
          setAssumptions(prevA => isFirst
            ? migrateInitialAssumptions(finalised)
            : blankAssumptionsForFile(finalised, prevA));
        }
        setMergeRevision(r => r + 1);
        if (isRefused) {
          const prevFile = files[idx - 1];
          queueMicrotask(() => {
            setStreaming(true);
            streamMessage(
              setMessages,
              "I refused " + classifying.name + " — no shared columns with " + prevFile.name + ".",
              () => setStreaming(false),
              undefined,
              stage
            );
          });
        }
      }, 600);
      return () => clearTimeout(t);
    }, [files, merges]);

    const onChangeMergeKeys = (idx, newKeys) => {
      setMerges(prev => {
        const next = prev.slice();
        const cur = next[idx];
        if (!cur) return prev;
        const leftFile = files[idx];
        const rightFile = files[idx + 1];
        const overlap = leftFile && rightFile
          ? Math.round(Math.min(leftFile.rows, rightFile.rows) / Math.max(leftFile.rows, rightFile.rows) * 100)
          : cur.stats.overlap;
        next[idx] = { ...cur, keys: newKeys, stats: { ...cur.stats, overlap } };
        return next;
      });
      setMergeRevision(r => r + 1);
    };

    const onRemoveFile = (fileId) => {
      setFiles(prev => {
        const idx = prev.findIndex(f => f.id === fileId);
        if (idx < 0) return prev;
        return prev.filter((_, i) => i !== idx);
      });
      setMerges(prev => {
        const idx = files.findIndex(f => f.id === fileId);
        if (idx <= 0) return prev.slice(1);
        return prev.filter((_, i) => i !== idx - 1);
      });
      setAssumptions(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(fileId + ':')) delete next[k]; });
        return next;
      });
      if (targetCol && targetCol.startsWith(fileId + ':')) {
        setTargetCol(null);
      }
      setMergeRevision(r => r + 1);
    };

    const onSeedComposer = (text, fileId) => {
      setComposerDraft(text);
      if (fileId) pendingHintForFileId.current = fileId;
    };

    const onExplainInChat = (fileId) => {
      const idx = files.findIndex(f => f.id === fileId);
      if (idx < 0) return;
      const file = files[idx];
      const prevFile = idx > 0 ? files[idx - 1] : null;
      const userQ = "Why can't " + (prevFile ? prevFile.name : 'this file') +
                    " and " + file.name + " be merged?";
      const fileColList = (f) => f.columns.map(c => c.name).join(', ');
      const reply = explainRefusalCopy(prevFile, file, fileColList);
      pendingHintForFileId.current = fileId;
      setMessages(prev => [...prev, { who: 'user', text: userQ, t: nowTime(), stage }]);
      setStreaming(true);
      setTimeout(() => {
        streamMessage(setMessages, reply, () => setStreaming(false), 10, stage);
      }, 400);
    };

    const onSend = (text) => {
      setMessages((prev) => [...prev, { who: 'user', text, t: nowTime(), stage }]);
      setComposerDraft('');
      const hintFileId = pendingHintForFileId.current;
      if (hintFileId) {
        pendingHintForFileId.current = null;
        const idx = files.findIndex(f => f.id === hintFileId);
        if (idx > 0) {
          const candidate = files[idx];
          const prevSchema = mergedSchema(files.slice(0, idx), merges.slice(0, idx));
          const result = classify(prevSchema, candidate, text);
          if (result && result.kind !== 'refused') {
            setFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: 'parsed' } : f));
            setMerges(prev => { const next = prev.slice(); next[idx - 1] = result; return next; });
            setAssumptions(prev => blankAssumptionsForFile(candidate, prev));
            setMergeRevision(r => r + 1);
            setStreaming(true);
            setTimeout(() => {
              const keyStr = result.keys
                ? result.keys.map(p => p[0] === p[1] ? p[0] : (p[0] + ' ↔ ' + p[1])).join(' and ')
                : 'shared schema';
              streamMessage(
                setMessages,
                "Got it — accepted " + candidate.name + " as a join on `" + keyStr + "`.",
                () => setStreaming(false),
                undefined,
                stage
              );
            }, 350);
            return;
          }
        }
      }
      setStreaming(true);
      setTimeout(() => {
        const reply = generateReply(text, stage);
        streamMessage(setMessages, reply, () => setStreaming(false), undefined, stage);
      }, 500);
    };

    // Demo presets — Tweaks panel (Upload page only).
    const applyPreset = (name) => {
      const snap = buildDemoState(name);
      // Write the full snapshot, clear chat, then navigate to the
      // snapshot's stage so the destination hydrates it.
      Store.save({
        files: snap.files,
        merges: snap.merges,
        assumptions: snap.assumptions,
        mergeRevision: snap.mergeRevision,
        mergeRevisionAtDomainEntry: snap.mergeRevisionAtDomainEntry,
        testCases: INITIAL_TEST_CASES.map((tc) => ({ ...tc, predicted: null, confidence: null })),
        messages: [],
        shownIntros: [],
        targetCol: null,
        runDone: false,
        hasTested: false,
        predictInputs: {},
        predictResult: null,
        lastPredictedTargetKey: null,
        stage: snap.stage,
        maxStage: snap.maxStage,
      });
      Store.go(snap.stage);
    };

    const onTargetChanged = (newKey, oldKey) => {
      if (!newKey || newKey === oldKey) return;
      const flatCols = [
        ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, key: 'shared:' + c.name })),
        ...schema.groups.flatMap(g => g.columns.map(c => ({ name: c.name, type: c.type, key: g.fileId + ':' + c.name }))),
      ];
      const newCol = flatCols.find(c => c.key === newKey);
      if (!newCol) return;
      const t = inferTaskType(newCol);
      const summary = buildSetupSummary(schema, newKey, {
        prefix: "Got it — predicting **" + newCol.name + "** instead. This is now a **" + t.kind + "** task, so I'll use **" + t.metric + "** as the metric.\n\n",
      });
      setStreaming(true);
      setTimeout(() => {
        streamMessage(setMessages, summary, () => setStreaming(false), 10, stage);
      }, 200);
    };

    // AutoML run animation — runs on the Run page when not yet done.
    React.useEffect(() => {
      if (PAGE_STAGE !== 4 || runDone) return;
      let i = 0;
      let elapsed = 0;
      const total = AUTOML_STEPS.reduce((s, x) => s + x.t, 0);
      let cancelled = false;
      function next() {
        if (cancelled || i >= AUTOML_STEPS.length) {
          if (!cancelled) {
            setRunProgress(100);
            setRunDone(true);
          }
          return;
        }
        setRunActive(i);
        const step = AUTOML_STEPS[i];
        const start = elapsed;
        const startTime = Date.now();
        const tick = setInterval(() => {
          if (cancelled) { clearInterval(tick); return; }
          const t = Date.now() - startTime;
          const pct = Math.min(100, Math.round((start + Math.min(t, step.t)) / total * 100));
          setRunProgress(pct);
          if (t >= step.t) {
            clearInterval(tick);
            elapsed += step.t;
            i++;
            next();
          }
        }, 80);
      }
      next();
      return () => { cancelled = true; };
    }, []);

    const testItOut = () => {
      setHasTested(true);
      setTestCases((prev) => prev.map((tc) => ({
        ...tc,
        predicted: tc.expected,
        confidence: 0.7 + Math.random() * 0.25
      })));
    };

    return (
      <>
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">G</div>
            <span>GLAMLI</span>
            {topbarLabel && (
              <span className="muted small" style={{ marginLeft: 6, fontWeight: 400 }}>
                · building <span className="mono">{topbarLabel}</span>
              </span>
            )}
          </div>
          <div className="topbar-meta">
            <span className="row" style={{ gap: 6 }}>
              <span className="pill-dot" style={{ background: 'var(--good)' }}></span>
              session synced
            </span>
            <span>·</span>
            <span>auto-saved</span>
          </div>
        </div>

        <div className="app-shell">
          <ChatPanel
            stage={stage}
            messages={messages}
            onSend={onSend}
            streaming={streaming}
            composerDraft={composerDraft}
            onComposerDraftChange={setComposerDraft} />

          <main className="panel" style={{ borderRight: 'none' }}>
            <WorkflowRail stage={stage} maxStage={maxStage} setStage={railSetStage} />
            <div className="panel-body">
              <div className={"workflow-body" + (stage === 3 ? ' wide' : '')}>
                {stage === 1 &&
                  <StageUpload
                    files={files}
                    merges={merges}
                    onUpload={startUploadFixture}
                    onChangeMergeKeys={onChangeMergeKeys}
                    onRemoveFile={onRemoveFile}
                    onExplainInChat={onExplainInChat}
                    onNext={() => advance(2)} />
                }
                {stage === 2 &&
                  <StageDomain
                    schema={schema}
                    assumptions={assumptions}
                    setAssumptions={setAssumptions}
                    targetCol={targetCol}
                    setTargetCol={setTargetCol}
                    onNext={() => advance(3)} />
                }
                {stage === 3 &&
                  <StageSetup
                    schema={schema}
                    files={files}
                    targetCol={targetCol}
                    assumptions={assumptions}
                    onSeedComposer={onSeedComposer}
                    onNext={() => advance(4)} />
                }
                {stage === 4 &&
                  <StageRun
                    progress={runProgress}
                    done={runDone}
                    activeIdx={runActive}
                    onTestIt={testItOut}
                    hasTested={hasTested}
                    onAdvancePredict={() => advance(5)} />
                }
                {stage === 5 &&
                  <StagePredict
                    schema={schema}
                    files={files}
                    targetCol={targetCol}
                    predictInputs={predictInputs}
                    setPredictInputs={setPredictInputs}
                    predictResult={predictResult}
                    setPredictResult={setPredictResult}
                    setLastPredictedTargetKey={setLastPredictedTargetKey}
                    runDone={runDone}
                    setStage={railSetStage} />
                }
              </div>
            </div>
          </main>
        </div>

        {stage === 1 && (
          <TweaksPanel title="Tweaks">
            <TweakSection title="Demo states">
              <TweakSelect
                label="Upload preset"
                value=""
                onChange={(v) => v && applyPreset(v)}
                options={[{ value: '', label: '— pick a state —' }, ...UPLOAD_PRESETS]} />
            </TweakSection>
          </TweaksPanel>
        )}
      </>
    );
  };
}

window.makePageApp = makePageApp;
