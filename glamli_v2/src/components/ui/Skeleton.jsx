// Skeleton — shimmering loading placeholder. Used in Stage 5's leaderboard
// while AutoML is running. See docs/design-system.md §11.6.
//
// Props
//   height: number | string (default 28 — matches the leaderboard rows)
//   className / style: forwarded

function Skeleton({ height = 28, className = '', style, ...rest }) {
  return (
    <div
      className={['skel', className].filter(Boolean).join(' ')}
      style={{ height, ...style }}
      {...rest}
    />
  );
}

if (typeof window !== 'undefined') window.Skeleton = Skeleton;
