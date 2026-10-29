import { Boxes, Home, Settings2, Terminal, Users } from 'lucide-react';
import { useLauncher } from '../../store/launcher';
import type { Route } from '../../store/launcher';
import { cn } from '../../lib/util';

const ITEMS: Array<{ id: Route; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'instances', label: 'Library', icon: Boxes },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export function MobileNav() {
  const route = useLauncher((state) => state.route);
  const setRoute = useLauncher((state) => state.setRoute);
  const runningCount = useLauncher(
    (state) => Object.values(state.running).filter((entry) => entry.running).length,
  );

  return (
    <nav className="mobile-nav safe-x relative z-30 flex flex-none items-stretch justify-between gap-1 border-t border-white/[0.07] bg-ink-900/85 px-2 pt-2 backdrop-blur-2xl lg:hidden">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = route === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setRoute(item.id)}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-200',
              active ? 'text-white' : 'text-white/40 active:scale-95',
            )}
          >
            <span
              className={cn(
                'relative flex h-7 w-12 items-center justify-center rounded-xl transition-all',
                active && 'bg-gradient-to-br from-violet-500/25 to-cyan-400/15',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', active && 'text-violet-200')} />
              {item.id === 'console' && runningCount > 0 ? (
                <span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
              ) : null}
            </span>
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
