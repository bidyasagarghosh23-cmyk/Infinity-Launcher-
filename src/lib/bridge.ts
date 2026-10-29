/**
 * The single boundary between the React UI and the native backend.
 *
 * In a Tauri build (`npm run tauri dev` / packaged app) every call goes over
 * the IPC bridge to `src-tauri/src/commands.rs`. In a plain browser — the
 * Arena preview, `npm run dev` — the same calls hit the demo backend instead
 * so the whole interface stays usable without a native shell.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { mockCall, mockListen } from './mock';

export const isNative =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>);

/** True on a real device build (Android/iOS) even when running in the browser. */
export const isMobileUserAgent =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isNative) {
    return invoke<T>(command, args);
  }
  return mockCall<T>(command, args);
}

type Unlisten = () => void;

/** Subscribe to a backend event; returns an unsubscribe function. */
export async function subscribe<T>(event: string, handler: (payload: T) => void): Promise<Unlisten> {
  if (isNative) {
    return listen<T>(event, (message) => handler(message.payload));
  }
  return mockListen(event, (payload) => handler(payload as T));
}

export function openExternal(url: string) {
  if (isNative) {
    void call('plugin:opener|open_url', { url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
