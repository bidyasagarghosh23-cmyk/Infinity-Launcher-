import { useMemo, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  FolderOpen,
  Gauge,
  HardDrive,
  Play,
  Square,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useLauncher, selectSelectedInstance } from '../store/launcher';
import { BlockIcon } from '../components/brand/BlockIcon';
import { LoaderBadge } from '../components/brand/LoaderBadge';
import { Avatar } from '../components/brand/Avatar';
import { PLATFORMS } from '../components/brand/PlatformIcons';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Progress } from '../components/ui/Progress';
import { isNative } from '../lib/bridge';
import { api } from '../lib/api';
import { cn, formatRelative, javaLaunchLimitation, platformLabel, requiredJava } from '../lib/util';

export function Home() {
  const instances = useLauncher((state) => state.instances);
  const running = useLauncher((state) => state.running);
  const progress = useLauncher((state) => state.progress);
  const system = useLauncher((state) => state.system);
  const settings = useLauncher((state) => state.settings);
  const accounts = useLauncher((state) => state.accounts);
  const selected = useLauncher(selectSelectedInstance);
  const setRoute = useLauncher((state) => state.setRoute);
  const play = useLauncher((state) => state.play);
  const selectInstance = useLauncher((state) => state.selectInstance);
  const stop = useLauncher((state) => state.stop);
  const install = useLauncher((state) => state.install);

  const account = accounts[0];
  const isRunning = selected ? Boolean(running[selected.id]?.running) : false;
  const launchLimitation = javaLaunchLimitation(system);
  const activeProgress = selected ? progress[selected.id] : undefined;
  const installing = Boolean(activeProgress && activeProgress.stage !== 'error');

  const totalPlaytime = useMemo(
    () => instances.reduce((sum, instance) => sum + instance.playtimeSecs, 0),
    [instances],
  );

  const others = instances.filter((instance) => instance.id !== selected?.id).slice(0, 6);
  const java = system?.java?.[0];
  const recommendedRam = Math.min(
    8192,
    Math.max(2048, Math.floor((system?.totalMemoryMb ?? 8192) * 0.5)),
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      {/* Hero ------------------------------------------------------------ */}
      <Card className="relative overflow-hidden rounded-[28px] border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_10%_-20%,rgba(139,92,246,0.42),transparent_55%),radial-gradient(100%_120%_at_100%_10%,rgba(34,211,238,0.24),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(100deg, black 10%, transparent 70%)',
            WebkitMaskImage: 'linear-gradient(100deg, black 10%, transparent 70%)',
          }}
        />

        <HeroScene icon={selected?.icon ?? 'grass'} running={isRunning} />

        <div className="relative flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60 backdrop-blur">
                <Sparkles className="h-3 w-3 text-violet-300" />
                {selected ? 'Selected instance' : 'No instance yet'}
              </span>
              {selected ? (
                <LoaderBadge loader={selected.loader} version={selected.loaderVersion} />
              ) : null}
              {isRunning ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  In game
                </span>
              ) : null}
            </div>

            <h2 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[42px]">
              {selected ? (
                <>
                  {selected.name}
                  <span className="mt-1 block text-[15px] font-medium tracking-normal text-white/45">
                    Minecraft {selected.mcVersion}
                    {selected.loaderVersion ? ` · ${selected.loader} ${selected.loaderVersion}` : ''}
                  </span>
                </>
              ) : (
                <>
                  Build your first
                  <span className="block text-brand">Infinity instance</span>
                </>
              )}
            </h2>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/45">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {selected ? formatRelative(selected.lastPlayed) : 'Ready to set up'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />
                {selected?.ramMb ?? settings?.ramMb ?? 4096} MB
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                Java {java?.major ?? requiredJava(selected?.mcVersion ?? '1.21')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" />
                {selected?.installed ? 'Installed' : 'Not installed'}
              </span>
            </div>

            {installing && activeProgress ? (
              <div className="mt-5 max-w-md rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between text-[11.5px]">
                  <span className="font-medium capitalize text-white/70">
                    {activeProgress.stage === 'assets'
                      ? 'Downloading assets'
                      : activeProgress.stage === 'libraries'
                        ? 'Downloading libraries'
                        : activeProgress.stage === 'loader'
                          ? 'Installing loader'
                          : activeProgress.stage === 'java'
                            ? 'Preparing Java'
                            : activeProgress.message || 'Working…'}
                  </span>
                  <span className="font-pixel text-[10px] text-white/40">
                    {activeProgress.total > 0
                      ? Math.min(
                          100,
                          Math.round((activeProgress.current / activeProgress.total) * 100),
                        )
                      : 0}
                    %
                  </span>
                </div>
                <Progress value={activeProgress.current} max={activeProgress.total || 1} />
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {selected ? (
                isRunning ? (
                  <Button
                    variant="danger"
                    size="xl"
                    icon={<Square className="h-4 w-4" />}
                    onClick={() => stop(selected.id)}
                  >
                    Stop game
                  </Button>
                ) : selected.installed ? (
                  <Button
                    variant="primary"
                    size="xl"
                    icon={<Play className="h-5 w-5 fill-current" />}
                    onClick={() => play(selected.id)}
                    disabled={installing || !account || Boolean(launchLimitation)}
                    title={launchLimitation ?? undefined}
                    className="min-w-[168px]"
                  >
                    Play
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="xl"
                    icon={<Download className="h-4 w-4" />}
                    onClick={() => install(selected.id)}
                    disabled={installing}
                    className="min-w-[168px]"
                  >
                    {installing ? 'Installing…' : 'Install'}
                  </Button>
                )
              ) : (
                <Button
                  variant="primary"
                  size="xl"
                  icon={<Boxes className="h-4 w-4" />}
                  onClick={() => setRoute('instances')}
                >
                  Create an instance
                </Button>
              )}

              <Button
                variant="ghost"
                size="xl"
                icon={<Boxes className="h-4 w-4" />}
                onClick={() => setRoute('instances')}
              >
                Library
              </Button>

              {selected && isNative ? (
                <Button
                  variant="quiet"
                  size="xl"
                  icon={<FolderOpen className="h-4 w-4" />}
                  onClick={() => api.openInstanceFolder(selected.id).catch(() => undefined)}
                  className="hidden sm:inline-flex"
                >
                  Folder
                </Button>
              ) : null}
            </div>

            {!account ? (
              <p className="mt-3 text-[12px] text-amber-300/80">
                Add an account to start playing —{' '}
                <button
                  onClick={() => setRoute('accounts')}
                  className="font-semibold text-amber-200 underline decoration-amber-300/40 underline-offset-2"
                >
                  sign in
                </button>
                .
              </p>
            ) : null}
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-3 lg:w-auto">
            <Stat label="Instances" value={instances.length} icon={<Boxes className="h-3.5 w-3.5" />} />
            <Stat
              label="Playtime"
              value={`${Math.round(totalPlaytime / 3600)}h`}
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <Stat
              label="Java"
              value={java?.major ?? '—'}
              icon={<Cpu className="h-3.5 w-3.5" />}
            />
            <div className="col-span-3 rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/45">Allocated memory</span>
                <span className="font-pixel text-[10px] text-white/65">
                  {((settings?.ramMb ?? 4096) / 1024).toFixed(1)} /{' '}
                  {((system?.totalMemoryMb ?? 8192) / 1024).toFixed(0)} GB
                </span>
              </div>
              <div className="mt-2">
                <Progress
                  value={settings?.ramMb ?? 4096}
                  max={system?.totalMemoryMb ?? 8192}
                  className="h-1.5"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { route: 'discover' as const, label: 'Discover', desc: 'Mods, packs, shaders, worlds', icon: Download },
          { route: 'content' as const, label: 'Content', desc: 'Toggle mods and packs per instance', icon: Boxes },
          { route: 'appearance' as const, label: 'Appearance', desc: 'Local skins, capes and cosmetics', icon: Sparkles },
          { route: 'engine' as const, label: 'Engine', desc: 'Amethyst status and performance', icon: Cpu },
        ].map((item) => (
          <button key={item.route} onClick={() => setRoute(item.route)} className="panel card-hover flex items-center gap-3 p-4 text-left">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-soft"><item.icon className="h-5 w-5 text-violet-200" /></div>
            <div><div className="text-[13.5px] font-semibold text-white">{item.label}</div><div className="text-[11.5px] text-white/40">{item.desc}</div></div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        {/* Library -------------------------------------------------------- */}
        <div>
          <SectionHeading
            title="Jump back in"
            subtitle="Your installed instances, newest first"
            action={
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setRoute('instances')}
                icon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                View all
              </Button>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {others.length === 0 ? (
              <Card className="col-span-full flex items-center justify-between gap-4 p-5">
                <div>
                  <div className="text-[13.5px] font-semibold text-white">Nothing else here yet</div>
                  <div className="mt-0.5 text-[12px] text-white/40">
                    Create an instance for another version or modpack.
                  </div>
                </div>
                <Button size="sm" onClick={() => setRoute('instances')}>
                  New instance
                </Button>
              </Card>
            ) : (
              others.map((instance) => {
                const live = running[instance.id]?.running;
                return (
                  <button
                    key={instance.id}
                    onClick={() => {
                      void selectInstance(instance.id);
                      void (instance.installed && !launchLimitation
                        ? play(instance.id)
                        : install(instance.id));
                    }}
                    className="card-hover group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-left backdrop-blur transition hover:border-white/15"
                  >
                    <div className="relative flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-black/30">
                      <BlockIcon name={instance.icon} size={34} />
                      {live ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400 ring-2 ring-ink-900" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-white">
                        {instance.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35">
                        <span className="font-pixel text-[9.5px] uppercase tracking-wider text-white/45">
                          {instance.mcVersion}
                        </span>
                        <span>·</span>
                        <span className="capitalize">{instance.loader}</span>
                        {!instance.installed ? (
                          <>
                            <span>·</span>
                            <span className="text-amber-300/80">install</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition group-hover:border-violet-400/40 group-hover:bg-violet-500/20 group-hover:text-violet-200">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-5">
            <SectionHeading
              title="Run it anywhere"
              subtitle="One codebase, five targets — same library and settings"
            />
            <Card className="p-2">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
                {PLATFORMS.map((platform) => {
                  const Glyph = platform.Glyph;
                  const current = system?.os === platform.id;
                  return (
                    <div
                      key={platform.id}
                      className={cn(
                        'flex flex-col gap-1.5 rounded-2xl px-3 py-3 transition',
                        current
                          ? 'bg-gradient-to-b from-violet-500/15 to-transparent ring-1 ring-inset ring-violet-400/25'
                          : 'hover:bg-white/[0.04]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Glyph className={cn('h-4 w-4', current ? 'text-violet-300' : 'text-white/45')} />
                        <span className="text-[12px] font-semibold text-white/80">
                          {platform.label}
                        </span>
                      </div>
                      <span className="text-[10.5px] leading-snug text-white/30">
                        {platform.note}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        {/* Right column --------------------------------------------------- */}
        <div className="flex flex-col gap-5">
          <div>
            <SectionHeading title="Active account" />
            <Card className="p-4">
              {account ? (
                <div className="flex items-center gap-3">
                  <Avatar
                    username={account.username}
                    src={account.avatarUrl}
                    size={48}
                    ring
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-white">
                      {account.username}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={account.kind === 'microsoft' ? 'success' : 'neutral'}>
                        {account.kind === 'microsoft' ? 'Microsoft' : 'Offline'}
                      </Badge>
                      <span className="font-mono text-[10px] text-white/25">
                        {account.uuid.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRoute('accounts')}
                    icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                  >
                    Manage
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/15 text-white/30">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-white">No account yet</div>
                    <div className="text-[11.5px] text-white/40">
                      Add an offline profile in seconds
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setRoute('accounts')}>
                    Add
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div>
            <SectionHeading title="Your device" subtitle={system?.deviceName} />
            <Card className="divide-y divide-white/[0.06] p-1">
              <Row
                icon={<Cpu className="h-3.5 w-3.5" />}
                label="Java runtime"
                value={java ? `${java.version} · ${java.vendor.split(' ')[0]}` : 'Not found'}
                tone={java ? 'ok' : 'warn'}
              />
              <Row
                icon={<Gauge className="h-3.5 w-3.5" />}
                label="Recommended memory"
                value={`${(recommendedRam / 1024).toFixed(0)} GB`}
              />
              <Row
                icon={<HardDrive className="h-3.5 w-3.5" />}
                label="Data folder"
                value={system?.dataDir ?? '—'}
                mono
              />
              <Row
                icon={<Boxes className="h-3.5 w-3.5" />}
                label="Platform"
                value={platformLabel(system?.os ?? '')}
              />
            </Card>
          </div>

          <Card className="relative overflow-hidden p-4">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                Tip
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">
                Allocate about half of your system memory to Minecraft. For big modpacks, 8 GB is
                usually the sweet spot — more can make Java's garbage collector work harder.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setRoute('settings')}
                icon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                Tune memory
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-white/35">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-pixel text-[15px] leading-none text-white">{value}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40">
        {icon}
      </span>
      <span className="text-[12px] text-white/45">{label}</span>
      <span
        className={cn(
          'ml-auto max-w-[55%] truncate text-right text-[12px] font-medium',
          mono ? 'font-mono text-[10.5px]' : '',
          tone === 'warn' ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-white/70',
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/** Floating isometric blocks that decorate the hero card. */

/** Floating isometric blocks that decorate the hero card. */
function HeroScene({ icon, running }: { icon: string; running: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] overflow-hidden sm:w-1/2">
      <div
        className={cn(
          'absolute right-[32%] top-1/2 h-56 w-56 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-700',
          running ? 'bg-emerald-400/25' : 'bg-violet-500/25',
        )}
      />
      <div className="absolute right-[36%] top-1/2 -translate-y-1/2 animate-float opacity-30 sm:opacity-95">
        <BlockIcon name={icon} size={138} className="rotate-[-9deg]" />
      </div>
      <div className="absolute bottom-[16%] right-[47%] hidden animate-drift opacity-70 blur-[0.3px] sm:block">
        <BlockIcon name="diamond" size={58} className="rotate-[12deg]" />
      </div>
      <div className="absolute right-[42%] top-[13%] hidden animate-float opacity-55 [animation-delay:-4s] sm:block">
        <BlockIcon name="gold" size={46} className="rotate-[16deg]" />
      </div>
      <div className="absolute bottom-[14%] right-[24%] hidden animate-drift opacity-35 blur-sm [animation-delay:-2s] sm:block">
        <BlockIcon name="obsidian" size={78} className="rotate-[-14deg]" />
      </div>
      <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-ink-900/60 to-transparent" />
    </div>
  );
}
