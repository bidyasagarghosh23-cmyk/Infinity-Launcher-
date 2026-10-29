import { useEffect, useMemo, useState } from 'react';
import { Boxes, Compass, Cpu, Home, Palette, Puzzle, Search, Settings2, Terminal, Users, Wrench, Zap } from 'lucide-react';
import { useLauncher } from '../../store/launcher';
import type { Route } from '../../store/launcher';
import { cn } from '../../lib/util';
import { BlockIcon } from '../brand/BlockIcon';

const ROUTES: Array<{ id: Route; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'instances', label: 'Instances', icon: Boxes },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'content', label: 'Content', icon: Puzzle },
  { id: 'tools', label: 'Tools · screenshots & backups', icon: Wrench },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'engine', label: 'Engine', icon: Cpu },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const instances = useLauncher((s) => s.instances);
  const setRoute = useLauncher((s) => s.setRoute);
  const selectInstance = useLauncher((s) => s.selectInstance);

  useEffect(() => { if (open) { setQuery(''); setIndex(0); } }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const routes = ROUTES.filter((r) => !q || r.label.toLowerCase().includes(q)).map((r) => ({ kind: 'route' as const, ...r }));
    const inst = instances.filter((i) => !q || i.name.toLowerCase().includes(q) || i.mcVersion.includes(q)).slice(0, 6)
      .map((i) => ({ kind: 'instance' as const, id: i.id, label: i.name, sub: `Minecraft ${i.mcVersion}`, icon: i.icon }));
    return [...routes, ...inst];
  }, [query, instances]);

  useEffect(() => { setIndex(0); }, [results.length]);

  function choose(i: number) {
    const item = results[i];
    if (!item) return;
    if (item.kind === 'route') setRoute(item.id);
    else { void selectInstance(item.id); setRoute('home'); }
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
      if (e.key === 'Enter') { e.preventDefault(); choose(index); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-ink-850/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <Search className="h-4 w-4 text-white/35" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jump to a page or instance…" className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none" />
          <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/40">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? <div className="px-3 py-8 text-center text-[13px] text-white/35">No matches</div> : null}
          {results.map((item, i) => (
            <button key={`${item.kind}-${item.id}`} onMouseEnter={() => setIndex(i)} onClick={() => choose(i)}
              className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition', i === index ? 'bg-violet-500/15 text-white' : 'text-white/65 hover:bg-white/[0.04]')}>
              {item.kind === 'route' ? <item.icon className="h-4 w-4 text-violet-300" /> : <BlockIcon name={item.icon} size={22} />}
              <span className="flex-1 truncate text-[13.5px] font-medium">{item.label}</span>
              {item.kind === 'instance' ? <span className="text-[11px] text-white/35">{item.sub}</span> : <Zap className="h-3 w-3 text-white/20" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-2 text-[10.5px] text-white/30">
          <span>↑↓ navigate</span><span>↵ open</span><span className="ml-auto">Ctrl/⌘ K</span>
        </div>
      </div>
    </div>
  );
}
