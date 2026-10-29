import { useEffect, useState } from 'react';
import {
  Check,
  Cpu,
  Download,
  ExternalLink,
  FolderOpen,
  Gauge,
  Globe,
  HardDrive,
  Info,
  RefreshCw,
  Save,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useLauncher } from '../store/launcher';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Select, TextInput, Toggle } from '../components/ui/Field';
import { api } from '../lib/api';
import { isNative, openExternal } from '../lib/bridge';
import { resetDemoData } from '../lib/mock';
import type { JavaRuntime, Settings as SettingsType } from '../lib/types';
import { cn, platformLabel } from '../lib/util';
import { PLATFORMS } from '../components/brand/PlatformIcons';
import { Spinner } from '../components/ui/Spinner';

export function Settings() {
  const settings = useLauncher((state) => state.settings);
  const system = useLauncher((state) => state.system);
  const patchSettings = useLauncher((state) => state.patchSettings);
  const toast = useLauncher((state) => state.toast);
  const [runtimes, setRuntimes] = useState<JavaRuntime[]>(system?.java ?? []);
  const [detecting, setDetecting] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [draft, setDraft] = useState<SettingsType | null>(settings);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (!settings || !draft) return null;

  const totalRam = system?.totalMemoryMb ?? 8192;
  const recommended = Math.min(8192, Math.max(2048, Math.floor(totalRam * 0.5)));

  async function detectJava() {
    setDetecting(true);
    try {
      const list = await api.detectJava();
      setRuntimes(list);
      toast({
        title: list.length ? `Found ${list.length} runtime${list.length > 1 ? 's' : ''}` : 'No Java found',
        description: list.length ? list.map((runtime) => runtime.version).join(', ') : undefined,
        tone: list.length ? 'success' : 'error',
      });
    } catch (error) {
      toast({ title: 'Java detection failed', description: String(error), tone: 'error' });
    } finally {
      setDetecting(false);
    }
  }

  async function provisionJava() {
    setProvisioning(true);
    try {
      const runtime = await api.provisionJava(21);
      setRuntimes((current) => [runtime, ...current]);
      toast({ title: `Java ${runtime.major} installed`, description: runtime.path, tone: 'success' });
    } catch (error) {
      toast({ title: 'Could not install Java', description: String(error), tone: 'error' });
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-6">
      {/* Theme ----------------------------------------------------------- */}
      <section>
        <SectionHeading title="Client theme" subtitle="Lunar-inspired dark client styling; original Infinity branding and assets." />
        <Card className="p-5">
          <Field label="Theme">
            <Select value={draft.theme} onChange={(event) => { setDraft({ ...draft, theme: event.target.value }); void patchSettings({ theme: event.target.value }); }}>
              <option value="lunar">Lunar-inspired (blue/cyan)</option>
              <option value="infinity">Infinity (violet/cyan)</option>
              <option value="midnight">Midnight (monochrome)</option>
            </Select>
          </Field>
        </Card>
      </section>

      {/* Memory ---------------------------------------------------------- */}
      <section>
        <SectionHeading
          title="Performance"
          subtitle="Memory is the single biggest lever for modded performance"
          action={
            <span className="font-pixel text-[10px] uppercase tracking-wider text-white/35">
              {((draft.ramMb ?? 4096) / 1024).toFixed(1)} GB
            </span>
          }
        />
        <Card className="p-5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-white/45">
              <Gauge className="h-3.5 w-3.5" /> Allocated to Minecraft
            </span>
            <span className="text-white/30">
              system has {Math.round(totalRam / 1024)} GB · recommend {Math.round(recommended / 1024)} GB
            </span>
          </div>
          <input
            type="range"
            className="mt-4"
            min={1024}
            max={Math.max(2048, Math.min(32768, totalRam))}
            step={512}
            value={draft.ramMb}
            onChange={(event) => setDraft({ ...draft, ramMb: Number(event.target.value) })}
            onPointerUp={() => patchSettings({ ramMb: draft.ramMb })}
            onKeyUp={() => patchSettings({ ramMb: draft.ramMb })}
          />
          <div className="mt-2 flex justify-between font-pixel text-[9px] uppercase tracking-wider text-white/25">
            <span>1 GB</span>
            <button
              className="text-violet-300/80 hover:text-violet-200"
              onClick={() => {
                setDraft({ ...draft, ramMb: recommended });
                void patchSettings({ ramMb: recommended });
              }}
            >
              use {Math.round(recommended / 1024)} GB
            </button>
            <span>{Math.round(Math.min(32768, totalRam) / 1024)} GB</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Default resolution">
              <div className="flex items-center gap-2">
                <TextInput
                  type="number"
                  value={draft.windowWidth}
                  onChange={(event) =>
                    setDraft({ ...draft, windowWidth: Number(event.target.value) || 854 })
                  }
                  onBlur={() => patchSettings({ windowWidth: draft.windowWidth })}
                />
                <span className="text-white/25">×</span>
                <TextInput
                  type="number"
                  value={draft.windowHeight}
                  onChange={(event) =>
                    setDraft({ ...draft, windowHeight: Number(event.target.value) || 480 })
                  }
                  onBlur={() => patchSettings({ windowHeight: draft.windowHeight })}
                />
              </div>
            </Field>
            <Field label="Launcher behaviour">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3">
                <Toggle
                  checked={draft.closeOnLaunch}
                  onChange={(value) => {
                    setDraft({ ...draft, closeOnLaunch: value });
                    void patchSettings({ closeOnLaunch: value });
                  }}
                  label="Minimise after launch"
                  description="Hide the launcher once the game window appears"
                />
              </div>
            </Field>
          </div>
        </Card>
      </section>

      {/* Java ------------------------------------------------------------ */}
      <section>
        <SectionHeading
          title="Java runtime"
          subtitle="Minecraft 1.17+ needs Java 17, 1.20.5+ needs Java 21"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={detectJava} loading={detecting} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                Rescan
              </Button>
              {isNative && system?.platform !== 'mobile' ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={provisionJava}
                  loading={provisioning}
                  icon={<Download className="h-3.5 w-3.5" />}
                >
                  Install Java 21
                </Button>
              ) : null}
            </div>
          }
        />

        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/35">
              Detected runtimes
            </span>
            {detecting ? <Spinner className="h-3.5 w-3.5 text-white/40" /> : null}
          </div>

          <button
            onClick={() => {
              setDraft({ ...draft, javaPath: null });
              void patchSettings({ javaPath: null });
            }}
            className={cn(
              'mb-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
              draft.javaPath === null
                ? 'border-violet-400/30 bg-violet-500/10'
                : 'border-transparent hover:bg-white/[0.04]',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full border',
                draft.javaPath === null ? 'border-violet-400 bg-violet-500' : 'border-white/20',
              )}
            >
              {draft.javaPath === null ? <Check className="h-2.5 w-2.5 text-white" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-white/85">Automatic</div>
              <div className="text-[11px] text-white/35">
                Pick the smallest runtime that satisfies the version you launch
              </div>
            </div>
            <Badge tone="brand">recommended</Badge>
          </button>

          {runtimes.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-4 text-[11.5px] text-amber-200/70">
              <Info className="h-3.5 w-3.5" />
              No Java runtime detected. Install one or set a path manually.
            </div>
          ) : (
            runtimes.map((runtime) => {
              const active = draft.javaPath === runtime.path;
              return (
                <button
                  key={runtime.path}
                  onClick={() => {
                    setDraft({ ...draft, javaPath: runtime.path });
                    void patchSettings({ javaPath: runtime.path });
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                    active
                      ? 'border-violet-400/30 bg-violet-500/10'
                      : 'border-transparent hover:bg-white/[0.04]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border',
                      active ? 'border-violet-400 bg-violet-500' : 'border-white/20',
                    )}
                  >
                    {active ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium text-white/85">
                        Java {runtime.major}
                        <span className="ml-1.5 text-[11px] font-normal text-white/35">
                          {runtime.version}
                        </span>
                      </span>
                      {runtime.managed ? <Badge tone="info">managed</Badge> : null}
                    </div>
                    <div className="truncate font-mono text-[10px] text-white/25" title={runtime.path}>
                      {runtime.path}
                    </div>
                  </div>
                  <span className="hidden text-[10.5px] text-white/30 sm:block">
                    {runtime.vendor}
                  </span>
                </button>
              );
            })
          )}

          <div className="mt-2 flex items-center gap-2 px-2">
            <Cpu className="h-3.5 w-3.5 text-white/25" />
            <input
              placeholder="…or paste a path to a java executable"
              defaultValue={draft.javaPath ?? ''}
              onBlur={(event) => {
                const value = event.target.value.trim();
                setDraft({ ...draft, javaPath: value || null });
                void patchSettings({ javaPath: value || null });
              }}
              className="h-8 flex-1 rounded-lg border border-white/[0.07] bg-black/20 px-2 font-mono text-[10.5px] text-white/60 placeholder:text-white/20 focus:border-violet-500/40 focus:outline-none"
            />
          </div>
        </Card>
      </section>

      {/* Launcher -------------------------------------------------------- */}
      <section>
        <SectionHeading title="Launcher" subtitle="Downloads, interface and storage" />
        <Card className="divide-y divide-white/[0.06] px-4 py-1">
          <Toggle
            checked={draft.showSnapshots}
            onChange={(value) => {
              setDraft({ ...draft, showSnapshots: value });
              void patchSettings({ showSnapshots: value });
            }}
            label="Show snapshots"
            description="List snapshot builds next to stable releases"
          />
          <Toggle
            checked={draft.autoUpdate}
            onChange={(value) => {
              setDraft({ ...draft, autoUpdate: value });
              void patchSettings({ autoUpdate: value });
            }}
            label="Check for launcher updates"
            description="Look for a newer Infinity Launcher on startup"
          />
          <Toggle
            checked={draft.fullscreen}
            onChange={(value) => {
              setDraft({ ...draft, fullscreen: value });
              void patchSettings({ fullscreen: value });
            }}
            label="Start Minecraft fullscreen"
            description="Useful for TVs, handhelds and couch setups"
          />
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <Field label="Parallel downloads" hint="Higher is faster on good connections">
              <Select
                value={draft.downloadConcurrency}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDraft({ ...draft, downloadConcurrency: value });
                  void patchSettings({ downloadConcurrency: value });
                }}
              >
                {[2, 4, 8, 12, 16, 24].map((value) => (
                  <option key={value} value={value}>
                    {value} at a time
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Language" hint="UI language for the launcher">
              <Select
                value={draft.language}
                onChange={(event) => {
                  setDraft({ ...draft, language: event.target.value });
                  void patchSettings({ language: event.target.value });
                }}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="hi">हिन्दी</option>
                <option value="bn">বাংলা</option>
                <option value="pt">Português</option>
                <option value="ru">Русский</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </Select>
            </Field>
          </div>
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/35">
                <HardDrive className="h-3.5 w-3.5" /> Data folder
              </div>
              <div className="mt-1 break-all font-mono text-[10.5px] text-white/40">
                {system?.dataDir ?? '—'}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              onClick={() => api.openDataDir().catch(() => undefined)}
              disabled={!isNative}
            >
              Open folder
            </Button>
          </div>
        </Card>
      </section>

      {/* Advanced -------------------------------------------------------- */}
      <section>
        <SectionHeading
          title="Advanced"
          subtitle="JVM and game arguments, applied before loader-provided flags"
          action={
            <Button size="sm" variant="quiet" onClick={() => setAdvanced((value) => !value)}>
              {advanced ? 'Hide' : 'Show'}
            </Button>
          }
        />
        {advanced ? (
          <Card className="p-4">
            <Field label="JVM arguments" hint="One flag per word, quotes are respected">
              <textarea
                rows={3}
                value={draft.jvmArgs}
                onChange={(event) => setDraft({ ...draft, jvmArgs: event.target.value })}
                onBlur={() => patchSettings({ jvmArgs: draft.jvmArgs })}
                className="input resize-none font-mono text-[11.5px]"
                spellCheck={false}
              />
            </Field>
            <div className="mt-3">
              <Field label="Extra game arguments" hint="e.g. --server play.example.net --quickPlayMultiplayer">
                <textarea
                  rows={2}
                  value={draft.gameArgs}
                  onChange={(event) => setDraft({ ...draft, gameArgs: event.target.value })}
                  onBlur={() => patchSettings({ gameArgs: draft.gameArgs })}
                  className="input resize-none font-mono text-[11.5px]"
                  spellCheck={false}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Save className="h-3.5 w-3.5" />}
                onClick={() => patchSettings(draft)}
              >
                Save all settings
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon={<Terminal className="h-3.5 w-3.5" />}
                onClick={() => toast({ title: 'Reveal logs', description: 'Open the Console tab for live output', tone: 'info' })}
              >
                Where are the logs?
              </Button>
            </div>
          </Card>
        ) : null}
      </section>

      {/* Platforms ------------------------------------------------------- */}
      <section>
        <SectionHeading title="Platforms" subtitle="The same launcher compiles for all five targets" />
        <Card className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 lg:grid-cols-5">
          {PLATFORMS.map((platform) => {
            const Glyph = platform.Glyph;
            const current = system?.os === platform.id;
            return (
              <div
                key={platform.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded-2xl px-3 py-3',
                  current ? 'bg-violet-500/10 ring-1 ring-inset ring-violet-400/25' : '',
                )}
              >
                <div className="flex items-center gap-2">
                  <Glyph className={cn('h-4 w-4', current ? 'text-violet-300' : 'text-white/40')} />
                  <span className="text-[12px] font-semibold text-white/80">{platform.label}</span>
                </div>
                <span className="text-[10px] leading-snug text-white/30">{platform.note}</span>
              </div>
            );
          })}
        </Card>
      </section>

      {/* About ----------------------------------------------------------- */}
      <section>
        <SectionHeading title="About" />
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-[13.5px] font-semibold text-white">
                Infinity Launcher <span className="font-pixel text-[10px] text-white/40">v1.0.0</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-white/35">
                {platformLabel(system?.os ?? '')} · {system?.arch ?? 'x64'} ·{' '}
                {system?.platform === 'mobile' ? 'mobile build' : 'desktop build'}
              </div>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Globe className="h-3.5 w-3.5" />}
                onClick={() => openExternal('https://minecraft.net')}
              >
                Minecraft.net
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                onClick={() =>
                  openExternal(
                    'https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-',
                  )
                }
              >
                GitHub
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-white/30" />
            <p className="text-[11px] leading-relaxed text-white/30">
              Infinity Launcher is an unofficial, community-built launcher. It is not affiliated
              with, endorsed by, or associated with Mojang Studios or Microsoft. Minecraft is a
              trademark of Mojang Synergies AB. You need to own a copy of Minecraft: Java Edition to
              play online.
            </p>
          </div>

          {!isNative ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
              <Sparkles className="h-3.5 w-3.5 flex-none text-amber-300" />
              <p className="flex-1 text-[11px] leading-relaxed text-amber-100/70">
                You are viewing the browser demo: instances, accounts and downloads are simulated in
                local storage. Build the native app for the real thing.
              </p>
              <Button
                size="sm"
                variant="quiet"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  resetDemoData();
                  window.location.reload();
                }}
              >
                Reset demo
              </Button>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
