// Chat panel — scripted streaming responses tied to workflow stage
const STAGE_INTROS = {
  1: [
    { who: 'assistant', text: "Hi! I'm here to help you build a machine-learning model — no code required. Let's start by getting your data in.\n\nDrop a CSV file into the **Data Upload** card on your right, or pick one of the samples. I'll take a quick look and tell you what I see." },
  ],
  // Stage 2 intro is synthesized inline in app-core.jsx (it depends on
  // the live schema's auto-detected task type). This static fallback
  // matches the "no signal" wording for any caller that still reads
  // from the static map.
  2: [
    { who: 'assistant', text: "You're on Domain — let's pin down what kind of question you're asking, and then which column holds the answer (if you need one). I'm not sure yet, what are you trying to figure out?" },
  ],
  // Stage 3 intro is synthesized inline in app.jsx (it depends on the
  // live schema + target column).
  4: [
    { who: 'assistant', text: "Training in progress. This usually takes 1–2 minutes. You can watch the **Overview** tab for a friendly status, or peek at **Advanced** to see the full optimization history.\n\nWhen it's done, you'll get a **Test it Out!** button — clicking it will run your test cases through the trained model and show predictions right next to your expected values." },
  ],
};

function ChatPanel({ stage, messages, onSend, streaming, composerDraft, onComposerDraftChange }) {
  // Composer is controlled-with-fallback: if the caller passes
  // composerDraft, we read/write through props; otherwise we manage
  // local state internally.
  const [internalDraft, setInternalDraft] = React.useState('');
  const controlled = composerDraft !== undefined && composerDraft !== null;
  const draft = controlled ? composerDraft : internalDraft;
  const setDraft = controlled
    ? (v) => onComposerDraftChange && onComposerDraftChange(v)
    : setInternalDraft;

  const feedRef = React.useRef(null);
  const textareaRef = React.useRef(null);

  React.useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, streaming]);

  // When the parent seeds the composer (escape hatch), focus the textarea.
  const prevSeedRef = React.useRef('');
  React.useEffect(() => {
    if (controlled && composerDraft && composerDraft !== prevSeedRef.current) {
      prevSeedRef.current = composerDraft;
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Position caret at end so the user types after the seed.
        const len = composerDraft.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }
    if (!composerDraft) prevSeedRef.current = '';
  }, [composerDraft, controlled]);

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  };

  return (
    <aside className="panel" aria-label="Chat assistant">
      <div className="panel-header">
        <div className="row" style={{ gap: 10 }}>
          <div className="brand-mark" style={{ width: 24, height: 24 }}>G</div>
          <div className="col">
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Assistant</div>
            <div className="small muted">Stage {stage} of 5</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" title="New conversation">
          <Icon name="refresh" size={15} />
        </button>
      </div>
      <div className="panel-body" ref={feedRef}>
        <div className="chat-feed">
          {(() => {
            // Stage-scoped feed: render only messages whose stage tag
            // matches the current stage. Untagged legacy messages are
            // visible everywhere (fallback for safety).
            const visible = messages
              .map((m, i) => ({ m, i }))
              .filter(({ m }) => m.stage == null || m.stage === stage);
            const lastIdx = visible.length > 0 ? visible[visible.length - 1].i : -1;
            return visible.map(({ m, i }) => (
              <Message
                key={i}
                msg={m}
                streaming={streaming && i === lastIdx && i === messages.length - 1 && m.who === 'assistant'}
              />
            ));
          })()}
        </div>
      </div>
      <div className="composer">
        <div className="composer-box">
          <textarea
            ref={textareaRef}
            placeholder="Ask anything — for example, &ldquo;why F1-score?&rdquo;"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
          />
          <div className="composer-row">
            <div className="composer-tools">
              <button className="btn btn-ghost btn-icon btn-sm" title="Attach file"><Icon name="paperclip" size={14}/></button>
            </div>
            <button
              className={"btn btn-icon btn-sm " + (draft.trim() ? "btn-primary" : "")}
              disabled={!draft.trim()}
              onClick={send}
              title="Send (Enter)"
            >
              <Icon name="arrow-up" size={14}/>
            </button>
          </div>
        </div>
        <div className="row small muted" style={{ justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
          <span>Press <span className="kbd">Enter</span> to send</span>
          <span>Synced with workflow</span>
        </div>
      </div>
    </aside>
  );
}

function Message({ msg, streaming }) {
  // crude markdown: **bold**, `code`, paragraphs
  const render = (text) => {
    return text.split('\n\n').map((para, pi) => {
      const parts = [];
      let rest = para;
      let key = 0;
      const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
      let m, last = 0;
      while ((m = re.exec(rest)) !== null) {
        if (m.index > last) parts.push(rest.slice(last, m.index));
        const tok = m[0];
        if (tok.startsWith('**')) parts.push(<strong key={'k'+(key++)}>{tok.slice(2, -2)}</strong>);
        else parts.push(<code key={'k'+(key++)}>{tok.slice(1, -1)}</code>);
        last = m.index + tok.length;
      }
      if (last < rest.length) parts.push(rest.slice(last));
      return <p key={pi}>{parts}</p>;
    });
  };

  return (
    <div className={"msg " + msg.who}>
      <div className="msg-meta">
        {msg.who === 'assistant' ? <span style={{ fontWeight: 600, color: 'var(--text)' }}>GLAMLI</span> : <span>You</span>}
        {msg.t && <span>· {msg.t}</span>}
      </div>
      <div className="msg-bubble">
        {streaming && !msg.text ? (
          <span><span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span></span>
        ) : render(msg.text)}
      </div>
    </div>
  );
}

window.ChatPanel = ChatPanel;
window.STAGE_INTROS = STAGE_INTROS;
