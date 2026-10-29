import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Tauri expects a fixed port and exposes the frontend over the local network
// during development. `TAURI_DEV_HOST` is set when running `tauri android dev`
// / `tauri ios dev` so the device can reach the dev server.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Vite options tailored for Tauri development.
  clearScreen: false,
  server: {
    // Bind to all interfaces so the Arena preview proxy and mobile devices
    // on the same network can reach the dev server.
    host: host || '0.0.0.0',
    port: 1420,
    strictPort: true,
    // Tauri + the sandbox preview proxy serve the app from arbitrary host
    // names, so host checking is disabled for the dev server.
    allowedHosts: true,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri uses Chromium on Windows/Linux and WebKit on macOS/iOS, and
    // Android WebView (Chromium) on Android. ES2021 is a safe baseline for
    // all of them.
    target: 'es2021',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
