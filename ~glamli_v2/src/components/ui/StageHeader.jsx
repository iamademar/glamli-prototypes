// StageHeader — the three-part heading every workflow stage opens with:
//   1. eyebrow ("Stage 3 of 5"   — uppercase 11.5px / 600, --text-3)
//   2. title   (h1.stage-title    — serif 32px / 500)
//   3. lede    (15px, --text-2, max-width 60ch)
//
// Each piece is also exposed individually so the same chrome can be reused
// (for example, the "First 10 rows" caption in Stage 1 uses the eyebrow
// styling on its own). See docs/design-system.md §11.2.

function StageEyebrow({ className = '', children, ...rest }) {
  return (
    <div
      className={['stage-eyebrow', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

function StageTitle({ as: Tag = 'h1', className = '', children, ...rest }) {
  return (
    <Tag className={['stage-title', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

function StageLede({ className = '', children, ...rest }) {
  return (
    <p className={['stage-lede', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </p>
  );
}

function StageHeader({ eyebrow, title, lede }) {
  return (
    <>
      {eyebrow && <StageEyebrow>{eyebrow}</StageEyebrow>}
      {title && <StageTitle>{title}</StageTitle>}
      {lede && <StageLede>{lede}</StageLede>}
    </>
  );
}

if (typeof window !== 'undefined') {
  window.StageEyebrow = StageEyebrow;
  window.StageTitle = StageTitle;
  window.StageLede = StageLede;
  window.StageHeader = StageHeader;
}
