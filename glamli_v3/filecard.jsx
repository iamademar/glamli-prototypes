// FileCard — uploaded-file card with three variants used by Upload, and
// a compact variant used by Domain's Sources block.
//
// Variants:
//   full        — icon tile + filename/size/rows×cols, "Parsed" pill,
//                 "What I see" pad, first-10-rows preview table
//   classifying — same chrome, "Classifying…" pill + skeleton + bar
//   refused     — dim card, "Can't combine" warn pill, no preview
//   compact     — used inside Domain's Sources block: one card-row
//                 only, no preview, no blurb
//
// Props
//   file         the file record from app state (`files[i]`)
//   variant      one of the above (default 'full')
//   onRemove?    if provided, renders a ghost trash icon button at top
//                right (compact variant uses this for inline removal)

function FileCard({ file, variant = 'full', onRemove }) {
  const isRefused = variant === 'refused' || file.status === 'refused';
  const isClassifying = variant === 'classifying';
  const isCompact = variant === 'compact';

  const pill = isRefused
    ? <span className="pill warn"><Icon name="x" size={11}/> Can't combine</span>
    : isClassifying
      ? <span className="pill">
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span style={{ marginLeft: 6 }}>Classifying…</span>
        </span>
      : <span className="pill good"><span className="pill-dot"/>Parsed</span>;

  return (
    <div className={"card filecard " + (isRefused ? 'refused' : '')}>
      <div className="card-row">
        <div className="row" style={{ gap: 12 }}>
          <div className="filecard-iconpad">
            <Icon name="document" size={18}/>
          </div>
          <div className="col">
            <div className="filecard-meta">{file.name}</div>
            <div className="filecard-meta-sub">
              {file.size} · {file.rows.toLocaleString()} rows · {file.cols} columns
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {pill}
          {onRemove && (
            <button className="btn btn-ghost btn-icon btn-sm" title="Remove this file" onClick={onRemove}>
              <Icon name="trash" size={13}/>
            </button>
          )}
        </div>
      </div>

      {isClassifying && (
        <div className="card-pad" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
          <div className="small muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, fontSize: 11 }}>
            Checking how this relates…
          </div>
          <div className="skel" style={{ height: 14, marginBottom: 8 }}/>
          <div className="skel" style={{ height: 14, width: '60%' }}/>
          <div className="filecard-classifying-bar"><div/></div>
        </div>
      )}

      {!isClassifying && !isRefused && !isCompact && file.blurb && (
        <div className="card-pad" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
          <div className="small muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, fontSize: 11 }}>What I see</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{file.blurb}</div>
        </div>
      )}

      {!isClassifying && !isRefused && !isCompact && file.preview && (
        <div className="card-pad" style={{ paddingTop: 0 }}>
          <div className="small muted" style={{ margin: '8px 0', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, fontSize: 11 }}>
            First {file.preview.length} rows
          </div>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="preview">
              <thead>
                <tr>{file.columns.map(c => <th key={c.name}>{c.name}</th>)}</tr>
              </thead>
              <tbody>
                {file.preview.map((row, i) => (
                  <tr key={i}>{row.map((v, j) => <td key={j}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

window.FileCard = FileCard;
