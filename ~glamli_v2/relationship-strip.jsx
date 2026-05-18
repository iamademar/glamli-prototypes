// RelationshipStrip — accent-soft horizontal strip rendered between
// two FileCards. Documents how two files were combined (join or stack),
// shows the cumulative result row × col count, and (for joins) hosts an
// inline Change-key picker.
//
// Props
//   merge          the merge record (`merges[i]`)
//   leftFile       the file to the strip's left
//   rightFile      the file to the strip's right
//   onChangeKey    (newKeys: [[L, R], ...]) => void — called whenever
//                  the picker changes
//   onJumpToUpload optional — shows "Change in Upload →" link when set
//                  (used by Domain's Sources block; clicking sets
//                  stage = 1)
//   readOnly       suppresses the "Change key" button entirely

function RelationshipStrip({ merge, leftFile, rightFile, onChangeKey, onJumpToUpload, readOnly }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);

  // Outside-click closes the picker.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!merge) return null;

  if (merge.kind === 'refused') {
    return (
      <div className="rel-strip refused">
        <div className="rel-strip-row">
          <span className="rel-strip-info">
            <Icon name="x" size={14}/>
            Couldn't combine{' '}
            <span className="mono">{rightFile.name}</span>
            {' with '}
            <span className="mono">{leftFile.name}</span>
          </span>
        </div>
      </div>
    );
  }

  if (merge.kind === 'concat') {
    return (
      <div className="rel-strip">
        <div className="rel-strip-row">
          <span className="rel-strip-info">
            Stacked · shared schema ({merge.stats.sharedSchema} columns match) · result:{' '}
            {merge.stats.resultRows.toLocaleString()} rows × {merge.stats.resultCols} columns
          </span>
          {onJumpToUpload && (
            <button className="rel-strip-link" onClick={onJumpToUpload}>
              Change in Upload →
            </button>
          )}
        </div>
        {merge.coercions && merge.coercions.length > 0 && (
          <div className="rel-strip-warn">
            {merge.coercions.map((c, i) => (
              <div key={i}>
                <span className="mono">{c.col}</span> is <span className="mono">{c.from}</span> in{' '}
                <span className="mono">{leftFile.name}</span> and <span className="mono">{c.to}</span> in{' '}
                <span className="mono">{rightFile.name}</span> — will be coerced.
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Join.
  const keys = merge.keys || [];
  return (
    <div className="rel-strip" ref={wrapRef}>
      <div className="rel-strip-row">
        <span className="rel-strip-info">
          Joined on{' '}
          {keys.map((pair, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' and '}
              <span className="mono">{pair[0]}</span>
              {pair[0] !== pair[1] && <> ↔ <span className="mono">{pair[1]}</span></>}
            </React.Fragment>
          ))}
          {' · '}{merge.stats.overlap}% overlap · result:{' '}
          {merge.stats.resultRows.toLocaleString()} rows × {merge.stats.resultCols} columns
        </span>
        <span className="row" style={{ gap: 6 }}>
          {!readOnly && (
            <button className="rel-strip-link" onClick={() => setOpen(o => !o)}>
              {open ? 'Done' : 'Change key'}
            </button>
          )}
          {onJumpToUpload && (
            <button className="rel-strip-link" onClick={onJumpToUpload}>
              Change in Upload →
            </button>
          )}
        </span>
      </div>

      {open && !readOnly && (
        <KeyPicker
          leftFile={leftFile}
          rightFile={rightFile}
          keys={keys}
          onChange={onChangeKey}
        />
      )}
    </div>
  );
}

function KeyPicker({ leftFile, rightFile, keys, onChange }) {
  const update = (idx, side, val) => {
    const next = keys.map((p, i) => {
      if (i !== idx) return p;
      return side === 'left' ? [val, p[1]] : [p[0], val];
    });
    onChange(next);
  };
  const addPair = () => {
    const next = [...keys, [leftFile.columns[0].name, rightFile.columns[0].name]];
    onChange(next);
  };
  const removePair = (idx) => {
    if (keys.length <= 1) return;
    onChange(keys.filter((_, i) => i !== idx));
  };

  return (
    <div className="key-picker">
      {keys.map((pair, i) => (
        <div className="key-picker-row" key={i}>
          <select value={pair[0]} onChange={(e) => update(i, 'left', e.target.value)}>
            {leftFile.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <span className="arrow">↔</span>
          <select value={pair[1]} onChange={(e) => update(i, 'right', e.target.value)}>
            {rightFile.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => removePair(i)}
            disabled={keys.length <= 1}
            title="Remove this key pair"
          >
            <Icon name="x" size={13}/>
          </button>
        </div>
      ))}
      <div className="key-picker-actions">
        <button className="btn btn-ghost btn-sm" onClick={addPair}>
          <Icon name="plus" size={13}/> Another column pair
        </button>
      </div>
    </div>
  );
}

window.RelationshipStrip = RelationshipStrip;
