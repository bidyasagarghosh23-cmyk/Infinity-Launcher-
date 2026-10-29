import { useMemo, useState } from 'react';
import { ArrowRight, Boxes, Compass, Cpu, Download, FolderOpen, Gauge, Image as ImageIcon, Newspaper, Palette, Play, Plus, Puzzle, Square, Star, Wrench, Zap } from 'lucide-react';
import { useLauncher, selectSelectedInstance } from '../store/launcher';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BlockIcon } from '../components/brand/BlockIcon';
import { LoaderBadge } from '../components/brand/LoaderBadge';
import { Progress } from '../components/ui/Progress';
import { CreateInstanceModal } from '../components/features/CreateInstanceModal';
import { api } from '../lib/api';
import { openExternal } from '../lib/bridge';
import { cn, formatPlaytime, formatRelative, javaLaunchLimitation, LOADER_LABEL, requiredJava } from '../lib/util';
import type { Route } from '../store/launcher';

const NEWS = [
  { tag: '2.0', title: 'Infinity Client 2.0 is here', body: 'New dashboard, command palette, favorites, screenshots, world backups and modpack import.', tone: 'brand' as const },
  { tag: 'Android', title: 'Amethyst engine handoff', body: 'Open the Amethyst Android engine from the Engine page. In-app Java gameplay is still being verified.', tone: 'warn' as const },
  { tag: 'Content', title: 'Modrinth + CurseForge', body: 'Browse mods, packs, shaders, worlds and modpacks. CurseForge needs an owner-configured API key.', tone: 'info' as const },
];

