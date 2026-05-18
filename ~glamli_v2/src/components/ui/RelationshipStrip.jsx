// RelationshipStrip — accent-soft horizontal strip rendered between
// two FileCards documenting how they were combined.
//
// Mirrors the prototype-root `relationship-strip.jsx`. See that file
// for the full implementation; this rebuild-side copy is the API
// surface a production rebuild would import from `src/components/ui/`.
//
// Props
//   merge          merge record matching the shape produced by
//                  classify() in data.jsx: { kind, keys?, coercions?,
//                  stats }
//   leftFile       file to the strip's left
//   rightFile      file to the strip's right
//   onChangeKey    (newKeys: [[L, R], ...]) => void — fires on every
//                  change inside the picker
//   onJumpToUpload optional — renders a "Change in Upload →" link
//   readOnly       suppresses the "Change key" button

function RelationshipStrip(props) {
  const Impl = typeof window !== 'undefined' ? window.RelationshipStrip : null;
  if (Impl && Impl !== RelationshipStrip) return <Impl {...props} />;
  return null;
}

if (typeof window !== 'undefined' && !window.RelationshipStrip) {
  window.RelationshipStrip = RelationshipStrip;
}

export default RelationshipStrip;
