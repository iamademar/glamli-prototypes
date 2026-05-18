// Main App
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

function streamMessage(setMessages, fullText, onDone, chunkSize, stage) {
  // Append empty assistant message, then fill it in. `stage` is stamped
  // onto the bubble so the chat feed can filter by current stage.
  setMessages((prev) => [...prev, { who: 'assistant', text: '', t: nowTime(), stage: stage || null }]);
  let i = 0;
  // Default 3 chars/tick (~1s per 150-char reply); long pedagogical
  // replies can opt in to a larger chunk so the stream doesn't drag.
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

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Plain-language summary of the Stage 3 architecture, formatted for
// the chat. Used by the stage-3 intro AND by onTargetChanged so the
// chat always carries the current input list.
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
  // The chat renderer splits paragraphs on \n\n. Each bullet gets its
  // own paragraph so the column names stack vertically.
  const bulletInputs = inputs.map(c => '· `' + c.name + '`').join('\n\n');
  return (
    prefix +
    "It will look at **" + inputs.length + " things** about each row:" +
    "\n\n" + bulletInputs +
    "\n\nAnd it will predict: `" + targetEntry.name + "` (" + task.phrase + ")."
  );
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Default landing: stage 3 (Setup) with the join preset already
  // applied via the mount effect below. The grouped two-column
  // diagram is the canonical view for first-paint demos.
  const [stage, setStage] = React.useState(3);
  const [maxStage, setMaxStage] = React.useState(3);

  // Multi-CSV state (replaces the old `uploaded` boolean)
  const [files, setFiles] = React.useState([]);
  const [merges, setMerges] = React.useState([]);
  const [mergeRevision, setMergeRevision] = React.useState(0);
  const [mergeRevisionAtDomainEntry, setMergeRevisionAtDomainEntry] = React.useState(0);

  const [assumptions, setAssumptions] = React.useState({});
  const [testCases, setTestCases] = React.useState(INITIAL_TEST_CASES.map((tc) => ({ ...tc, predicted: null, confidence: null })));
  const [messages, setMessages] = React.useState([]);
  const [streaming, setStreaming] = React.useState(false);
  const [shownIntros, setShownIntros] = React.useState(new Set());

  // Composer seed (used by the refusal escape hatch)
  const [composerDraft, setComposerDraft] = React.useState('');
  const pendingHintForFileId = React.useRef(null);

  // Domain Sources collapse
  const [sourcesOpen, setSourcesOpen] = React.useState(true);

  // Target column (used by Stage 2 picker + Stage 3 architecture overview).
  // Keyed identically to assumption keys: `fileId:colName` or `shared:colName`.
  const [targetCol, setTargetCol] = React.useState(null);

  // Default landing has the join preset applied so the two-column
  // grouped diagram is the canonical view. Ref-guarded so it never
  // double-fires under StrictMode.
  const mountedRef = React.useRef(false);

  // Run-stage state
  const [runProgress, setRunProgress] = React.useState(0);
  const [runActive, setRunActive] = React.useState(0);
  const [runDone, setRunDone] = React.useState(false);
  const [hasTested, setHasTested] = React.useState(false);

  // Stage 5 (Predict) state.
  const [predictInputs, setPredictInputs] = React.useState({});
  const [predictResult, setPredictResult] = React.useState(null);
  const [lastPredictedTargetKey, setLastPredictedTargetKey] = React.useState(null);

  // Derived: schema and topbar copy
  const schema = React.useMemo(() => mergedSchema(files, merges), [files, merges]);
  const topbarLabel = topbarSubtitle(files);

  // Auto-default the target column whenever the schema changes. Also
  // catches the case where the file holding the current target has
  // been removed.
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

  // Stage 5 form: reconcile predictInputs against the live schema so
  // the form's fields track Upload/Domain edits. Drop orphan keys,
  // seed new keys from the first preview row of their source file,
  // and invalidate any stale prediction result when the target moves.
  React.useEffect(() => {
    if (schema.parsedCount === 0) {
      if (Object.keys(predictInputs).length) setPredictInputs({});
      if (predictResult) setPredictResult(null);
      return;
    }
    // Build the desired key set (non-target, non-joinKey-duplicate),
    // with each key paired to its source file for seeding.
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
    // Preserve existing values for keys that still exist.
    for (const k of Object.keys(predictInputs)) {
      if (desiredKeys.has(k)) next[k] = predictInputs[k];
      else changed = true;
    }
    // Seed new keys from firstPreviewValue.
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

  // Apply theme + density + accent to root
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = tweaks.theme;
    root.dataset.density = tweaks.density;
    const accent = ACCENTS[tweaks.accent] || ACCENTS.sage;
    Object.entries(accent).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [tweaks]);

  // Show stage intro on entering a new stage. Also captures the merge
  // revision the first time the user enters Domain (used for the
  // stale-merge warning). Stage 3's intro is synthesized inline because
  // it depends on the live schema + target.
  React.useEffect(() => {
    if (stage === 2 && mergeRevisionAtDomainEntry === 0) {
      setMergeRevisionAtDomainEntry(mergeRevision);
    }
    if (shownIntros.has(stage)) return;

    if (stage === 3) {
      // Synthesized intro — the full architecture summary. Fires once
      // per session for stage 3; further changes re-stream via
      // onTargetChanged below.
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

  const advance = (n) => {
    setStage(n);
    setMaxStage((prev) => Math.max(prev, n));
  };

  // ─── multi-CSV handlers ──────────────────────────────────────────

  const startUploadFixture = (fixtureName) => {
    const newFile = makeFile(fixtureName);
    newFile._pending = 'parsing';
    newFile._progress = 0;
    setFiles(prev => [...prev, newFile]);
  };

  // Drive a per-file parse animation. Pinned to a ref so the
  // useEffect doesn't restart on every state tick.
  const parsingFileIdRef = React.useRef(null);
  React.useEffect(() => {
    const parsing = files.find(f => f._pending === 'parsing');
    if (!parsing) { parsingFileIdRef.current = null; return; }
    if (parsingFileIdRef.current === parsing.id) return; // already animating this one
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
        // hand off to classify after a 220ms hold
        setTimeout(() => {
          if (cancelled) return;
          setFiles(prev => prev.map(f => f.id === targetId ? { ...f, _pending: 'classifying', _progress: 100 } : f));
        }, 220);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [files]);

  // Drive classification once a file's _pending flips to 'classifying'.
  const classifyingFileIdRef = React.useRef(null);
  React.useEffect(() => {
    const classifying = files.find(f => f._pending === 'classifying');
    if (!classifying) { classifyingFileIdRef.current = null; return; }
    if (classifyingFileIdRef.current === classifying.id) return;
    classifyingFileIdRef.current = classifying.id;

    const t = setTimeout(() => {
      // Compute classification + new file status outside any updater
      // so we don't tangle side-effects inside setFiles.
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
        // Log refusal AFTER the page card update commits.
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
      // Re-run a lightweight overlap calc using the right-file rows + left schema rows.
      const leftFile = files[idx];
      const rightFile = files[idx + 1];
      const overlap = leftFile && rightFile
        ? Math.round(Math.min(leftFile.rows, rightFile.rows) / Math.max(leftFile.rows, rightFile.rows) * 100)
        : cur.stats.overlap;
      next[idx] = {
        ...cur,
        keys: newKeys,
        stats: { ...cur.stats, overlap },
      };
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
      // When file at index `i` (i>=1) is removed, drop the merge at i-1.
      // When file 0 is removed, the chain shifts — drop merges[0].
      const idx = files.findIndex(f => f.id === fileId);
      if (idx <= 0) return prev.slice(1);
      return prev.filter((_, i) => i !== idx - 1);
    });
    // Also strip assumptions belonging to this file.
    setAssumptions(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(fileId + ':')) delete next[k]; });
      return next;
    });
    // If the current target lived on the removed file, clear it so the
    // schema effect re-defaults to a still-present column.
    if (targetCol && targetCol.startsWith(fileId + ':')) {
      setTargetCol(null);
    }
    setMergeRevision(r => r + 1);
  };

  const onSeedComposer = (text, fileId) => {
    setComposerDraft(text);
    if (fileId) pendingHintForFileId.current = fileId;
  };

  // Refusal escape hatch: "Explain in chat" — posts a user bubble
  // asking the question, streams the long pedagogical assistant reply,
  // and arms the re-classify hint so the user's next message gets
  // treated as a relationship hint.
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

    // Escape-hatch — re-classify the targeted file with the user's hint.
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
        // Still refused — fall through to canned reply.
      }
    }

    setStreaming(true);
    setTimeout(() => {
      const reply = generateReply(text, stage);
      streamMessage(setMessages, reply, () => setStreaming(false), undefined, stage);
    }, 500);
  };

  // Demo presets — Tweaks panel "Demo states" section.
  const applyPreset = (name) => {
    const snap = buildDemoState(name);
    setFiles(snap.files);
    setMerges(snap.merges);
    setAssumptions(snap.assumptions);
    setStage(snap.stage);
    setMaxStage(snap.maxStage);
    setMergeRevision(snap.mergeRevision);
    setMergeRevisionAtDomainEntry(snap.mergeRevisionAtDomainEntry);
    setShownIntros(new Set());
    setMessages([]);
    setStreaming(false);
    setComposerDraft('');
    pendingHintForFileId.current = null;
    // Target defaults via the [schema] effect on next tick.
    setTargetCol(null);
  };

  // Apply the join preset once on first mount so the user lands on
  // Stage 3 with the grouped two-column diagram already populated.
  React.useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    applyPreset('upload_join');
    // applyPreset writes stage:1 from the preset snapshot; override
    // to land directly on Setup.
    setStage(3);
    setMaxStage(3);
  }, []);

  // Chat narration for target changes. Streams a short ack, then the
  // refreshed full architecture summary (same shape as the stage-3
  // entry bubble) so the chat history always carries the current
  // input list.
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

  // AutoML run animation
  React.useEffect(() => {
    if (stage !== 4 || runDone) return;
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
        if (cancelled) {clearInterval(tick);return;}
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
    return () => {cancelled = true;};
  }, [stage]);

  const testItOut = () => {
    setHasTested(true);
    setTestCases((prev) => prev.map((tc) => ({
      ...tc,
      predicted: tc.expected, // demo: mostly matches
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
          <WorkflowRail stage={stage} maxStage={maxStage} setStage={setStage} />
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
                  setStage={setStage} />
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
    </>);

}

// Long pedagogical reply for the "Explain in chat" escape hatch on the
// Upload refusal panel. File and column names are inlined so the copy
// reads as specific to whatever pair the user is looking at.
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);