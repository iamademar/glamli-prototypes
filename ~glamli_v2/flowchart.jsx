// Test-cases flowchart panel
function FlowchartPanel({ testCases, setTestCases, modelLit, predictionsShown, embedded }) {
  const [activeId, setActiveId] = React.useState(testCases[0]?.id || null);
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!testCases.find(tc => tc.id === activeId) && testCases.length) setActiveId(testCases[0].id);
  }, [testCases, activeId]);

  const active = testCases.find(tc => tc.id === activeId);

  const inputFields = active ? [
    { k: 'tenure_months', label: 'tenure_months' },
    { k: 'monthly_charges', label: 'monthly_charges' },
    { k: 'contract_type', label: 'contract_type' },
    { k: 'support_tickets', label: 'support_tickets' },
    { k: 'avg_session_min', label: 'avg_session_min' },
  ] : [];

  // Layout — three columns: inputs, model, outputs
  // Generous spacing now that the canvas takes the full right area
  const NODE_W_INPUT = 200;
  const NODE_W_MODEL = 180;
  const NODE_W_OUTPUT = 180;
  const NODE_H = 88;

  const W = 820;
  const inputYStart = 60;
  const inputYStep = 110;
  const H = inputYStart + inputFields.length * inputYStep + 40;

  const inputX = 60;
  const modelX = 320;
  const outputX = 580;
  const modelY = inputYStart + (inputFields.length * inputYStep) / 2 - NODE_H / 2 + 10;
  const expectedY = modelY - 90;
  const predictedY = modelY + 90;

  const updateInput = (k, v) => {
    setTestCases(prev => prev.map(tc => tc.id === activeId ? { ...tc, inputs: { ...tc.inputs, [k]: v } } : tc));
  };
  const updateExpected = (v) => {
    setTestCases(prev => prev.map(tc => tc.id === activeId ? { ...tc, expected: v } : tc));
  };
  const addCase = () => {
    const id = (testCases.at(-1)?.id || 0) + 1;
    const newCase = {
      id, name: `Case ${testCases.length + 1}`,
      inputs: { tenure_months: 12, monthly_charges: 70, contract_type: 'Month-to-month', support_tickets: 2, avg_session_min: 20 },
      expected: 'Yes', predicted: null, confidence: null,
    };
    setTestCases(prev => [...prev, newCase]);
    setActiveId(id);
  };
  const removeCase = (id) => {
    setTestCases(prev => prev.filter(tc => tc.id !== id));
  };

  // Build edge paths — terminate slightly before destination so arrowhead sits cleanly
  const ARROW_OFFSET = 6;
  const trimEnd = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: to.x - (dx / len) * ARROW_OFFSET, y: to.y - (dy / len) * ARROW_OFFSET };
  };

  const edges = active ? [
    ...inputFields.map((_, i) => {
      const from = { x: inputX + NODE_W_INPUT, y: inputYStart + i * inputYStep + NODE_H / 2 };
      const to = { x: modelX, y: modelY + NODE_H / 2 };
      return { from, to: trimEnd(from, to), label: 'input' };
    }),
    (() => {
      const from = { x: modelX + NODE_W_MODEL, y: modelY + NODE_H / 2 };
      const to = { x: outputX, y: expectedY + NODE_H / 2 };
      return { from, to: trimEnd(from, to), label: 'expected' };
    })(),
    ...(predictionsShown && active.predicted ? [(() => {
      const from = { x: modelX + NODE_W_MODEL, y: modelY + NODE_H / 2 };
      const to = { x: outputX, y: predictedY + NODE_H / 2 };
      return { from, to: trimEnd(from, to), label: 'predicted' };
    })()] : []),
  ] : [];

  return (
    <aside className="panel" aria-label="Test cases flowchart" style={embedded ? { borderRight: 'none', flex: 1, minHeight: 0 } : null}>
      <div className="panel-header">
        <div className="col">
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Test-case flowchart</div>
          <div className="small muted">Inputs flow → model → expected output</div>
        </div>
        <button className="btn btn-sm" onClick={addCase}>
          <Icon name="plus" size={13}/> New case
        </button>
      </div>

      <div className="case-tabs">
        {testCases.map((tc, i) => (
          <button
            key={tc.id}
            className={"case-tab " + (tc.id === activeId ? 'active' : '')}
            onClick={() => setActiveId(tc.id)}
          >
            Case {i + 1}
          </button>
        ))}
        <button className="case-tab add" onClick={addCase}>+ add</button>
      </div>

      <div className="flow-canvas" ref={canvasRef} style={{ overflow: 'auto' }}>
        {!active ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-3)' }}>
            <Icon name="flask" size={28} />
            <div>No test cases yet. Click "New case" to start.</div>
          </div>
        ) : (
          <div style={{ position: 'relative', width: W, height: H, margin: '24px auto' }}>
            <svg className="flow-svg" style={{ position: 'absolute', inset: 0, width: W, height: H, pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id="arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--border-strong)" />
                </marker>
                <marker id="arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--accent)" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const dx = (e.to.x - e.from.x) * 0.5;
                const d = `M ${e.from.x} ${e.from.y} C ${e.from.x + dx} ${e.from.y}, ${e.to.x - dx} ${e.to.y}, ${e.to.x} ${e.to.y}`;
                const isPred = e.label === 'predicted';
                return (
                  <path
                    key={i}
                    d={d}
                    stroke={isPred ? 'var(--accent)' : 'var(--border-strong)'}
                    strokeWidth={isPred ? 1.8 : 1.4}
                    fill="none"
                    markerEnd={isPred ? 'url(#arrow-accent)' : 'url(#arrow-default)'}
                  />
                );
              })}
            </svg>

            {/* Input nodes */}
            {inputFields.map((f, i) => (
              <div className="node node-input" key={f.k} style={{ left: inputX, top: inputYStart + i * inputYStep, width: NODE_W_INPUT }}>
                <div className="node-label">
                  <span>Input</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 9 }}>F{i+1}</span>
                </div>
                <div className="node-name" style={{ marginBottom: 6 }}>{f.label}</div>
                {typeof active.inputs[f.k] === 'number' ? (
                  <input
                    type="number"
                    value={active.inputs[f.k]}
                    onChange={(e) => updateInput(f.k, parseFloat(e.target.value) || 0)}
                  />
                ) : (
                  <select
                    value={active.inputs[f.k]}
                    onChange={(e) => updateInput(f.k, e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 6px', fontSize: 12.5 }}
                  >
                    <option>Month-to-month</option>
                    <option>One year</option>
                    <option>Two year</option>
                  </select>
                )}
                <div className="node-handle right"/>
              </div>
            ))}

            {/* Model node */}
            <div className={"node model " + (modelLit ? 'lit' : '')} style={{ left: modelX, top: modelY, width: NODE_W_MODEL }}>
              <div className="node-label" style={{ justifyContent: 'center' }}>Model</div>
              <div style={{ textAlign: 'center', padding: '8px 0 6px' }}>
                <Icon name="cpu" size={24} />
              </div>
              <div className="node-name" style={{ textAlign: 'center' }}>
                {modelLit ? 'GradientBoosting' : 'untrained'}
              </div>
              <div className="node-handle left"/>
              <div className="node-handle right"/>
            </div>

            {/* Expected output */}
            <div className="node output" style={{ left: outputX, top: expectedY, width: NODE_W_OUTPUT }}>
              <div className="node-label">
                <span>Expected</span>
                <span style={{ color: 'var(--text-3)' }}>you</span>
              </div>
              <div className="node-name" style={{ marginBottom: 6 }}>churned</div>
              <select
                value={active.expected}
                onChange={(e) => updateExpected(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 6px', fontSize: 12.5 }}
              >
                <option>Yes</option>
                <option>No</option>
              </select>
              <div className="node-handle left"/>
            </div>

            {/* Predicted output */}
            {predictionsShown && active.predicted && (
              <div className="node output predicted" style={{ left: outputX, top: predictedY, width: NODE_W_OUTPUT }}>
                <div className="node-label">
                  <span>Predicted</span>
                  <span style={{ color: 'var(--accent-ink)' }}>model</span>
                </div>
                <div className="node-name" style={{ marginBottom: 6 }}>churned</div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="node-value">{active.predicted}</span>
                  <span className="small muted">{Math.round(active.confidence * 100)}%</span>
                </div>
                <div className="node-handle left"/>
              </div>
            )}

            {/* Column labels */}
            <div style={{ position: 'absolute', left: inputX, top: 20, width: NODE_W_INPUT, textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', fontWeight: 600 }}>Inputs (features)</div>
            <div style={{ position: 'absolute', left: modelX, top: 20, width: NODE_W_MODEL, textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', fontWeight: 600 }}>ML model</div>
            <div style={{ position: 'absolute', left: outputX, top: 20, width: NODE_W_OUTPUT, textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-3)', fontWeight: 600 }}>Outputs</div>
          </div>
        )}
      </div>

      {active && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-elev)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="small muted">
            {predictionsShown && active.predicted
              ? (active.predicted === active.expected
                  ? <span style={{ color: 'var(--good)' }}>✓ Prediction matches your expectation</span>
                  : <span style={{ color: 'var(--warn)' }}>! Prediction differs — review case</span>)
              : 'Edit values directly on each node.'}
          </div>
          {testCases.length > 1 && (
            <button className="btn btn-ghost btn-sm" onClick={() => removeCase(active.id)}>
              <Icon name="trash" size={13}/>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

window.FlowchartPanel = FlowchartPanel;
