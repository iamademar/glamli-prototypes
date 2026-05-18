// viewer-page.module.js — standalone CSV viewer page.
//
// Runs on viewer.html. Reads ?file=<name> from the URL, synthesizes
// the full dataset (window.generateFullRows from data.jsx), and mounts
// a Glide Data Grid that fills the page. This is Glide's documented
// happy path: a normal document body with a bare <div id="portal"> as
// the last child — NO position:fixed modal layer fighting Glide's
// inline-editor coordinate math.
//
// Editing + header rename use Glide defaults and are viewer-local
// (the page holds a throwaway copy; nothing persists — demo only).

import React from 'react';
import ReactDOM from 'react-dom';

const qs = new URLSearchParams(window.location.search);
const FILE_NAME = qs.get('file') || '';

function backToUpload() {
  window.location.href = 'upload.html';
}

function ErrorView({ message }) {
  return React.createElement(
    'div',
    { className: 'viewer-page' },
    React.createElement(
      'div',
      { className: 'viewer-bar' },
      React.createElement('div', { className: 'viewer-title' }, 'CSV viewer'),
      React.createElement(
        'button',
        { className: 'btn btn-sm', onClick: backToUpload },
        '← Back to Upload'
      )
    ),
    React.createElement(
      'div',
      { style: { padding: 40 } },
      React.createElement('p', null, message)
    )
  );
}

function GridView({ fileName, columns, rows, Glide }) {
  const { DataEditor, GridCellKind } = Glide;
  const dataRef = React.useRef(rows.map((r) => r.slice()));
  const gridRef = React.useRef(null);
  const hostRef = React.useRef(null);

  const colDefs = React.useMemo(
    () => columns.map((c) => ({ title: c.name, id: c.name, hasMenu: false, width: 170 })),
    [columns]
  );

  const [dims, setDims] = React.useState({
    w: window.innerWidth,
    h: Math.max(200, window.innerHeight - 49),
  });
  React.useEffect(() => {
    const measure = () => {
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setDims({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    measure();
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const getCellContent = React.useCallback((cell) => {
    const [col, row] = cell;
    const raw = dataRef.current[row] ? dataRef.current[row][col] : '';
    const display = raw === undefined || raw === null ? '' : String(raw);
    return {
      kind: GridCellKind.Text,
      data: display,
      displayData: display,
      allowOverlay: true,
      readonly: false,
    };
  }, [GridCellKind]);

  const onCellEdited = React.useCallback((cell, newVal) => {
    const [col, row] = cell;
    if (!dataRef.current[row]) return;
    dataRef.current[row][col] = newVal.data;
    if (gridRef.current && gridRef.current.updateCells) {
      gridRef.current.updateCells([{ cell: [col, row] }]);
    }
  }, []);

  return React.createElement(
    'div',
    { className: 'viewer-page' },
    React.createElement(
      'div',
      { className: 'viewer-bar' },
      React.createElement(
        'div',
        { className: 'viewer-title' },
        fileName + ' ',
        React.createElement(
          'span',
          { className: 'muted small', style: { fontWeight: 400 } },
          '· ' + rows.length.toLocaleString() + ' rows × ' + columns.length + ' columns'
        )
      ),
      React.createElement(
        'button',
        { className: 'btn btn-sm', onClick: backToUpload },
        '← Back to Upload'
      )
    ),
    React.createElement(
      'div',
      { className: 'viewer-grid', ref: hostRef },
      React.createElement(DataEditor, {
        ref: gridRef,
        columns: colDefs,
        rows: rows.length,
        getCellContent: getCellContent,
        onCellEdited: onCellEdited,
        onPaste: true,
        rowMarkers: 'number',
        smoothScrollX: true,
        smoothScrollY: true,
        width: dims.w,
        height: dims.h,
      })
    )
  );
}

// data.jsx is a <script type="text/babel"> — Babel compiles + runs it
// asynchronously, so its window globals may not exist at the moment
// this ES module first evaluates. Wait for them (bounded) before
// rendering, otherwise we'd flash the error view spuriously.
function waitForData(timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const ok =
        typeof window.generateFullRows === 'function' &&
        window.FILE_FIXTURES &&
        Object.keys(window.FILE_FIXTURES).length > 0;
      if (ok) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 60);
    };
    tick();
  });
}

async function main() {
  const root = ReactDOM.createRoot(document.getElementById('root'));

  await waitForData(8000);

  const fixtures = window.FILE_FIXTURES || {};
  const fixture = Object.values(fixtures).find((f) => f.name === FILE_NAME);

  if (!fixture || typeof window.generateFullRows !== 'function') {
    root.render(React.createElement(ErrorView, {
      message: 'No file selected, or the dataset could not be loaded. Go back to Upload and choose a file.',
    }));
    return;
  }

  let Glide = null;
  try {
    Glide = await import(
      'https://esm.sh/@glideapps/glide-data-grid@6.0.3?external=react,react-dom'
    );
    if (!document.getElementById('glide-grid-css')) {
      const link = document.createElement('link');
      link.id = 'glide-grid-css';
      link.rel = 'stylesheet';
      link.href = 'https://esm.sh/@glideapps/glide-data-grid@6.0.3/dist/index.css';
      document.head.appendChild(link);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Glide Data Grid failed to load', e);
    root.render(React.createElement(ErrorView, {
      message: 'The data grid failed to load. This viewer needs the Glide Data Grid library from a CDN — check your connection and try again.',
    }));
    return;
  }

  const rows = window.generateFullRows(FILE_NAME);
  root.render(
    React.createElement(GridView, {
      fileName: FILE_NAME,
      columns: fixture.columns,
      rows: rows,
      Glide: Glide,
    })
  );
}

main();
