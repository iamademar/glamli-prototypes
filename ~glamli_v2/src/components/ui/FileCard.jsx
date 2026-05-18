// FileCard — uploaded-file card with multiple variants.
//
// Mirrors the prototype-root `filecard.jsx`. See that file for the
// full implementation; this rebuild-side copy is the API surface a
// production rebuild would import from `src/components/ui/`.
//
// Variants
//   full        — icon tile + filename/size/rows×cols, "Parsed" pill,
//                 "What I see" pad, first-N-rows preview table
//   classifying — same chrome, "Classifying…" pill + skeleton
//   refused     — dim card, "Can't combine" warn pill, no preview
//   compact     — single card-row only (used inside Domain Sources)
//
// Props
//   file       file record matching the shape produced by makeFile()
//              in data.jsx: { id, name, size, rows, cols, columns,
//              preview, blurb, status }
//   variant    string (default 'full')
//   onRemove   optional () => void — renders a trash icon-button at top-right

function FileCard({ file, variant = 'full', onRemove }) {
  // Implementation lives at the project root in filecard.jsx; this
  // primitive forwards to the global `window.FileCard` set there. A
  // production rebuild would inline the JSX (see the root file).
  const Impl = typeof window !== 'undefined' ? window.FileCard : null;
  if (Impl && Impl !== FileCard) return <Impl file={file} variant={variant} onRemove={onRemove} />;
  return null;
}

if (typeof window !== 'undefined' && !window.FileCard) {
  window.FileCard = FileCard;
}

export default FileCard;
