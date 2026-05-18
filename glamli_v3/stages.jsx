// Workflow panel — 5 stages
const STAGES = [
  { num: 1, key: 'upload', title: 'Data upload', short: 'Upload' },
  { num: 2, key: 'domain', title: 'Domain knowledge', short: 'Domain' },
  { num: 3, key: 'setup', title: 'Architecture setup', short: 'Setup' },
  { num: 4, key: 'run', title: 'AutoML execution', short: 'Run' },
  { num: 5, key: 'predict', title: 'Predict on a row', short: 'Predict' },
];

// renderInlineCode — render a string containing `code` spans as a
// React fragment with the right `.mono` spans. Used by the Stage 3
// data-prep tooltip copy.
function renderInlineCode(text) {
  if (!text) return null;
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) {
      return <span key={i} className="mono" style={{ color: 'var(--accent-ink)' }}>{p.slice(1, -1)}</span>;
    }
    return p;
  });
}

// humanizeColumnName — turn a snake_case column id into a Title Case
// label. e.g. customer_id → "Customer Id"; avg_resolution_hours →
// "Avg Resolution Hours". Used by Stage 5's form labels.
function humanizeColumnName(name) {
  if (!name) return '';
  return String(name)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

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
  targetCol, setTargetCol,
  onChangeColType,
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

  // Flatten the schema. Carry the `role` field (e.g. 'joinKey') through
  // so the target picker can filter join keys out of the pill grid.
  const flatCols = [
    ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, role: 'normal', key: 'shared:' + c.name })),
    ...schema.groups.flatMap(g => g.columns.map(c => ({
      name: c.name, type: c.type, role: c.role || 'normal', key: g.fileId + ':' + c.name,
    }))),
  ];
  const targetableCols = flatCols.filter(c => c.role !== 'joinKey');

  // Validation — every visible column needs at least one non-empty assumption,
  // AND a target must be chosen.
  const missingKeys = flatCols
    .map(c => c.key)
    .filter(k => {
      const list = assumptions[k] || [];
      return list.length === 0 || list.every(a => !a || !a.trim());
    });
  const allDocumented = flatCols.length > 0 && missingKeys.length === 0;
  const ok = allDocumented && !!targetCol;

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
          rolePill={col.key === targetCol ? <span className="role-pill">target</span> : null}
          assumptions={assumptions}
          addAssumption={addAssumption}
          updateAssumption={updateAssumption}
          removeAssumption={removeAssumption}
          onChangeColType={onChangeColType}
        />
      ))}

      {/* Target picker — pill row of every non-join-key column */}
      {targetableCols.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 18, marginBottom: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>What do you want to predict?</div>
          <div className="small muted" style={{ marginBottom: 12 }}>
            Pick the column the model should learn to predict.
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {targetableCols.map(col => {
              const active = col.key === targetCol;
              return (
                <button
                  key={col.key}
                  className={"pill " + (active ? 'good' : '')}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    padding: '4px 10px',
                  }}
                  onClick={() => setTargetCol(col.key)}
                >
                  {active && <Icon name="check" size={11}/>}
                  <span className="mono" style={{ color: 'inherit' }}>{col.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation strip — sticky bottom */}
      {flatCols.length > 0 && (
        <div className="validation-strip">
          {!targetCol ? (
            <span className="v-inline">
              <Icon name="circle" size={14}/>
              Pick a target column to continue
            </span>
          ) : allDocumented ? (
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
            Continue to setup <Icon name="arrow-right" size={14}/>
          </button>
        </div>
      )}
    </div>
  );
}

const COLUMN_TYPES = ['numeric', 'categorical', 'boolean'];

function ColumnAssumptionCard({ colKey, col, rolePill, assumptions, addAssumption, updateAssumption, removeAssumption, onChangeColType }) {
  return (
    <div className="col-card">
      <div className="col-head">
        <div>
          <span className="col-name">{col.name}</span>
          {onChangeColType ? (
            <select
              className="col-type-select"
              style={{ marginLeft: 10 }}
              value={col.type}
              title="Change this column's type"
              onChange={(e) => onChangeColType(colKey, e.target.value)}
            >
              {COLUMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : (
            <span className="col-type" style={{ marginLeft: 10 }}>{col.type}</span>
          )}
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

// ---- Stage 3: Setup (architecture overview) ----
//
// Read-only summary of how the model will be built. Inputs and target
// are visualised; the target is the only editable affordance (via a
// dropdown on the output node). Replaces the previous test-case
// authoring canvas — see plan §1 for the rationale.

function StageSetup({ schema, files, targetCol, assumptions, onSeedComposer, onNext }) {
  assumptions = assumptions || {};
  // Model-explainer modal (opened by clicking the MODEL node).
  const [modelModalOpen, setModelModalOpen] = React.useState(false);

  // Esc-key closes the model modal.
  React.useEffect(() => {
    if (!modelModalOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setModelModalOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modelModalOpen]);

  // Build a flat column list with role + key, mirroring the structure
  // used on Domain so target keys round-trip across stages.
  const flatCols = [
    ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, role: 'normal', key: 'shared:' + c.name })),
    ...schema.groups.flatMap(g => g.columns.map(c => ({
      name: c.name, type: c.type, role: c.role || 'normal', key: g.fileId + ':' + c.name,
    }))),
  ];

  if (flatCols.length === 0) {
    return (
      <div>
        <div className="stage-eyebrow">Stage 3 of 5</div>
        <h1 className="stage-title">Here's how your model will work.</h1>
        <p className="stage-lede">No data uploaded yet — go back to Upload to add a CSV.</p>
      </div>
    );
  }

  const targetEntry = flatCols.find(c => c.key === targetCol) || flatCols[flatCols.length - 1];
  const inputCols = flatCols.filter(c => c.key !== targetEntry.key && c.role !== 'joinKey');
  const currentTask = inferTaskType(targetEntry);

  // Group input columns by source file so the diagram can render
  // one column per CSV under a filename header. For concat schemas
  // (no schema.groups), fall back to a single "Shared across sources"
  // column.
  //
  // Join keys: mergedSchema flags the right-side copy of each join key
  // with role:'joinKey'. We drop those duplicates and instead tag the
  // matching column on the left-side file with isJoinKey, so the key
  // appears under the left file only with a "join key" pill.
  const joinKeyNames = new Set(
    schema.groups.flatMap(g => g.columns.filter(c => c.role === 'joinKey').map(c => c.name))
  );
  const filesByName = new Map(files.map(f => [f.name, f]));
  const inputGroups = schema.groups.length > 0
    ? schema.groups
        .map(g => {
          const sourceFile = filesByName.get(g.name);
          return {
            key: g.fileId,
            title: g.name,
            mono: true,
            cols: g.columns
              // Drop right-side duplicates flagged as joinKey by mergedSchema.
              .filter(c => c.role !== 'joinKey')
              .map(c => ({
                ...c,
                key: g.fileId + ':' + c.name,
                isJoinKey: joinKeyNames.has(c.name),
                sourceName: g.name,
                prepNote: getPrepNote(c.name, sourceFile),
              }))
              .filter(c => c.key !== targetEntry.key),
          };
        })
        .filter(g => g.cols.length > 0)
    : [{
        key: 'shared',
        title: 'Shared across sources',
        mono: false,
        cols: schema.sharedColumns
          .map(c => ({
            ...c,
            role: 'normal',
            key: 'shared:' + c.name,
            isJoinKey: false,
            sourceName: 'Shared across sources',
            prepNote: getPrepNote(c.name, files.find(f => f.status === 'parsed')),
          }))
          .filter(c => c.key !== targetEntry.key),
      }].filter(g => g.cols.length > 0);

  const explain = () => {
    const sourceNames = files
      .filter(f => f.status === 'parsed')
      .map(f => f.name)
      .join(', ');
    onSeedComposer(
      "Something looks off. The model is set up to use these " + inputCols.length +
      " inputs from " + (sourceNames || 'the dataset') +
      " to predict " + targetEntry.name + ". Here's what I'd change: ",
      null
    );
  };

  // Canvas geometry — input nodes laid out as one column per source
  // file. Headers sit above each column.
  const NODE_W        = 168;
  const NODE_H        = 56;
  const INPUT_GAP     = 14;   // vertical between nodes in a column
  const COL_BLOCK_GAP = 32;   // horizontal between source columns
  const COL_GAP       = 100;  // horizontal inputs → model and model → output
  const HEADER_H      = 28;   // height reserved above each input column
  const PAD_TOP       = HEADER_H + 12;

  const groupCount   = Math.max(inputGroups.length, 1);
  const inputBlockW  = groupCount * NODE_W + (groupCount - 1) * COL_BLOCK_GAP;
  const tallestColLen = inputGroups.reduce((m, g) => Math.max(m, g.cols.length), 0) || 1;
  const inputBlockH   = tallestColLen * NODE_H + (tallestColLen - 1) * INPUT_GAP;
  const H = PAD_TOP + Math.max(inputBlockH, NODE_H) + PAD_TOP;

  const xModel   = inputBlockW + COL_GAP;
  const xOutput  = xModel + NODE_W + COL_GAP;
  const W        = xOutput + NODE_W;
  const modelY   = PAD_TOP + inputBlockH / 2 - NODE_H / 2;
  const outputY  = modelY;

  return (
    <div>
      <div className="stage-eyebrow">Stage 3 of 5</div>
      <h1 className="stage-title">Here's how your model will work.</h1>

      <p className="stage-lede">
        The summary of inputs and the prediction target now lives in the chat on the left. Use the diagram below to learn about the setup.
      </p>

      {/* Schema diagram — values-free. Breaks out of .workflow-body to
       * span the full right-hand panel; the page text + buttons stay in
       * the narrow column above and below. */}
      <div
        className="flow-canvas fullwidth"
        style={{ height: H, marginBottom: 18 }}
      >
        <svg className="flow-svg" style={{ width: W, height: H, position: 'absolute', left: '50%', transform: 'translateX(-50%)', overflow: 'visible' }}>
          <defs>
            <marker id="setup-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--accent)" />
            </marker>
          </defs>
          {inputGroups.flatMap((g, gi) => {
            const xCol = gi * (NODE_W + COL_BLOCK_GAP);
            const fx = xCol + NODE_W;
            return g.cols.map((_, i) => {
              const fy = PAD_TOP + i * (NODE_H + INPUT_GAP) + NODE_H / 2;
              const tx = xModel - 6;
              const ty = modelY + NODE_H / 2;
              const dx = (tx - fx) * 0.5;
              const d = `M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
              return <path key={g.key + ':' + i} d={d} stroke="var(--accent)" strokeWidth="1.4" fill="none" markerEnd="url(#setup-arrow)" />;
            });
          })}
          {(() => {
            const fx = xModel + NODE_W;
            const fy = modelY + NODE_H / 2;
            const tx = xOutput - 6;
            const ty = outputY + NODE_H / 2;
            const dx = (tx - fx) * 0.5;
            const d = `M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
            return <path d={d} stroke="var(--accent)" strokeWidth="1.6" fill="none" markerEnd="url(#setup-arrow)" />;
          })()}
        </svg>

        <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: W, height: H }}>
          {/* Input columns grouped by source file */}
          {inputGroups.map((g, gi) => {
            const xCol = gi * (NODE_W + COL_BLOCK_GAP);
            return (
              <React.Fragment key={g.key}>
                {/* Header label */}
                <div
                  style={{
                    position: 'absolute', left: xCol, top: 0,
                    width: NODE_W, height: HEADER_H,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11.5, fontWeight: 600,
                    color: 'var(--text-3)',
                    textTransform: g.mono ? 'none' : 'uppercase',
                    letterSpacing: g.mono ? 0 : '.08em',
                    fontFamily: g.mono ? 'var(--font-mono)' : 'inherit',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                  title={g.title}
                >
                  {g.title}
                </div>
                {/* Nodes */}
                {g.cols.map((c, i) => {
                  const notes = (assumptions[c.key] || []).filter(s => s && s.trim());
                  return (
                    <div
                      key={c.key}
                      className="node node-input has-tooltip"
                      style={{
                        left: xCol, top: PAD_TOP + i * (NODE_H + INPUT_GAP),
                        width: NODE_W, height: NODE_H, cursor: 'default',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                      }}
                    >
                      <div className="node-label">{c.type}</div>
                      <div className="node-name">{c.name}</div>
                      <div className="node-handle right" />
                      <div className="node-tooltip" role="tooltip">
                        <div className="node-tooltip-head">
                          <span className="mono">{c.name}</span>
                          <span className="node-tooltip-type">{c.type}</span>
                        </div>
                        <div className="node-tooltip-source">
                          From <span className="mono">{c.sourceName}</span>
                          {c.isJoinKey && <> · join key</>}
                        </div>
                        {notes.length > 0 && (
                          <ul className="node-tooltip-list">
                            {notes.map((n, ni) => <li key={ni}>{n}</li>)}
                          </ul>
                        )}
                        {c.prepNote && (
                          <div className="node-tooltip-prep">
                            <div className="node-tooltip-prep-eyebrow">Data prep</div>
                            <div className="node-tooltip-prep-headline">
                              {renderInlineCode(c.prepNote.headline)}
                            </div>
                            {c.prepNote.paragraphs.map((p, pi) => (
                              <div className="node-tooltip-prep-para" key={pi}>
                                {renderInlineCode(p)}
                              </div>
                            ))}
                            {c.prepNote.before && c.prepNote.after && (
                              <table className="node-tooltip-prep-table">
                                <thead>
                                  <tr>
                                    <th colSpan="2">Before</th>
                                    <th colSpan="2">After</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.prepNote.before.map((row, ri) => (
                                    <tr key={ri}>
                                      <td className="mono">{row[0]}</td>
                                      <td className="num">{row[1]}</td>
                                      <td className="mono">{c.prepNote.after[ri][0]}</td>
                                      <td className="num">{c.prepNote.after[ri][1]}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* Model — click to open the explainer modal */}
          <button
            className="node model lit"
            style={{
              left: xModel, top: modelY,
              width: NODE_W, height: NODE_H, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: '1.5px solid var(--accent)',
              background: 'var(--accent-soft)',
            }}
            onClick={() => setModelModalOpen(true)}
            title="How the model is set up"
          >
            <Icon name="cpu" size={18}/>
            <span className="node-name" style={{ marginBottom: 0 }}>model</span>
            <span className="node-info-chip" aria-hidden="true">
              <Icon name="info" size={12}/>
            </span>
            <div className="node-handle left" />
            <div className="node-handle right" />
          </button>

          {/* Output (read-only — target is chosen on Domain). */}
          <div
            className="node output predicted"
            style={{
              position: 'absolute', left: xOutput, top: outputY,
              width: NODE_W, height: NODE_H, padding: '0 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              justifyContent: 'center', cursor: 'default',
            }}
          >
            <span className="node-label">predicting</span>
            <span className="node-name">{targetEntry.name}</span>
            <div className="node-handle left" />
          </div>
        </div>
      </div>

      {/* Bottom CTAs */}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button className="btn" onClick={explain}>
          <Icon name="chat" size={13}/> Something's off
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Looks right — continue <Icon name="arrow-right" size={14}/>
        </button>
      </div>

      {/* Model-explainer modal */}
      {modelModalOpen && (
        <ModelExplainerModal
          schema={schema}
          targetEntry={targetEntry}
          task={currentTask}
          rowNoun="customers"
          onClose={() => setModelModalOpen(false)}
        />
      )}
    </div>
  );
}

// ---- Stage 3 sub-component: model-explainer modal ----
//
// Click-to-open panel anchored over the page (centred). Reads
// `schema`, `targetEntry`, and `task` (from inferTaskType) to template
// data-driven copy. Esc and backdrop-click close (Esc lives on the
// parent effect; backdrop-click hooked here).
function ModelExplainerModal({ schema, targetEntry, task, rowNoun, onClose }) {
  const rows = schema.rows || 0;
  const trainRows = Math.round(rows * 0.7);
  const testRows  = rows - trainRows;

  // Task-type-flexed copy. Strings are split into discrete blocks so
  // the same modal layout serves classification / regression / multiclass.
  let whatBody, taskTitle, taskCheckTitle, taskCheckCopy, taskWhy;
  if (task.kind === 'classification') {
    whatBody = (
      <>
        <p>
          A model is a pattern-finder. I'll feed it thousands of past rows — what we knew about each {rowNoun.replace(/s$/, '')} and whether they ended up with <span className="mono">{targetEntry.name} = yes</span> — and it will figure out which patterns predict that outcome. Once it's learned those patterns, you can show it a new row and it'll guess whether <span className="mono">{targetEntry.name}</span> will be yes or no.
        </p>
        <p>
          In machine learning, this kind of pattern-finder is called a <strong>model</strong>. <em>Training</em> the model means showing it enough examples that it picks up the patterns; <em>using</em> the model means asking it to make a guess on a new row.
        </p>
        <p>
          You've probably used a model before without calling it that. ChatGPT and Claude are also machine learning models — just much bigger ones, trained on text instead of tables. They learned their patterns from billions of sentences; yours will learn from your <strong>{rows.toLocaleString()}</strong> rows. Same basic idea, very different scale and purpose. Yours doesn't write essays — it answers one specific yes/no question about your {rowNoun}.
        </p>
      </>
    );
    taskTitle = 'Classification (yes/no)';
    taskWhy = (
      <>
        I'll learn to predict one of two answers for each row: will <span className="mono">{targetEntry.name}</span> be yes, or won't it?
        <br/><br/>
        Why this? <span className="mono">{targetEntry.name}</span> only contains two values, so this is a yes/no question.
      </>
    );
    taskCheckTitle = 'Accuracy + F1-score';
    taskCheckCopy = (
      <>
        <p>
          I'll measure how often the model's prediction matches the real answer. F1-score is a fairer measure when yes/no answers aren't evenly split — useful here because the two answers usually aren't 50/50.
        </p>
        <p>
          I'll use F1-score to pick the winning model. When I try several pattern-finders on your data, the one with the highest F1-score is the one I'll keep and show you at the end.
        </p>
      </>
    );
  } else if (task.kind === 'regression') {
    whatBody = (
      <>
        <p>
          A model is a pattern-finder. I'll feed it thousands of past rows — what we knew about each {rowNoun.replace(/s$/, '')} and the actual number for <span className="mono">{targetEntry.name}</span> — and it will figure out which patterns predict that number. Once it's learned, you can show it a new row and it'll guess what <span className="mono">{targetEntry.name}</span> will be.
        </p>
        <p>
          In machine learning, this kind of pattern-finder is called a <strong>model</strong>. <em>Training</em> the model means showing it enough examples that it picks up the patterns; <em>using</em> the model means asking it to make a guess on a new row.
        </p>
        <p>
          You've probably used a model before without calling it that. ChatGPT and Claude are also machine learning models — just much bigger ones, trained on text instead of tables. They learned their patterns from billions of sentences; yours will learn from your <strong>{rows.toLocaleString()}</strong> rows. Same basic idea, very different scale and purpose. Yours doesn't write essays — it answers one specific question: what's the number for <span className="mono">{targetEntry.name}</span>?
        </p>
      </>
    );
    taskTitle = 'Regression (a number)';
    taskWhy = (
      <>
        I'll learn to predict a number for each row's <span className="mono">{targetEntry.name}</span>.
        <br/><br/>
        Why this? <span className="mono">{targetEntry.name}</span> is a numeric column, so the model has to predict a value rather than a category.
      </>
    );
    taskCheckTitle = 'RMSE (root mean squared error)';
    taskCheckCopy = (
      <>
        <p>
          I'll measure how far the model's predicted numbers tend to be from the real numbers. Lower is better — RMSE in the same units as <span className="mono">{targetEntry.name}</span>.
        </p>
        <p>
          I'll use RMSE to pick the winning model. When I try several pattern-finders on your data, the one with the lowest RMSE is the one I'll keep and show you at the end.
        </p>
      </>
    );
  } else {
    // multiclass / fallback
    whatBody = (
      <>
        <p>
          A model is a pattern-finder. I'll feed it thousands of past rows — what we knew about each {rowNoun.replace(/s$/, '')} and which category they fell into for <span className="mono">{targetEntry.name}</span> — and it will figure out which patterns predict each category. Once it's learned, you can show it a new row and it'll guess the category.
        </p>
        <p>
          In machine learning, this kind of pattern-finder is called a <strong>model</strong>. <em>Training</em> the model means showing it enough examples that it picks up the patterns; <em>using</em> the model means asking it to make a guess on a new row.
        </p>
        <p>
          You've probably used a model before without calling it that. ChatGPT and Claude are also machine learning models — just much bigger ones, trained on text instead of tables. They learned their patterns from billions of sentences; yours will learn from your <strong>{rows.toLocaleString()}</strong> rows. Same basic idea, very different scale and purpose. Yours doesn't write essays — it picks one of a few categories for <span className="mono">{targetEntry.name}</span>.
        </p>
      </>
    );
    taskTitle = 'Classification (one of N categories)';
    taskWhy = (
      <>
        I'll learn to predict which category <span className="mono">{targetEntry.name}</span> belongs to for each row.
        <br/><br/>
        Why this? <span className="mono">{targetEntry.name}</span> is a categorical column with more than two values, so the model picks one of several answers.
      </>
    );
    taskCheckTitle = 'Macro F1-score';
    taskCheckCopy = (
      <>
        <p>
          I'll measure how well the model identifies each category, averaged so rare categories count as much as common ones.
        </p>
        <p>
          I'll use macro F1-score to pick the winning model. When I try several pattern-finders on your data, the one with the highest macro F1 is the one I'll keep and show you at the end.
        </p>
      </>
    );
  }

  // Each section is one slide in the carousel. Kept inline so the
  // closure variables (whatBody, taskTitle, etc.) stay in scope.
  const slides = [
    {
      eyebrow: "What's a model?",
      strong: null,
      body: whatBody,
    },
    {
      eyebrow: "How I'll find the right one",
      strong: null,
      body: (
        <>
          <p>
            There isn't just one kind of pattern-finder — there are dozens (decision trees, random forests, gradient boosting, and so on). Each one notices patterns in a slightly different way.
          </p>
          <p>
            When you hit <strong>Run</strong>, I'll try several of them on your data, score how well each one predicts <span className="mono">{targetEntry.name}</span>, and keep the one that scores highest. You don't have to pick — I'll do the comparing and tell you which one won and why.
          </p>
        </>
      ),
    },
    {
      eyebrow: "Task type",
      strong: taskTitle,
      body: <p>{taskWhy}</p>,
    },
    {
      eyebrow: "How I'll check my work",
      strong: taskCheckTitle,
      body: taskCheckCopy,
    },
    {
      eyebrow: "How I'll train and test",
      strong: "Train on 70% · test on 30%",
      body: (
        <p>
          I'll use about <strong>{trainRows.toLocaleString()}</strong> {rowNoun} to learn patterns, then test on the other <strong>{testRows.toLocaleString()}</strong> that the model hasn't seen. The test scores tell us how the model behaves on new data, not just data it's already memorised.
        </p>
      ),
    },
  ];

  const [slideIdx, setSlideIdx] = React.useState(0);
  const total = slides.length;
  const atFirst = slideIdx === 0;
  const atLast  = slideIdx === total - 1;
  const goPrev = () => { if (!atFirst) setSlideIdx(i => i - 1); };
  const goNext = () => { if (!atLast)  setSlideIdx(i => i + 1); };

  // Arrow-key paginate. Esc-to-close lives on the parent.
  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [slideIdx]);

  const slide = slides[slideIdx];

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="model-explainer-title">
        <div className="modal-header">
          <div className="modal-title" id="model-explainer-title">How the model is set up</div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="Close">
            <Icon name="x" size={14}/>
          </button>
        </div>
        <div className="modal-body modal-body-slide">
          <section>
            <div className="modal-eyebrow">{slide.eyebrow}</div>
            {slide.strong && <div className="modal-strong">{slide.strong}</div>}
            {slide.body}
          </section>
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-ghost btn-icon"
            onClick={goPrev}
            disabled={atFirst}
            title="Previous"
            aria-label="Previous section"
          >
            <Icon name="arrow-right" size={14} style={{ transform: 'scaleX(-1)' }}/>
          </button>
          <div className="modal-dots" role="tablist" aria-label="Section">
            {slides.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === slideIdx}
                aria-label={s.eyebrow}
                className={"modal-dot " + (i === slideIdx ? 'active' : '')}
                onClick={() => setSlideIdx(i)}
              />
            ))}
          </div>
          <div className="modal-counter">{slideIdx + 1} of {total}</div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={goNext}
            disabled={atLast}
            title="Next"
            aria-label="Next section"
          >
            <Icon name="arrow-right" size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Stage 4: Run ----
function StageRun({ progress, done, activeIdx, onTestIt, hasTested, onAdvancePredict }) {
  const [tab, setTab] = React.useState('overview');

  return (
    <div>
      <div className="stage-eyebrow">Stage 4 of 5</div>
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
          <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
            <button className="btn btn-primary" style={{ height: 44, padding: '0 22px', fontSize: 15, borderRadius: 10 }} onClick={onAdvancePredict}>
              <Icon name="sparkle" size={16}/> Test it Out!
            </button>
          </div>
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

// ---- Stage 5: Predict ----
//
// Single-row prediction form. Reads `schema` to build a list of input
// fields (one per non-target, non-join-key-duplicate column), pre-fills
// each from the first preview row of its source file, and on submit
// produces a fake prediction whose shape depends on the target's type.
function StagePredict({
  schema, files, targetCol,
  predictInputs, setPredictInputs,
  predictResult, setPredictResult,
  setLastPredictedTargetKey,
  runDone, setStage,
}) {
  predictInputs = predictInputs || {};

  if (schema.parsedCount === 0) {
    return (
      <div>
        <div className="stage-eyebrow">Stage 5 of 5</div>
        <h1 className="stage-title">Predict on a new row.</h1>
        <div className="card card-pad" style={{ marginTop: 18 }}>
          <p style={{ margin: 0, marginBottom: 12 }}>No data yet — go to Upload to add a CSV.</p>
          <button className="btn btn-primary" onClick={() => setStage(1)}>
            Go to Upload <Icon name="arrow-right" size={14}/>
          </button>
        </div>
      </div>
    );
  }

  // Build a flat column list with source-file metadata, mirroring
  // Stage 3's pattern. The form excludes the right-side join-key
  // duplicate (role==='joinKey') and the current target.
  const joinKeyNames = new Set(
    schema.groups.flatMap(g => g.columns.filter(c => c.role === 'joinKey').map(c => c.name))
  );
  const filesByName = new Map(files.map(f => [f.name, f]));
  const inputFields = schema.groups.length > 0
    ? schema.groups.flatMap(g =>
        g.columns
          .filter(c => c.role !== 'joinKey')
          .map(c => ({
            key: g.fileId + ':' + c.name,
            name: c.name,
            type: c.type,
            sourceName: g.name,
            sourceFile: filesByName.get(g.name),
            isJoinKey: joinKeyNames.has(c.name),
          }))
      )
    : schema.sharedColumns.map(c => ({
        key: 'shared:' + c.name,
        name: c.name,
        type: c.type,
        sourceName: 'Shared',
        sourceFile: files.find(f => f.status === 'parsed'),
        isJoinKey: false,
      }));
  const visibleFields = inputFields.filter(f => f.key !== targetCol);

  const targetEntry = (() => {
    const flat = [
      ...schema.sharedColumns.map(c => ({ name: c.name, type: c.type, key: 'shared:' + c.name, sourceName: 'Shared' })),
      ...schema.groups.flatMap(g => g.columns.map(c => ({ name: c.name, type: c.type, key: g.fileId + ':' + c.name, sourceName: g.name }))),
    ];
    return flat.find(c => c.key === targetCol) || flat[flat.length - 1];
  })();
  const targetTask = inferTaskType(targetEntry);

  const onChangeField = (k, v) => setPredictInputs(prev => ({ ...prev, [k]: v }));

  const runPrediction = () => {
    let value;
    if (targetEntry.type === 'boolean') {
      // 70/30 No/Yes — mimics realistic class imbalance.
      value = Math.random() < 0.30 ? 'Yes' : 'No';
    } else if (targetEntry.type === 'categorical') {
      const sourceFile = filesByName.get(targetEntry.sourceName);
      const opts = sourceFile ? extractCategoricalValues(sourceFile, targetEntry.name) : [];
      value = opts.length ? opts[Math.floor(Math.random() * opts.length)] : '?';
    } else {
      // numeric — sample within observed preview min/max
      const sourceFile = filesByName.get(targetEntry.sourceName);
      const idx = sourceFile ? sourceFile.columns.findIndex(c => c.name === targetEntry.name) : -1;
      const samples = (sourceFile && idx >= 0)
        ? sourceFile.preview.map(r => Number(r[idx])).filter(n => !Number.isNaN(n))
        : [];
      if (samples.length) {
        const min = Math.min(...samples), max = Math.max(...samples);
        const raw = min + Math.random() * (max - min);
        value = Math.round(raw * 100) / 100;
      } else {
        value = Math.round(Math.random() * 100 * 100) / 100;
      }
    }
    const confidence = Math.round((0.70 + Math.random() * 0.25) * 100) / 100;
    setPredictResult({ value, confidence });
    setLastPredictedTargetKey(targetCol);
  };

  const resetForm = () => {
    const fresh = {};
    visibleFields.forEach(f => {
      fresh[f.key] = f.sourceFile ? firstPreviewValue(f.sourceFile, f.name) : '';
    });
    setPredictInputs(fresh);
    setPredictResult(null);
  };

  return (
    <div>
      <div className="stage-eyebrow">Stage 5 of 5</div>
      <h1 className="stage-title">Predict on a new row.</h1>
      <p className="stage-lede">
        Tweak the values below and hit <strong>Predict</strong> to see what{' '}
        <span className="mono">{targetEntry.name}</span> the model would guess for this row.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        {visibleFields.map(f => {
          const v = predictInputs[f.key];
          let control;
          if (f.isJoinKey) {
            control = (
              <input
                type="text"
                className="spec-value"
                value={v == null ? '' : v}
                onChange={(e) => onChangeField(f.key, e.target.value)}
              />
            );
          } else if (f.type === 'boolean') {
            control = (
              <select
                className="spec-value"
                value={v == null ? '' : v}
                onChange={(e) => onChangeField(f.key, e.target.value)}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            );
          } else if (f.type === 'categorical') {
            const opts = f.sourceFile ? extractCategoricalValues(f.sourceFile, f.name) : [];
            control = (
              <select
                className="spec-value"
                value={v == null ? '' : v}
                onChange={(e) => onChangeField(f.key, e.target.value)}
              >
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          } else {
            // numeric
            control = (
              <input
                type="number"
                className="spec-value"
                value={v == null ? '' : v}
                onChange={(e) => {
                  const n = e.target.value === '' ? '' : Number(e.target.value);
                  onChangeField(f.key, n);
                }}
              />
            );
          }
          return (
            <div className="spec-field" key={f.key}>
              <div className="spec-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
                <span style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 600 }}>{humanizeColumnName(f.name)}</span>
              </div>
              {control}
            </div>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        {!runDone && (
          <span className="small muted">Train the model first — head back to <strong>Run</strong>.</span>
        )}
        <button
          className="btn btn-primary"
          disabled={!runDone}
          onClick={runPrediction}
        >
          <Icon name="sparkle" size={14}/> Predict
        </button>
      </div>

      {predictResult && (
        <div className="card card-pad" style={{ marginTop: 18 }}>
          <div className="stage-eyebrow" style={{ marginBottom: 8 }}>Prediction</div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
            <span className="mono">{targetEntry.name}</span>
            {' = '}
            <span className="mono" style={{ color: 'var(--accent-ink)' }}>{String(predictResult.value)}</span>
          </div>
          <div className="small muted" style={{ marginBottom: 14 }}>
            Confidence: {Math.round(predictResult.confidence * 100)}%
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={resetForm}>
              <Icon name="refresh" size={13}/> Predict another row
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { STAGES, WorkflowRail, StageUpload, StageDomain, StageSetup, StageRun, StagePredict });
