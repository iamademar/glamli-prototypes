// react-dom-shim.module.js — re-export the page's global ReactDOM
// (unpkg UMD) and react-dom/client so CDN ESM packages share the
// app's single ReactDOM instance.
const ReactDOM = window.ReactDOM;
export default ReactDOM;
export const createPortal = ReactDOM.createPortal;
export const flushSync = ReactDOM.flushSync;
export const render = ReactDOM.render;
export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
export const createRoot = ReactDOM.createRoot;
export const hydrateRoot = ReactDOM.hydrateRoot;
export const version = ReactDOM.version;
