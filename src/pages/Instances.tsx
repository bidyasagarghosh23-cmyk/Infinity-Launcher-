import { useMemo, useState } from 'react';
import { Filter, LayoutGrid, List, Plus, Search, Sparkles } from 'lucide-react';
import { useLauncher } from '../store/launcher';
import { InstanceCard } from '../components/features/InstanceCard';
import { CreateInstanceModal } from '../components/features/CreateInstanceModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { BlockIcon } from '../components/brand/BlockIcon';
import { cn } from '../lib/util';

type FilterKey = 'all' | 'installed' | 'not-installed' | 'modded';

export function Instances() {
  const instances = useLauncher((state) => state.instances);
  const progress = useLauncher((state) => state.progress);
  const search = useLauncher((state) => state.search);
  const setSearch = useLauncher((state) => state.setSearch);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return instances.filter((instance) => {
      if (term) {
        const haystack = `${instance.name} ${instance.mcVersion} ${instance.loader}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      switch (filter) {
        case 'installed':
          return instance.installed;
        case 'not-installed':
          return !instance.installed;
        case 'modded':
          return instance.loader !== 'vanilla';
        default:
          return true;
      }
    });
  }, [instances, search, filter]);

  const filters: Array<{ id: FilterKey; label: string; count: number }> = [
    { id: 'all', label: 'All', count: instances.length },
    { id: 'installed', label: 'Installed', count: instances.filter((i) => i.installed).length },
    {
      id: 'not-installed',
      label: 'Not installed',
      count: instances.filter((i) => !i.installed).length,
    },
    {
      id: 'modded',
      label: 'Modded',
      count: instances.filter((i) => i.loader !== 'vanilla').length,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/30">
            <Filter className="h-3 w-3" />
            Filter
          </span>
          {filters.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setFilter(entry.id)}
              className={cn(
                'rounded-xl border px-2.5 py-1.5 text-[11.5px] font-medium transition',
                filter === entry.id
                  ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                  : 'border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/20 hover:text-white/80',
              )}
            >
              {entry.label}
              <span className="ml-1.5 text-white/25">{entry.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative sm:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search…"
              className="h-9 w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-[12.5px] placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none"
            />
          </div>
          <div className="hidden items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1 sm:flex">
            <button
              onClick={() => setLayout('grid')}
              className={cn(
                'rounded-lg p-1.5 transition',
                layout === 'grid' ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/70',
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setLayout('list')}
              className={cn(
                'rounded-lg p-1.5 transition',
                layout === 'list' ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/70',
              )}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setModalOpen(true)}
          >
            New instance
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <div className="flex gap-2">
            <BlockIcon name="grass" size={48} />
            <BlockIcon name="diamond" size={48} />
            <BlockIcon name="gold" size={48} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white">No instances match</h3>
            <p className="mt-1 text-[12.5px] text-white/40">
              {instances.length === 0
                ? 'Create your first profile to start downloading Minecraft.'
                : 'Try a different filter or clear the search box.'}
            </p>
          </div>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            Create an instance
          </Button>
        </Card>
      ) : (
        <div
          className={cn(
            'grid gap-3.5',
            layout === 'grid'
              ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-2',
          )}
        >
          {filtered.map((instance) => (
            <InstanceCard key={instance.id} instance={instance} progress={progress[instance.id]} />
          ))}

          <button
            onClick={() => setModalOpen(true)}
            className="group flex min-h-[196px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-white/12 bg-white/[0.015] p-6 transition hover:border-violet-400/40 hover:bg-violet-500/[0.06]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/40 transition group-hover:border-violet-400/40 group-hover:bg-violet-500/15 group-hover:text-violet-200">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-[12.5px] font-medium text-white/45 group-hover:text-white/80">
              Add another instance
            </span>
          </button>
        </div>
      )}

      <Card className="flex flex-col gap-3 border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-violet-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-[12.5px] font-semibold text-white/80">Mods, shaders and packs</div>
          <div className="text-[11.5px] text-white/35">
            Drop them in <span className="font-mono text-white/50">mods/</span>,{' '}
            <span className="font-mono text-white/50">shaderpacks/</span> or{' '}
            <span className="font-mono text-white/50">resourcepacks/</span> inside an instance
            folder — no extra setup required.
          </div>
        </div>
      </Card>

      <CreateInstanceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
