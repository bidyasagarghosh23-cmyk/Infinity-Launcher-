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
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
// Artifacts live under node_modules/.cache: outside the repo (so the Vite dev
// server never reloads pages mid-test) but still able to resolve `react`.
const outDir = path.join(root, 'node_modules/.cache/infinity-smoke');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// Self-contained entry: mounts <App /> and exposes the store for assertions.
const entryFile = path.join(outDir, 'smoke-entry.tsx');
const appImport = './' + path.relative(outDir, path.join(root, 'src/App')).replaceAll('\\', '/');
const storeImport = './' + path.relative(outDir, path.join(root, 'src/store/launcher')).replaceAll('\\', '/');
fs.writeFileSync(
  entryFile,
  `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${appImport}';
import { useLauncher } from '${storeImport}';

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
// jsdom has no canvas backend; the appearance preview only needs a no-op 2D API.
dom.window.HTMLCanvasElement.prototype.getContext = () => ({
  imageSmoothingEnabled: false,
  clearRect() {}, fillRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {},
  createRadialGradient: () => ({ addColorStop() {} }),
  createLinearGradient: () => ({ addColorStop() {} }),
  fillStyle: '',
});
g.IS_REACT_ACT_ENVIRONMENT = true;

await build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'esm',
  outfile: path.join(outDir, 'smoke-bundle.mjs'),
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
  await import(pathToFileURL(path.join(outDir, 'smoke-bundle.mjs')).href);
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
fs.writeFileSync(path.join(outDir, 'smoke-home.html'), document.body.innerHTML);
must('Fabulously Optimized', 'seed instance');
must('Infinity Launcher', 'brand');
must('Run it anywhere', 'platforms strip');
console.log('route /home ok');

for (const label of ['Instances', 'Discover', 'Content', 'Appearance', 'Engine', 'Console', 'Accounts', 'Settings']) {
  await clickByText(label);
  fs.writeFileSync(path.join(outDir, `smoke-${label}.html`), document.body.innerHTML);
  console.log(`route /${label.toLowerCase()} ok — ${text().length} chars`);
  if (label === 'Discover') must('Discover content', 'catalog browser');
  if (label === 'Content') must('Content manager', 'content toggles');
  if (label === 'Appearance') must('Appearance studio', 'local cosmetics');
  if (label === 'Engine') { must('Engine & performance', 'engine status'); must('Not bundled yet', 'honest engine status'); }
  if (label === 'Settings') must('Java 21', 'java runtime list');
}

must('Java 21', 'java runtime list');
must('Performance', 'settings sections');

await clickByText('Home');
await clickByText('Instances');
await clickByText('New instance');
console.log('home -> instances navigation ok');
must('Minecraft version', 'create modal');
must('Mod loader', 'create modal loader picker');
fs.writeFileSync(path.join(outDir, 'smoke-modal.html'), document.body.innerHTML);
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
fs.writeFileSync(path.join(outDir, 'smoke-install.html'), document.body.innerHTML);
console.log('install simulation ok');

// Account dialog.
await clickByText('Accounts');
await clickByText('Add account');
must('Microsoft account', 'account modal');
must('Offline profile', 'account modal offline');
fs.writeFileSync(path.join(outDir, 'smoke-account.html'), document.body.innerHTML);
console.log('add-account modal ok');

// The Android package is a manager, not a desktop-JVM emulator. Make that
// limitation visible and prevent every UI launch path from starting a game.
// Changing the route unmounts the account dialog along with its page.
const beforeMobile = globalThis.window.__store.getState();
const desktopSystem = beforeMobile.system;
const installedInstance = beforeMobile.instances.find((instance) => instance.installed);
if (!desktopSystem || !installedInstance) throw new Error('mobile smoke fixture is missing');
await act(async () => {
  globalThis.window.__store.setState({
    system: { ...desktopSystem, os: 'android', arch: 'aarch64', platform: 'mobile', java: [] },
    route: 'home',
  });
});
must('Android engine integration is staged', 'mobile limitation banner');
const mobilePlay = [...document.querySelectorAll('button')].filter(
  (button) => button.textContent?.trim() === 'Play',
);
if (!mobilePlay.length || mobilePlay.some((button) => !button.disabled)) {
  throw new Error('Android must not offer an enabled Play button');
}
await act(async () => {
  await globalThis.window.__store.getState().play(installedInstance.id);
});
if (globalThis.window.__store.getState().running[installedInstance.id]?.running) {
  throw new Error('Android store attempted to launch a desktop JVM');
}
await act(async () => {
  globalThis.window.__store.setState({ system: desktopSystem, route: 'home' });
});
console.log('Android limitation and launch guard ok');

const fatal = errors.filter(
  (line) =>
    !/Not implemented: (HTMLCanvasElement|window\.scrollTo)/.test(line) &&
    !/not wrapped in act/.test(line),
);
if (fatal.length) {
  console.log(`\n${fatal.length} console error(s):`);
  for (const line of fatal.slice(0, 12)) console.log(' -', line.slice(0, 400));
  process.exit(1);
}

console.log('\n✓ no console errors');
// Demo timers keep the event loop alive; exit explicitly.
process.exit(0);
