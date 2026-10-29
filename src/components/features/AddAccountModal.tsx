import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, Loader2, LogIn, ShieldAlert, WifiOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { api } from '../../lib/api';
import { copyToClipboard } from '../../lib/util';
import { useLauncher } from '../../store/launcher';
import type { Account, DeviceCode } from '../../lib/types';
import { openExternal } from '../../lib/bridge';

type Mode = 'choose' | 'microsoft' | 'offline';

export function AddAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('choose');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [copied, setCopied] = useState(false);
  const [signedIn, setSignedIn] = useState<Account | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const addOfflineAccount = useLauncher((state) => state.addOfflineAccount);
  const refreshAccounts = useLauncher((state) => state.refreshAccounts);
  const toast = useLauncher((state) => state.toast);

  useEffect(() => {
    if (open) {
      setMode('choose');
      setUsername('');
      setError(null);
      setCode(null);
      setSignedIn(null);
      cancelled.current = false;
    }
    return () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stopPolling();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function stopPolling() {
    cancelled.current = true;
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }

  async function startMicrosoft() {
    setMode('microsoft');
    setBusy(true);
    setError(null);
    try {
      const device = await api.beginDeviceCode();
      setCode(device);
      cancelled.current = false;
      poll(device);
    } catch (err) {
      setError(cleanError(err));
    } finally {
      setBusy(false);
    }
  }

  function poll(device: DeviceCode) {
    if (cancelled.current) return;
    const interval = Math.max(2, device.interval || 5) * 1000;
    pollTimer.current = setTimeout(async () => {
      if (cancelled.current) return;
      try {
        const account = await api.pollDeviceCode(device.deviceCode);
        if (cancelled.current) return;
        setSignedIn(account);
        await refreshAccounts();
        toast({ title: `Signed in as ${account.username}`, tone: 'success' });
        setTimeout(() => onClose(), 900);
      } catch (err) {
        const message = String(err);
        if (/pending/i.test(message)) {
          poll(device);
          return;
        }
        setError(cleanError(err));
      }
    }, interval);
  }

  async function submitOffline() {
    setBusy(true);
    setError(null);
    const ok = await addOfflineAccount(username);
    setBusy(false);
    if (ok) onClose();
  }

  const title =
    mode === 'microsoft'
      ? 'Sign in with Microsoft'
      : mode === 'offline'
        ? 'Add an offline account'
        : 'Add an account';

  return (
    <Modal
      open={open}
      onClose={() => {
        stopPolling();
        onClose();
      }}
      title={title}
      description={
        mode === 'choose'
          ? 'Microsoft accounts can join online servers. Offline profiles work everywhere else.'
          : undefined
      }
      footer={
        mode === 'offline' ? (
          <>
            <Button variant="quiet" onClick={() => setMode('choose')}>
              Back
            </Button>
            <Button variant="primary" onClick={submitOffline} loading={busy} disabled={!username.trim()}>
              Add account
            </Button>
          </>
        ) : undefined
      }
    >
      {mode === 'choose' ? (
        <div className="space-y-2.5">
          <button
            onClick={startMicrosoft}
            className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-violet-400/40 hover:bg-violet-500/[0.07]"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-glow-sm">
              <LogIn className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold text-white">Microsoft account</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-white/40">
                Full Minecraft: Java Edition login. Required for online servers and Realms.
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-white/25 transition group-hover:text-violet-300" />
          </button>

          <button
            onClick={() => setMode('offline')}
            className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/60">
              <WifiOff className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold text-white">Offline profile</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-white/40">
                Any username, no password. Ideal for singleplayer, LAN and cracked servers.
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-white/25 transition group-hover:text-white/50" />
          </button>

          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>
      ) : null}

      {mode === 'microsoft' ? (
        <div className="space-y-4">
          {signedIn ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.08] p-4">
              <Check className="h-5 w-5 text-emerald-300" />
              <div>
                <div className="text-[13px] font-semibold text-white">
                  Welcome, {signedIn.username}!
                </div>
                <div className="text-[11.5px] text-white/45">Your Microsoft session is saved.</div>
              </div>
            </div>
          ) : error ? (
            <ErrorNote>{error}</ErrorNote>
          ) : !code ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-[12.5px] text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Talking to Microsoft…
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-b from-violet-500/[0.10] to-transparent p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/40">
                  <KeyRound className="h-3.5 w-3.5 text-violet-300" />
                  Your sign-in code
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center">
                    <span className="font-pixel text-xl tracking-[0.18em] text-white">
                      {code.userCode}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await copyToClipboard(code.userCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }}
                    icon={
                      copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
                    }
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <Button
                  variant="primary"
                  block
                  className="mt-3"
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => openExternal(code.verificationUri)}
                >
                  Open {code.verificationUri.replace('https://', '')}
                </Button>
              </div>

              <div className="flex items-center gap-2 text-[12px] text-white/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
                Waiting for you to finish signing in… this window updates automatically.
              </div>

              <Button variant="quiet" size="sm" onClick={() => setMode('choose')}>
                Use a different method
              </Button>
            </>
          )}
        </div>
      ) : null}

      {mode === 'offline' ? (
        <div className="space-y-4">
          <Field
            label="Username"
            hint="1–16 characters. Worlds and servers will see this exact name."
          >
            <TextInput
              autoFocus
              value={username}
              maxLength={16}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitOffline();
              }}
              placeholder="Steve"
            />
          </Field>
          <div className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-300" />
            <p className="text-[11.5px] leading-relaxed text-amber-100/70">
              Offline profiles cannot join servers that verify accounts with Mojang. Everything
              else — singleplayer, LAN, most modpacks — works perfectly.
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/[0.08] p-3 text-[11.5px] leading-relaxed text-rose-200/85">
      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-none" />
      <span className="break-words">{children}</span>
    </div>
  );
}

function cleanError(error: unknown): string {
  const text = String(error);
  return text
    .replace(/^Error:\s*/i, '')
    .replace(/^authentication failed:\s*/i, '')
    .trim();
}
