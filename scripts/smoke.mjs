/**
 * Headless smoke test.
 *
 * Mounts the real application in jsdom against the demo backend, walks every
 * route, opens the dialogs, runs an install simulation and fails on any React
 * console error. Run with: node scripts/smoke.mjs
 */
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, '.tmp');
fs.mkdirSync(outDir, { recursive: true });

// Self-contained entry: mounts <App /> and exposes the store for assertions.
const entryFile = path.join(outDir, 'smoke-entry.tsx');
fs.writeFileSync(
  entryFile,
  `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${path.join(root, 'src/App').replaceAll('\\', '/')}';
import { useLauncher } from '${path.join(root, 'src/store/launcher').replaceAll('\\', '/')}';

(window as unknown as { __store?: typeof useLauncher }).__store = useLauncher;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
);

const dom = new JSDOM(
  '<!doctype html><html data-theme="dark"><body><div id="root"></div></body></html>',
  { url: 'http://localhost:1420/', pretendToBeVisual: true },
);

const g = globalThis;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = (id) => clearTimeout(id);
g.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
g.IS_REACT_ACT_ENVIRONMENT = true;

await build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'esm',
  outfile: path.join(root, '.tmp/smoke-bundle.mjs'),
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'error',
});

const errors = [];
const originalError = console.error;
console.error = (...args) => {
  errors.push(args.map(String).join(' '));
  originalError(...args);
};

const { act } = await import('react');
await act(async () => {
  await import(path.join(root, '.tmp/smoke-bundle.mjs'));
});

const settle = async (ms = 0) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

const text = () => document.body.textContent ?? '';
const must = (needle, label) => {
  if (!text().includes(needle)) throw new Error(`missing "${needle}" (${label})`);
};
const clickByText = async (label, exact = true) => {
  const buttons = [...document.querySelectorAll('button')].filter((button) => {
    const value = button.textContent?.trim() ?? '';
    return exact ? value === label : value.includes(label);
  });
  if (buttons.length === 0) throw new Error(`button "${label}" not found`);
  await act(async () => {
    buttons[0].click();
  });
  await settle(350);
};

await settle(900);
const state = globalThis.window.__store?.getState();
console.log('store:', JSON.stringify({
  ready: state?.ready,
  bootError: state?.bootError,
  instances: state?.instances?.length,
  accounts: state?.accounts?.length,
  settings: Boolean(state?.settings),
  system: Boolean(state?.system),
}));
fs.writeFileSync(path.join(root, '.tmp/smoke-home.html'), document.body.innerHTML);
must('Fabulously Optimized', 'seed instance');
must('Infinity Launcher', 'brand');
must('Run it anywhere', 'platforms strip');
console.log('route /home ok');

for (const label of ['Instances', 'Console', 'Accounts', 'Settings']) {
  await clickByText(label);
  fs.writeFileSync(path.join(root, `.tmp/smoke-${label}.html`), document.body.innerHTML);
  console.log(`route /${label.toLowerCase()} ok — ${text().length} chars`);
}

must('Java 21', 'java runtime list');
must('Performance', 'settings sections');

await clickByText('Home');
await clickByText('Instances');
await clickByText('New instance');
console.log('home -> instances navigation ok');
must('Minecraft version', 'create modal');
must('Mod loader', 'create modal loader picker');
fs.writeFileSync(path.join(root, '.tmp/smoke-modal.html'), document.body.innerHTML);
console.log('create-instance modal ok');

// Close the dialog, then start an install simulation.
await clickByText('Cancel');
await clickByText('Instances');
const install = [...document.querySelectorAll('button')].filter(
  (button) => button.textContent?.trim() === 'Install',
);
if (install.length === 0) throw new Error('no Install button on an uninstalled instance');
await act(async () => {
  install[install.length - 1]?.click();
});
await settle(1500);
const progressState = globalThis.window.__store?.getState()?.progress ?? {};
const keys = Object.keys(progressState);
if (keys.length === 0) throw new Error('install simulation produced no progress entry');
const entry = progressState[keys[0]];
console.log('install progress:', JSON.stringify(entry));
must('Libraries', 'install progress');
const loggedRoute = globalThis.window.__store?.getState()?.route;
if (loggedRoute !== 'console') throw new Error(`expected console route, got ${loggedRoute}`);
fs.writeFileSync(path.join(root, '.tmp/smoke-install.html'), document.body.innerHTML);
console.log('install simulation ok');

// Account dialog.
await clickByText('Accounts');
await clickByText('Add account');
must('Microsoft account', 'account modal');
must('Offline profile', 'account modal offline');
fs.writeFileSync(path.join(root, '.tmp/smoke-account.html'), document.body.innerHTML);
console.log('add-account modal ok');

const fatal = errors.filter(
  (line) => !/Not implemented: (HTMLCanvasElement|window\.scrollTo)/.test(line),
);
if (fatal.length) {
  console.log(`\n${fatal.length} console error(s):`);
  for (const line of fatal.slice(0, 12)) console.log(' -', line.slice(0, 400));
  process.exitCode = 1;
} else {
  console.log('\n✓ no console errors');
}
