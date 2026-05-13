// Button — primary UI affordance from the GLAMLI design system.
//
// Mirrors the `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.btn-icon`
// classes from the handoff. See docs/design-system.md §6.
//
// Props
//   variant: 'default' | 'primary' | 'ghost'   (default 'default')
//   size:    'md'      | 'sm'                  (default 'md')
//   icon:    boolean — square 30x30 icon-only chrome
//   as:      element tag (default 'button')
//
// Anything else passes through (onClick, disabled, type, aria-*, …).

function Button({
  variant = 'default',
  size = 'md',
  icon = false,
  as: Tag = 'button',
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'ghost' && 'btn-ghost',
    size === 'sm' && 'btn-sm',
    icon && 'btn-icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

if (typeof window !== 'undefined') window.Button = Button;
