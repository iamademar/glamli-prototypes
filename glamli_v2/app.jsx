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

function streamMessage(setMessages, fullText, onDone, chunkSize) {
  // Append empty assistant message, then fill it in
  setMessages((prev) => [...prev, { who: 'assistant', text: '', t: nowTime() }]);
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

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [stage, setStage] = React.useState(1);
  const [maxStage, setMaxStage] = React.useState(1);

  // Multi-CSV state (replaces the old `uploaded` boolean)
  const [files, setFiles] = React.useState([]);
  const [merges, setMerges] = React.useState([]);
  const [mergeRevision, setMergeRevision] = React.useState(0);
  const [mergeRevisionAtDomainEntry, setMergeRevisionAtDomainEntry] = React.useState(0);

  const [assumptions, setAssumptions] = React.useState({});
  const [testCases, setTestCases] = React.useState(INITIAL_TEST_CASES.map((tc) => ({ ...tc, predicted: null, confidence: null })));
  const [spec, setSpec] = React.useState(INITIAL_SPEC);
  const [messages, setMessages] = React.useState([]);
  const [streaming, setStreaming] = React.useState(false);
  const [shownIntros, setShownIntros] = React.useState(new Set());

  // Composer seed (used by the refusal escape hatch)
  const [composerDraft, setComposerDraft] = React.useState('');
  const pendingHintForFileId = React.useRef(null);

  // Domain Sources collapse
  const [sourcesOpen, setSourcesOpen] = React.useState(true);

  // Run-stage state
  const [runProgress, setRunProgress] = React.useState(0);
  const [runActive, setRunActive] = React.useState(0);
  const [runDone, setRunDone] = React.useState(false);
  const [hasTested, setHasTested] = React.useState(false);

  // Derived: schema and topbar copy
  const schema = React.useMemo(() => mergedSchema(files, merges), [files, merges]);
  const topbarLabel = topbarSubtitle(files);

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
  // stale-merge warning).
  React.useEffect(() => {
    if (stage === 2 && mergeRevisionAtDomainEntry === 0) {
      setMergeRevisionAtDomainEntry(mergeRevision);
    }
    if (shownIntros.has(stage)) return;
    const intro = STAGE_INTROS[stage];
    if (!intro) return;
    setShownIntros((prev) => new Set(prev).add(stage));
    setStreaming(true);
    streamMessage(setMessages, intro[0].text, () => setStreaming(false));
  }, [stage]);

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
            () => setStreaming(false)
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
    setMessages(prev => [...prev, { who: 'user', text: userQ, t: nowTime() }]);
    setStreaming(true);
    setTimeout(() => {
      streamMessage(setMessages, reply, () => setStreaming(false), 10);
    }, 400);
  };

  const onSend = (text) => {
    setMessages((prev) => [...prev, { who: 'user', text, t: nowTime() }]);
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
              () => setStreaming(false)
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
      streamMessage(setMessages, reply, () => setStreaming(false));
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
  };

  // AutoML run animation
  React.useEffect(() => {
    if (stage !== 5 || runDone) return;
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
          {stage === 3 ? (
            // Stage 3 (Tests) renders the Canvas full-width — bypass the
            // .workflow-body wrapper so the 820-wide canvas can breathe.
            <StageTests
              testCases={testCases}
              setTestCases={setTestCases}
              modelLit={runDone && hasTested}
              predictionsShown={hasTested}
              onNext={() => advance(4)} />
          ) : (
            <div className="panel-body">
              <div className="workflow-body">
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
                    onNext={() => advance(3)} />
                }
                {stage === 4 &&
                  <StageReview
                    spec={spec}
                    setSpec={setSpec}
                    onNext={() => advance(5)} />
                }
                {stage === 5 &&
                  <StageRun
                    progress={runProgress}
                    done={runDone}
                    activeIdx={runActive}
                    onTestIt={testItOut}
                    hasTested={hasTested} />
                }
              </div>
            </div>
          )}
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        {stage === 1 && (
          <TweakSection title="Demo states">
            <TweakSelect
              label="Upload preset"
              value=""
              onChange={(v) => v && applyPreset(v)}
              options={[{ value: '', label: '— pick a state —' }, ...UPLOAD_PRESETS]} />
          </TweakSection>
        )}
      </TweaksPanel>
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