export function Home() {
  const instances = useLauncher((s) => s.instances);
  const settings = useLauncher((s) => s.settings);
  const system = useLauncher((s) => s.system);
  const progress = useLauncher((s) => s.progress);
  const running = useLauncher((s) => s.running);
  const selected = useLauncher(selectSelectedInstance);
  const play = useLauncher((s) => s.play);
  const stop = useLauncher((s) => s.stop);
  const install = useLauncher((s) => s.install);
  const setRoute = useLauncher((s) => s.setRoute);
  const selectInstance = useLauncher((s) => s.selectInstance);
  const patchSettings = useLauncher((s) => s.patchSettings);
  const toast = useLauncher((s) => s.toast);
  const [createOpen, setCreateOpen] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);

  const limitation = javaLaunchLimitation(system);
  const isRunning = selected ? running[selected.id]?.running ?? false : false;
  const installing = selected ? progress[selected.id] : undefined;
  const favorites = settings?.favoriteInstances ?? [];
  const recent = useMemo(() => [...instances].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)).slice(0, 4), [instances]);
  const profile = settings?.performanceProfile ?? 'balanced';

  async function toggleFavorite(id: string) {
    try {
      const next = await api.setFavoriteInstance(id, !favorites.includes(id));
      await patchSettings(next);
    } catch (err) { toast({ title: 'Could not update favorite', description: String(err), tone: 'error' }); }
  }

  async function androidHandoff() {
    setHandoffBusy(true);
    try {
      await api.openAndroidEngine();
      toast({ title: 'Opening Amethyst', description: 'Select or import your instance there. Infinity keeps your library, content and looks in sync on this device.', tone: 'info' });
    } catch (err) {
      toast({ title: 'Amethyst not available', description: 'Install the Amethyst Android engine, then try again. ' + String(err), tone: 'error' });
    } finally { setHandoffBusy(false); }
  }

  const quick: Array<{ route: Route; label: string; icon: typeof Boxes; blurb: string }> = [
    { route: 'discover', label: 'Discover', icon: Compass, blurb: 'Mods · packs · shaders' },
    { route: 'content', label: 'Content', icon: Puzzle, blurb: 'Toggle & update' },
    { route: 'tools', label: 'Tools', icon: Wrench, blurb: 'Screenshots · backups' },
    { route: 'appearance', label: 'Your look', icon: Palette, blurb: 'Skins · capes' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      {/* Hero */}
      <Card className="relative min-h-[300px] overflow-hidden border-white/[0.08]">
        <img src="/images/infinity-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/70 to-ink-950/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
        <div className="relative flex h-full flex-col justify-between gap-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                <Zap className="h-3 w-3" /> Selected instance
              </div>
              <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[34px]">
                {selected?.name ?? 'Create your first instance'}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-white/60">
                {selected ? (
                  <>
                    <span>Minecraft {selected.mcVersion}</span>
                    <span className="text-white/25">·</span>
                    <LoaderBadge loader={selected.loader} version={selected.loaderVersion} />
                    <span className="text-white/25">·</span>
                    <span>{formatPlaytime(selected.playtimeSecs)}</span>
                  </>
                ) : <span>Pick a version, add mods, and press play.</span>}
              </div>
            </div>
            {selected ? (
              <button onClick={() => toggleFavorite(selected.id)} aria-label="Toggle favorite"
                className={cn('rounded-2xl border p-2.5 transition', favorites.includes(selected.id) ? 'border-amber-300/40 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/30 text-white/50 hover:text-white')}>
                <Star className="h-4 w-4" fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info"><Cpu className="h-3 w-3" /> Java {selected ? requiredJava(selected.mcVersion) : 21}</Badge>
              <Badge tone="brand"><Gauge className="h-3 w-3" /> {profile}</Badge>
              <Badge tone="success">Modrinth</Badge>
              {selected?.installed ? <Badge tone="success">Installed</Badge> : selected ? <Badge tone="warn">Not installed</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected && !selected.installed && !installing ? (
                <Button variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => install(selected.id)}>Install</Button>
              ) : null}
              {limitation && system?.os === 'android' ? (
                <Button variant="primary" size="lg" loading={handoffBusy} icon={<Play className="h-5 w-5" />} onClick={androidHandoff} className="min-w-[180px] shadow-glow">
                  Open Android engine
                </Button>
              ) : isRunning ? (
                <Button variant="danger" size="lg" icon={<Square className="h-5 w-5" />} onClick={() => selected && stop(selected.id)} className="min-w-[180px]">Stop</Button>
              ) : (
                <Button variant="primary" size="lg" icon={<Play className="h-5 w-5" />} disabled={!selected || !selected.installed || Boolean(limitation)} onClick={() => selected && play(selected.id)} className="min-w-[180px] shadow-glow">
                  PLAY
                </Button>
              )}
              <Button variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New</Button>
            </div>
          </div>
          {installing && installing.stage !== 'done' && installing.stage !== 'error' ? (
            <div className="max-w-md"><Progress value={installing.total ? (installing.current / installing.total) * 100 : 0} /><div className="mt-1 text-[11px] text-white/50">{installing.message}</div></div>
          ) : null}
        </div>
      </Card>

      {limitation ? (
        <Card className="flex flex-col gap-3 border-amber-400/20 bg-amber-400/[0.05] p-4 sm:flex-row sm:items-center">
          <Cpu className="h-5 w-5 flex-none text-amber-300" />
          <div className="flex-1 text-[12.5px] leading-relaxed text-amber-100/80">{limitation} On Android you can hand off to the installed Amethyst engine.</div>
          <Button size="sm" onClick={() => setRoute('engine')}>Engine status</Button>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          <div>
            <SectionHeading title="Recent instances" subtitle="Favorites first, then most recently played" action={<Button size="sm" variant="quiet" icon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => setRoute('instances')}>View all</Button>} />
            {recent.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 p-8 text-center">
                <Boxes className="h-8 w-8 text-white/25" />
                <p className="text-[13px] text-white/45">No instances yet. Create one or import a modpack from Tools.</p>
                <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create instance</Button>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...recent].sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))).map((instance) => (
                  <button key={instance.id} onClick={() => selectInstance(instance.id)}
                    className={cn('group flex items-center gap-3 rounded-2xl border p-3 text-left transition', selected?.id === instance.id ? 'border-violet-400/35 bg-violet-500/[0.10]' : 'border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]')}>
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-white/[0.06] bg-black/30"><BlockIcon name={instance.icon} size={36} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><span className="truncate text-[13.5px] font-semibold text-white">{instance.name}</span>{favorites.includes(instance.id) ? <Star className="h-3 w-3 flex-none text-amber-300" fill="currentColor" /> : null}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40"><span>{instance.mcVersion}</span><span>·</span><span>{LOADER_LABEL[instance.loader]}</span><span>·</span><span>{formatRelative(instance.lastPlayed)}</span></div>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-none text-white/20 transition group-hover:text-white/60" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionHeading title="Content quick access" subtitle="Jump straight into your library tools" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quick.map((q) => (
                <button key={q.route} onClick={() => setRoute(q.route)} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition hover:border-violet-400/30 hover:bg-violet-500/[0.07]">
                  <q.icon className="h-5 w-5 text-violet-300" />
                  <div className="mt-3 text-[13px] font-semibold text-white">{q.label}</div>
                  <div className="mt-0.5 text-[11px] text-white/40">{q.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <SectionHeading title="Performance profile" subtitle="Applied to the selected instance" className="mb-3" />
            <div className="grid grid-cols-3 gap-2">
              {(['battery', 'balanced', 'quality'] as const).map((p) => (
                <button key={p} onClick={() => patchSettings({ performanceProfile: p })}
                  className={cn('rounded-xl border px-2 py-2.5 text-[11.5px] font-semibold capitalize transition', profile === p ? 'border-violet-400/40 bg-violet-500/15 text-violet-100' : 'border-white/[0.07] bg-white/[0.02] text-white/50 hover:text-white')}>
                  {p}
                </button>
              ))}
            </div>
            <Button size="sm" variant="quiet" className="mt-3" icon={<Gauge className="h-3.5 w-3.5" />} onClick={() => setRoute('engine')}>Open engine & presets</Button>
          </Card>

          {settings?.showNews !== false ? (
            <Card className="p-5">
              <SectionHeading title={<span className="inline-flex items-center gap-2"><Newspaper className="h-4 w-4 text-violet-300" /> Latest news</span>} className="mb-3" />
              <div className="flex flex-col gap-3">
                {NEWS.map((n) => (
                  <div key={n.title} className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <Badge tone={n.tone}>{n.tag}</Badge>
                    <div className="mt-2 text-[13px] font-semibold text-white">{n.title}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">{n.body}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => openExternal('https://github.com/AngelAuraMC/Amethyst-Android')} className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-violet-300 hover:text-violet-200"><FolderOpen className="h-3 w-3" /> Amethyst on GitHub</button>
            </Card>
          ) : null}

          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft"><ImageIcon className="h-5 w-5 text-violet-200" /></div>
            <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-white">Your look</div><div className="text-[11.5px] text-white/40">Offline skins, capes & cosmetics</div></div>
            <Button size="sm" onClick={() => setRoute('appearance')}>Open</Button>
          </Card>
        </div>
      </div>

      <CreateInstanceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
