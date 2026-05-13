// Workflow panel — 5 stages
const STAGES = [
  { num: 1, key: 'upload', title: 'Data upload', short: 'Upload' },
  { num: 2, key: 'domain', title: 'Domain knowledge', short: 'Domain' },
  { num: 3, key: 'tests', title: 'Test cases', short: 'Tests' },
  { num: 4, key: 'review', title: 'Custom ML task review', short: 'Review' },
  { num: 5, key: 'run', title: 'AutoML execution', short: 'Run' },
];

function WorkflowRail({ stage, maxStage, setStage }) {
  return (
    <div className="workflow-rail">
      {STAGES.map((s) => {
        const complete = s.num < maxStage;
        const active = s.num === stage;
        const disabled = s.num > maxStage;
        return (
          <button
            key={s.key}
            className={"rail-item " + (active ? "active " : "") + (complete ? "complete" : "")}
            onClick={() => !disabled && setStage(s.num)}
            disabled={disabled}
          >
            <span className="rail-num">{complete ? <Icon name="check" size={11}/> : s.num}</span>
            <span>{s.short}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Stage 1: Upload (multi-CSV) ----
//
// Props
//   files, merges                — state
//   onUpload(fixtureName)        — appends a pending file, runs parse + classify
//   onChangeMergeKeys(idx, keys) — picker callback
//   onRemoveFile(fileId)         — removes a file (and its merge entry)
//   onSeedComposer(text, fileId) — escape-hatch seed for the chat composer
//   onNext                       — primary CTA
//
// The "Upload CSV" empty dropzone offers the user a choice of fixtures
// (a hand-rolled mini menu, since this is a prototype with mock files).
// The subordinate dropzone shows after at least one file is present.

const FIXTURE_PICKER_ORDER = ['customer_churn', 'support_tickets', 'sales_2023', 'sales_2024', 'weather_2023'];

function StageUpload({ files, merges, onUpload, onChangeMergeKeys, onRemoveFile, onExplainInChat, onNext }) {
  const [pickerOpen, setPickerOpen] = React.useState(null);  // 'main' | 'sub' | null
  const pickerRef = React.useRef(null);

  React.useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const pickFixture = (fixtureName) => {
    setPickerOpen(null);
    onUpload(fixtureName);
  };

  const availableFixtures = FIXTURE_PICKER_ORDER.filter(name => {
    const fname = FILE_FIXTURES[name].name;
    return !files.some(f => f.name === fname);
  });

  // A file is "ready" once it has a status and no `_pending` flag.
  const allSettled = files.every(f => !f._pending);
  const parsedFiles = files.filter(f => f.status === 'parsed' && !f._pending);
  const lastParsedFile = parsedFiles[parsedFiles.length - 1];
  const anyRefused = files.some(f => f.status === 'refused');
  // The user must resolve any refused file (Remove this file, or fix it
  // via the Explain-in-chat path) before continuing — otherwise the
  // refused card is left dangling on the page.
  const canContinue = files.length >= 1 && allSettled && parsedFiles.length >= 1 && !anyRefused;

  // Refusal banners — one per refused file, in chronological order.
  // Rendered at the top of the page so the message is visible
  // immediately; the inline relationship strip is suppressed for
  // refused merges below.
  const refusalBanners = files
    .map((file, i) => ({ file, i }))
    .filter(({ file }) => file.status === 'refused')
    .map(({ file, i }) => ({ file, prevFile: i > 0 ? files[i - 1] : null }));

  // Most-recent parsed-merge banner (join or concat). Surfaced at the
  // top of the page just like the refusal banner. The inline strip for
  // this same merge is suppressed below to avoid duplication.
  let topMergeBannerIdx = -1;
  for (let i = files.length - 1; i >= 1; i--) {
    const m = merges[i - 1];
    if (files[i].status === 'parsed' && !files[i]._pending && m && m.kind !== 'refused') {
      topMergeBannerIdx = i;
      break;
    }
  }
  const topMergeBanner = topMergeBannerIdx > 0 ? {
    merge: merges[topMergeBannerIdx - 1],
    leftFile: files[topMergeBannerIdx - 1],
    rightFile: files[topMergeBannerIdx],
    mergeIndex: topMergeBannerIdx - 1,
  } : null;

  return (
    <div>
      <div className="stage-eyebrow">Stage 1 of 5</div>
      <h1 className="stage-title">Let's start with your data.</h1>
      <p className="stage-lede">
        Upload one or more CSVs. I'll parse each, describe what's inside, and check if they can be joined or stacked into a single training table.
      </p>

      {refusalBanners.map(({ file, prevFile }) => (
        <React.Fragment key={'refusal-' + file.id}>
          <div className="rel-strip refused" style={{ marginBottom: 14 }}>
            <div className="rel-strip-row">
              <span className="rel-strip-info">
                <Icon name="x" size={14}/>
                Couldn't combine{' '}
                <span className="mono">{file.name}</span>
                {prevFile && <>{' with '}<span className="mono">{prevFile.name}</span></>}
              </span>
            </div>
          </div>
          <FileCard
            file={file}
            variant="refused"
            onRemove={() => onRemoveFile(file.id)}
          />
          <RefusalExplanation
            file={file}
            prevFile={prevFile}
            onRemove={() => onRemoveFile(file.id)}
            onExplainInChat={() => onExplainInChat(file.id)}
          />
        </React.Fragment>
      ))}

      {topMergeBanner && (
        <div style={{ marginBottom: 14 }}>
          <RelationshipStrip
            merge={topMergeBanner.merge}
            leftFile={topMergeBanner.leftFile}
            rightFile={topMergeBanner.rightFile}
            onChangeKey={(newKeys) => onChangeMergeKeys(topMergeBanner.mergeIndex, newKeys)}
          />
        </div>
      )}

      {files.length === 0 && (
        <div style={{ position: 'relative' }} ref={pickerOpen === 'main' ? pickerRef : null}>
          <div className="dropzone" onClick={() => setPickerOpen('main')}>
            <div style={{ marginBottom: 12, color: 'var(--text-3)' }}>
              <Icon name="database" size={28}/>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Drop a CSV file here</div>
            <div className="muted small" style={{ marginBottom: 16 }}>or click to browse — up to 50&nbsp;MB</div>
            <button
              className="btn btn-sm"
              onClick={(e) => { e.stopPropagation(); setPickerOpen('main'); }}
            >
              Upload CSV
            </button>
          </div>
          {pickerOpen === 'main' && (
            <FixtureMenu fixtures={availableFixtures} onPick={pickFixture} />
          )}
        </div>
      )}

      {files.map((file, i) => {
        // Refused files are rendered at the top under their banner.
        if (file.status === 'refused') return null;

        const variant = file._pending === 'classifying' ? 'classifying' : 'full';
        const leftFile = i > 0 ? files[i - 1] : null;
        const merge = i > 0 ? merges[i - 1] : null;
        const showInlineStrip =
          merge && merge.kind !== 'refused' && i !== topMergeBannerIdx;

        return (
          <React.Fragment key={file.id}>
            {showInlineStrip && (
              <RelationshipStrip
                merge={merge}
                leftFile={leftFile}
                rightFile={file}
                onChangeKey={(newKeys) => onChangeMergeKeys(i - 1, newKeys)}
              />
            )}
            <FileCard
              file={file}
              variant={variant}
              onRemove={i > 0 ? () => onRemoveFile(file.id) : undefined}
            />
          </React.Fragment>
        );
      })}

      {parsedFiles.length >= 1 && availableFixtures.length > 0 && allSettled && (
        <div style={{ position: 'relative' }} ref={pickerOpen === 'sub' ? pickerRef : null}>
          <div
            className="dropzone uploaded subordinate"
            onClick={() => setPickerOpen('sub')}
          >
            <div className="sub-icon"><Icon name="plus" size={16}/></div>
            <div className="col" style={{ gap: 2 }}>
              <span className="sub-text">+ Add another CSV</span>
              <span className="sub-hint">
                I'll check if it can be joined or stacked with{' '}
                <span className="mono">{lastParsedFile.name}</span>
              </span>
            </div>
          </div>
          {pickerOpen === 'sub' && (
            <FixtureMenu fixtures={availableFixtures} onPick={pickFixture} />
          )}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
        <button className="btn btn-primary" disabled={!canContinue} onClick={onNext}>
          {parsedFiles.length >= 2
            ? <>Combine and continue <Icon name="arrow-right" size={14}/></>
            : parsedFiles.length === 1
              ? <>Continue with <span className="mono" style={{ color: 'inherit' }}>{parsedFiles[0].name}</span> <Icon name="arrow-right" size={14}/></>
              : <>Continue <Icon name="arrow-right" size={14}/></>}
        </button>
      </div>
    </div>
  );
}

// Tiny fixture picker — used twice (main + subordinate dropzone).
function FixtureMenu({ fixtures, onPick }) {
  return (
    <div
      className="card"
      style={{
        position: 'absolute', zIndex: 5, top: 'calc(100% + 6px)', left: '50%',
        transform: 'translateX(-50%)',
        minWidth: 320, padding: 6,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div className="small muted" style={{ padding: '6px 10px 8px', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, fontSize: 11 }}>
        Pick a sample file
      </div>
      {fixtures.map(name => {
        const f = FILE_FIXTURES[name];
        return (
          <button
            key={name}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', height: 'auto', padding: '8px 10px' }}
            onClick={() => onPick(name)}
          >
            <Icon name="document" size={14}/>
            <span className="col" style={{ gap: 0, alignItems: 'flex-start' }}>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--accent-ink)' }}>{f.name}</span>
              <span className="small muted" style={{ fontWeight: 400 }}>
                {f.rows.toLocaleString()} rows · {f.cols} columns
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RefusalExplanation({ file, prevFile, onRemove, onExplainInChat }) {
  const candCols = file.columns.map(c => c.name);
  const prevCols = (prevFile ? prevFile.columns : []).map(c => c.name);
  const shared = candCols.filter(n => prevCols.includes(n));

  return (
    <div className="card card-pad refusal-explain">
      <p>
        These files don't share columns or matching values. I checked{' '}
        <span className="mono">{prevFile ? prevFile.name : 'the existing dataset'}</span>{' '}
        against <span className="mono">{file.name}</span>{' '}
        and found {shared.length === 0 ? 'no shared column names' : `only ${shared.length} shared name(s)`}{' '}
        that would let me join or stack them.
      </p>
      <details className="">
        <summary>Show what I checked</summary>
        <div className="refusal-explain-cols" style={{ marginTop: 8 }}>
          <div>
            <div className="col-head">{prevFile ? prevFile.name : 'existing'}</div>
            <ul>{prevCols.map(n => <li key={n}>{n}</li>)}</ul>
          </div>
          <div>
            <div className="col-head">{file.name}</div>
            <ul>{candCols.map(n => <li key={n}>{n}</li>)}</ul>
          </div>
        </div>
      </details>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn" onClick={onExplainInChat}>
          <Icon name="chat" size={13}/> Explain in chat
        </button>
        <button className="btn btn-primary" onClick={onRemove}>
          Remove this file
        </button>
      </div>
    </div>
  );
}

// ---- Stage 2: Domain knowledge (single merged dataset) ----
//
// By the time the user arrives here, all merging has happened on
// Upload. Domain treats the result as one flat list of columns — no
// per-source grouping, no Sources block, no role pills. The merged
// table is always presented under the same fixed demo filename.
//
// Props
//   schema                       — derived (rows, cols, groups, sharedColumns)
//   assumptions, setAssumptions  — keyed by `fileId:colName` or `shared:colName`
//                                  (kept this way so existing seed/migration
//                                  helpers keep working — Domain just flattens
//                                  the view, not the storage)
//   onNext

const MERGED_TABLE_NAME = 'business_churn_cleaned_v1.csv';

function StageDomain({
  schema,
  assumptions, setAssumptions,
  onNext,
}) {
  const updateAssumption = (key, idx, value) => {
    setAssumptions(prev => ({ ...prev, [key]: (prev[key] || []).map((a, i) => i === idx ? value : a) }));
  };
  const removeAssumption = (key, idx) => {
    setAssumptions(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== idx) }));
  };
  const addAssumption = (key) => {
    setAssumptions(prev => ({ ...prev, [key]: [...(prev[key] || []), 'New assumption — click to edit.'] }));
  };

  // Flatten the schema into one column list. Shared (concat) columns
  // come first, then every per-source group's columns in order. Join-
  // key duplicates were already squashed by mergedSchema.
  const flatCols = [
    ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, key: 'shared:' + c.name })),
    ...schema.groups.flatMap(g => g.columns.map(c => ({
      name: c.name, type: c.type, key: g.fileId + ':' + c.name,
    }))),
  ];

  // Validation — every visible column needs at least one non-empty assumption.
  const missingKeys = flatCols
    .map(c => c.key)
    .filter(k => {
      const list = assumptions[k] || [];
      return list.length === 0 || list.every(a => !a || !a.trim());
    });
  const ok = flatCols.length > 0 && missingKeys.length === 0;

  return (
    <div>
      <div className="stage-eyebrow">Stage 2 of 5</div>
      <h1 className="stage-title">What do you know about these columns?</h1>
      <p className="stage-lede">
        Dataset · <span className="mono">{MERGED_TABLE_NAME}</span>
        {flatCols.length > 0 && <> · {schema.rows.toLocaleString()} rows × {flatCols.length} columns</>}
      </p>
      <p className="stage-lede" style={{ marginTop: -16 }}>
        I've drafted plain-language assumptions for each column. Edit, delete, or add your own. This becomes the model's context.
      </p>

      {flatCols.length === 0 && (
        <div className="small muted" style={{ padding: '24px 0' }}>
          No data uploaded yet — go back to Upload to add a CSV.
        </div>
      )}

      {flatCols.map(col => (
        <ColumnAssumptionCard
          key={col.key}
          colKey={col.key}
          col={col}
          assumptions={assumptions}
          addAssumption={addAssumption}
          updateAssumption={updateAssumption}
          removeAssumption={removeAssumption}
        />
      ))}

      {/* Validation strip — sticky bottom */}
      {flatCols.length > 0 && (
        <div className="validation-strip">
          {ok ? (
            <span className="v-inline">
              <Icon name="check" size={14}/>
              {flatCols.length} of {flatCols.length} columns documented
            </span>
          ) : (
            <span className="v-inline">
              <Icon name="circle" size={14}/>
              {flatCols.length - missingKeys.length} of {flatCols.length} columns documented ·{' '}
              {missingKeys.length} still need a note
            </span>
          )}
          <button className="btn btn-primary btn-sm" disabled={!ok} onClick={onNext}>
            Continue to test cases <Icon name="arrow-right" size={14}/>
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnAssumptionCard({ colKey, col, rolePill, assumptions, addAssumption, updateAssumption, removeAssumption }) {
  return (
    <div className="col-card">
      <div className="col-head">
        <div>
          <span className="col-name">{col.name}</span>
          <span className="col-type" style={{ marginLeft: 10 }}>{col.type}</span>
          {rolePill}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => addAssumption(colKey)}>
          <Icon name="plus" size={13}/> Add
        </button>
      </div>
      {(assumptions[colKey] || []).map((a, i) => (
        <div className="assumption" key={i}>
          <span className="a-bullet">·</span>
          <textarea
            className="assumption-edit a-text"
            value={a}
            rows={1}
            onChange={(e) => {
              updateAssumption(colKey, i, e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
          />
          <div className="assumption-actions">
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeAssumption(colKey, i)} title="Delete">
              <Icon name="trash" size={13}/>
            </button>
          </div>
        </div>
      ))}
      {(!assumptions[colKey] || assumptions[colKey].length === 0) && (
        <div className="small muted" style={{ paddingTop: 4 }}>
          No note yet — click <span className="mono">Add</span> to write one.
        </div>
      )}
    </div>
  );
}

// ---- Stage 3: Test cases (Canvas) ----
//
// Renders the FlowchartPanel (the inputs → model → expected output
// canvas) as the whole Stage 3 surface, plus a bottom strip that hosts
// the Continue-to-Review button. No gate on the number of cases.

function StageTests({ testCases, setTestCases, modelLit, predictionsShown, onNext }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <FlowchartPanel
        testCases={testCases}
        setTestCases={setTestCases}
        modelLit={modelLit}
        predictionsShown={predictionsShown}
        embedded
      />
      <div
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elev)',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button className="btn btn-primary" onClick={onNext}>
          Continue to review <Icon name="arrow-right" size={14}/>
        </button>
      </div>
    </div>
  );
}

// ---- Stage 4: Review ----
function StageReview({ spec, setSpec, onNext }) {
  const update = (k) => (e) => setSpec(prev => ({ ...prev, [k]: e.target.value }));
  const fields = [
    { k: 'task_type', label: 'Task type' },
    { k: 'input_description', label: 'Input description' },
    { k: 'output_description', label: 'Output description' },
    { k: 'objective', label: 'Objective' },
    { k: 'metric', label: 'Evaluation metric' },
  ];
  return (
    <div>
      <div className="stage-eyebrow">Stage 4 of 5</div>
      <h1 className="stage-title">Here's the ML spec I drafted.</h1>
      <p className="stage-lede">I synthesized your assumptions and test cases into this. Every field is editable — fix anything that's off, then confirm.</p>

      <div className="card">
        {fields.map(f => (
          <div className="spec-field" key={f.k}>
            <div className="spec-label">{f.label}</div>
            <AutoTextarea className="spec-value" value={spec[f.k]} onChange={update(f.k)} />
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-ghost btn-sm">
          <Icon name="refresh" size={13}/> Regenerate from scratch
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Confirm & run AutoML <Icon name="play" size={13}/>
        </button>
      </div>
    </div>
  );
}

function AutoTextarea({ value, onChange, className }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      rows={1}
    />
  );
}

// ---- Stage 5: Run ----
function StageRun({ progress, done, activeIdx, onTestIt, hasTested }) {
  const [tab, setTab] = React.useState('overview');

  return (
    <div>
      <div className="stage-eyebrow">Stage 5 of 5</div>
      <h1 className="stage-title">{done ? 'Your model is ready.' : 'Training your model.'}</h1>
      <p className="stage-lede">
        {done
          ? "I tried 32 model configurations and picked the best one. Click below to test it on your cases."
          : "AutoML is exploring data prep strategies and model families. This usually takes 1–2 minutes."}
      </p>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={"tab " + (tab === 'overview' ? 'active' : '')} onClick={() => setTab('overview')}>Overview</button>
        <button className={"tab " + (tab === 'advanced' ? 'active' : '')} onClick={() => setTab('advanced')}>Advanced</button>
      </div>

      {tab === 'overview' && (done ? (
        <div className="loading-stage">
          <div style={{ width: 56, height: 56, margin: '0 auto 24px', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={26}/>
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Best model: <span className="mono">GradientBoostingClassifier</span></div>
          <div className="muted" style={{ marginBottom: 24 }}>F1-score on hold-out: <strong>0.847</strong> · trained in 12s</div>
          <button className="btn btn-primary" style={{ height: 44, padding: '0 22px', fontSize: 15, borderRadius: 10 }} onClick={onTestIt}>
            <Icon name="sparkle" size={16}/> {hasTested ? 'Re-run on test cases' : 'Test it Out!'}
          </button>
          {hasTested && <div className="muted small" style={{ marginTop: 16 }}>Predictions are showing on the flowchart →</div>}
        </div>
      ) : (
        <div>
          <div className="loading-stage" style={{ paddingBottom: 8 }}>
            <div className="loader" />
            <div className="muted">Running… {progress}%</div>
          </div>
          <div className="card card-pad">
            {AUTOML_STEPS.map((step, i) => {
              const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'idle';
              return (
                <div className={"status-line " + state} key={i}>
                  <span className="status-icon">
                    {state === 'done' ? <Icon name="check" size={14}/>
                      : state === 'active' ? <span className="typing-dot"/>
                      : <Icon name="circle" size={14}/>}
                  </span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {tab === 'advanced' && (
        <div className="col" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-pad" style={{ paddingBottom: 10, fontWeight: 600 }}>Model leaderboard</div>
            {(done ? MODEL_PLANS : []).sort((a,b) => b.score - a.score).map((p, i) => (
              <div className={"plan-row " + (p.best ? 'best' : '')} key={i}>
                <span className="muted small mono">#{i + 1}</span>
                <span className="plan-name">{p.name}</span>
                <span className="muted small">{p.time}</span>
                <span className="plan-score">{p.score.toFixed(3)}</span>
              </div>
            ))}
            {!done && (
              <div className="card-pad" style={{ paddingTop: 0 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} className="skel" style={{ height: 28, marginBottom: 8 }}/>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-pad" style={{ paddingBottom: 10, fontWeight: 600 }}>Data preparation plan</div>
            <div className="card-pad" style={{ paddingTop: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)' }}>
              <div>· Impute <span className="mono">support_tickets</span> missing values with median (n=12)</div>
              <div>· One-hot encode <span className="mono">contract_type</span>, <span className="mono">payment_method</span>, <span className="mono">plan_tier</span></div>
              <div>· Standardize <span className="mono">monthly_charges</span> and <span className="mono">avg_session_min</span></div>
              <div>· Stratified 80/20 train/test split on <span className="mono">churned</span></div>
            </div>
          </div>

          {done && (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-sm"><Icon name="download" size={13}/> Download source code</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { STAGES, WorkflowRail, StageUpload, StageDomain, StageTests, StageReview, StageRun });
