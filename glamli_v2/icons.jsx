// Tiny line-icon set
const Icon = ({ name, size = 16, ...rest }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', ...rest };
  switch (name) {
    case 'send': return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'paperclip': return <svg {...props}><path d="M21 11l-9 9a5 5 0 1 1-7-7l9-9a3.5 3.5 0 1 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'check': return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case 'x': return <svg {...props}><path d="M6 6l12 12M6 18L18 6"/></svg>;
    case 'edit': return <svg {...props}><path d="M3 21l3-1 11-11-2-2L4 18l-1 3z"/><path d="M14 7l3 3"/></svg>;
    case 'trash': return <svg {...props}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>;
    case 'download': return <svg {...props}><path d="M12 4v12M6 12l6 6 6-6M4 20h16"/></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z"/></svg>;
    case 'play': return <svg {...props}><path d="M7 4l13 8-13 8z"/></svg>;
    case 'arrow-right': return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-up': return <svg {...props}><path d="M12 19V5M6 11l6-6 6 6"/></svg>;
    case 'flask': return <svg {...props}><path d="M9 3h6M10 3v5L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-11V3"/><path d="M7 14h10"/></svg>;
    case 'database': return <svg {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>;
    case 'lightbulb': return <svg {...props}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A7 7 0 0 0 12 2z"/></svg>;
    case 'cpu': return <svg {...props}><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>;
    case 'document': return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h6"/></svg>;
    case 'sliders': return <svg {...props}><path d="M4 6h12M20 6h0M4 12h6M14 12h6M4 18h12M20 18h0"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
    case 'refresh': return <svg {...props}><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5"/></svg>;
    case 'circle': return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
    case 'circle-dot': return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
    case 'chat': return <svg {...props}><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>;
    default: return null;
  }
};
window.Icon = Icon;
