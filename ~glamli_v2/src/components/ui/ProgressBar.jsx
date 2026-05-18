// ProgressBar — slim 4px track with an accent fill that transitions on
// width change. Used in Stage 3 (test-case minimum) and (conceptually) in
// Stage 5. See docs/design-system.md §11.6.
//
// Props
//   value: 0–100  (clamped)
//   className: forwarded to the outer track

function ProgressBar({ value = 0, className = '', ...rest }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={['progress-track', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      {...rest}
    >
      <div className="progress-fill" style={{ width: pct + '%' }} />
    </div>
  );
}

if (typeof window !== 'undefined') window.ProgressBar = ProgressBar;
