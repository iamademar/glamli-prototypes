// Pill — small rounded badge. Variants in the handoff:
//   default  — neutral (`--surface-2` bg, `--text-2`)
//   good     — positive accent-soft tint (`--accent-soft`, `--accent-ink`)
//   warn     — warn-tinted (rgba(184,118,58,.14) bg, `--warn` text) —
//              used for "Can't combine" refusal pills in the multi-CSV
//              Upload flow.
//
// Optional `dot` prop renders the 6px `.pill-dot` glyph (uses currentColor).
// See docs/design-system.md §11.6.

function Pill({ variant = 'default', dot = false, className = '', children, ...rest }) {
  const classes = [
    'pill',
    variant === 'good' && 'good',
    variant === 'warn' && 'warn',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} {...rest}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}

if (typeof window !== 'undefined') window.Pill = Pill;
