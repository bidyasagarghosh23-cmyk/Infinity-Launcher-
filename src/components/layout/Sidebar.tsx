import { Boxes, Compass, Home, Palette, Puzzle, Settings2, Terminal, Users, Zap, Cpu } from 'lucide-react';
import { LogoLockup } from '../brand/Logo';
import { Avatar } from '../brand/Avatar';
import { useLauncher, selectSelectedInstance } from '../../store/launcher';
import type { Route } from '../../store/launcher';
import { cn, formatRelative } from '../../lib/util';
import { LoaderBadge } from '../brand/LoaderBadge';

const NAV: Array<{ id: Route; label: string; icon: typeof Home; hint?: string }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'instances', label: 'Instances', icon: Boxes },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'content', label: 'Content', icon: Puzzle },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'engine', label: 'Engine', icon: Cpu },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export function Sidebar() {
  const route = useLauncher((state) => state.route);
  const setRoute = useLauncher((state) => state.setRoute);
  const accounts = useLauncher((state) => state.accounts);
  const instances = useLauncher((state) => state.instances);
  const running = useLauncher((state) => state.running);
  const selected = useLauncher(selectSelectedInstance);
  const account = accounts[0];
  const runningCount = Object.values(running).filter((entry) => entry.running).length;

  return (
    <aside className="relative hidden w-[264px] flex-none flex-col gap-6 border-r border-white/[0.06] bg-black/20 px-4 py-5 backdrop-blur-xl lg:flex">
      <div className="px-1">
        <LogoLockup />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = route === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setRoute(item.id)}
              className={cn(
                'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200',
                active
                  ? 'bg-white/[0.07] text-white shadow-inset'
                  : 'text-white/50 hover:bg-white/[0.04] hover:text-white/85',
              )}
            >
              {active ? (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand"
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn(
                  'h-[17px] w-[17px] transition-colors',
                  active ? 'text-violet-300' : 'text-white/40 group-hover:text-white/70',
                )}
              />
              {item.label}
              {item.id === 'console' && runningCount > 0 ? (
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  live
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {selected ? (
        <button
          onClick={() => setRoute('home')}
          className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              Ready to play
            </span>
          </div>
          <div className="mt-2 truncate text-[13px] font-semibold text-white">{selected.name}</div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/35">
              {selected.installed ? formatRelative(selected.lastPlayed) : 'Not installed'}
            </span>
            <LoaderBadge loader={selected.loader} size="sm" />
          </div>
        </button>
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <div className="flex items-center justify-between text-[11px] text-white/35">
            <span>Library</span>
            <span className="font-pixel text-[9px] uppercase tracking-wider text-white/40">
              {instances.length} instances
            </span>
          </div>
        </div>

        <button
          onClick={() => setRoute('accounts')}
          className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          {account ? (
            <>
              <Avatar username={account.username} src={account.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-white">
                  {account.username}
                </div>
                <div className="text-[10.5px] uppercase tracking-wide text-white/35">
                  {account.kind === 'microsoft' ? 'Microsoft' : 'Offline'}
                </div>
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </>
          ) : (
            <div className="py-1 text-[12.5px] text-white/50">Add an account</div>
          )}
        </button>
      </div>
    </aside>
  );
}
