// Card primitives — the rounded `--surface` containers used in
// Stages 1, 3, 4, 5 of the workflow. See docs/design-system.md §7.
//
// Components
//   Card     — outer chrome (border, radius-lg, overflow hidden)
//   CardPad  — 18px 20px padding region (use inside Card)
//   CardRow  — flex row, 12px 20px padding, bottom-border (auto-strips
//              on the last child via :last-child)

function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

function CardPad({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={['card-pad', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

function CardRow({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={['card-row', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

if (typeof window !== 'undefined') {
  window.Card = Card;
  window.CardPad = CardPad;
  window.CardRow = CardRow;
}
