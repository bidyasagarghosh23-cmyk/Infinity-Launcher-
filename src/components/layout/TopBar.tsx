import { Minus, Search, Square, X } from 'lucide-react';
import { useLauncher } from '../../store/launcher';
import { isNative } from '../../lib/bridge';
import { platformGlyph } from '../brand/PlatformIcons';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platformLabel } from '../../lib/util';
import { InfinityMark } from '../brand/Logo';
import { Avatar } from '../brand/Avatar';
import type { Route } from '../../store/launcher';

const TITLES: Record<Route, { title: string; subtitle: string }> = {
  home: { title: 'Home', subtitle: 'Your next world is one click away' },
  instances: { title: 'Instances', subtitle: 'Every modpack, version and profile in one place' },
  discover: { title: 'Discover', subtitle: 'Browse Modrinth and CurseForge content' },
  content: { title: 'Content', subtitle: 'Enable, disable and remove per-instance content' },
  appearance: { title: 'Appearance', subtitle: 'Local skins, capes and cosmetic profiles' },
  engine: { title: 'Engine', subtitle: 'Amethyst integration status and performance presets' },
  console: { title: 'Console', subtitle: 'Live game output and installer progress' },
  accounts: { title: 'Accounts', subtitle: 'Microsoft, offline and everything between' },
  settings: { title: 'Settings', subtitle: 'Memory, Java, storage and downloads' },
};

export function TopBar() {
  const route = useLauncher((state) => state.route);
  const search = useLauncher((state) => state.search);
  const setSearch = useLauncher((state) => state.setSearch);
  const system = useLauncher((state) => state.system);
  const account = useLauncher((state) => state.accounts[0]);
  const icon = TITLES[route];

  const Glyph = platformGlyph(system?.os ?? 'windows');
  const nativeWindow = isNative ? getCurrentWindow() : null;

  return (
    <header
      data-tauri-drag-region
      className="relative z-20 flex flex-none items-center gap-3 border-b border-white/[0.06] bg-black/10 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8"
    >
      <div className="flex items-center gap-2.5 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
          <InfinityMark className="h-5 w-5" />
        </div>
      </div>

      <div className="hidden min-w-0 lg:block">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">
          {icon.title}
        </h1>
        <p className="truncate text-[11.5px] text-white/35">{icon.subtitle}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => route !== 'instances' && useLauncher.setState({ route: 'instances' })}
            placeholder="Search instances…"
            className="h-9 w-44 rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-[12.5px] text-white placeholder:text-white/25 transition focus:w-60 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 xl:w-56"
          />
        </div>

        <div className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/50 md:flex">
          <Glyph className="h-3.5 w-3.5 text-white/60" />
          {platformLabel(system?.os ?? 'windows')}
          <span className="text-white/20">·</span>
          <span className="text-white/35">{system?.arch ?? 'x64'}</span>
        </div>

        {isNative ? (
          <div className="ml-1 hidden items-center gap-1 sm:flex">
            <button
              onClick={() => nativeWindow?.minimize()}
              className="rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white"
              aria-label="Minimise"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => nativeWindow?.toggleMaximize()}
              className="rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white"
              aria-label="Maximise"
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              onClick={() => nativeWindow?.close()}
              className="rounded-lg p-1.5 text-white/35 transition hover:bg-rose-500/20 hover:text-rose-300"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {account ? (
          <button
            onClick={() => useLauncher.setState({ route: 'accounts' })}
            className="ml-1 lg:hidden"
            aria-label="Accounts"
          >
            <Avatar username={account.username} src={account.avatarUrl} size={30} />
          </button>
        ) : null}
      </div>
    </header>
  );
}
