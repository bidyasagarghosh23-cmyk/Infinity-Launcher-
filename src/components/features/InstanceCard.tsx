import { useState } from 'react';
import {
  Download,
  FolderOpen,
  MoreHorizontal,
  Play,
  Square,
  Trash2,
  Zap,
  Star,
  Copy,
  Archive,
} from 'lucide-react';
import type { Instance, Progress } from '../../lib/types';
import { BlockIcon } from '../brand/BlockIcon';
import { LoaderBadge } from '../brand/LoaderBadge';
import { Button } from '../ui/Button';
import { Progress as ProgressBar } from '../ui/Progress';
import { cn, formatPlaytime, formatRelative, javaLaunchLimitation } from '../../lib/util';
import { useLauncher } from '../../store/launcher';
import { api } from '../../lib/api';

export function InstanceCard({ instance, progress }: { instance: Instance; progress?: Progress }) {
  const play = useLauncher((state) => state.play);
  const stop = useLauncher((state) => state.stop);
  const install = useLauncher((state) => state.install);
  const remove = useLauncher((state) => state.removeInstance);
  const selectInstance = useLauncher((state) => state.selectInstance);
  const selectedId = useLauncher((state) => state.settings?.selectedInstance);
  const launchLimitation = javaLaunchLimitation(useLauncher((state) => state.system));
  const running = useLauncher((state) => state.running[instance.id]?.running ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const favorites = useLauncher((s) => s.settings?.favoriteInstances ?? []);
  const patchSettings = useLauncher((s) => s.patchSettings);
  const refreshInstances = useLauncher((s) => s.refreshInstances);
  const toast = useLauncher((s) => s.toast);
  const isFavorite = favorites.includes(instance.id);

  const installing = Boolean(progress && progress.stage !== 'done' && progress.stage !== 'error');
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;
  const selected = selectedId === instance.id;

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl border p-4 transition-all duration-300',
        selected
          ? 'border-violet-400/30 bg-gradient-to-b from-violet-500/[0.10] to-white/[0.02] shadow-glow-sm'
          : 'border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]',
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-200">
          <Zap className="h-2.5 w-2.5" /> selected
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        <div className="relative flex h-16 w-16 flex-none items-center justify-center rounded-2xl border border-white/[0.06] bg-black/30">
          <BlockIcon name={instance.icon} size={46} />
          {running ? (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-ink-900">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-900" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate pr-14 text-[14.5px] font-semibold text-white">{instance.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-pixel text-[9px] uppercase tracking-wider text-white/60">
              {instance.mcVersion}
            </span>
            <LoaderBadge loader={instance.loader} version={instance.loaderVersion} size="sm" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-white/35">
        <span>{formatPlaytime(instance.playtimeSecs)}</span>
        <span className="h-1 w-1 rounded-full bg-white/15" />
        <span>{instance.ramMb ?? 4096} MB</span>
        <span className="h-1 w-1 rounded-full bg-white/15" />
        <span>{formatRelative(instance.lastPlayed)}</span>
      </div>

      {installing && progress ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-white/45">
            <span className="truncate capitalize">{progress.stage}</span>
            <span className="font-pixel text-[9.5px]">{percent}%</span>
          </div>
          <ProgressBar value={progress.current} max={progress.total || 1} className="h-1.5" />
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        {running ? (
          <Button
            variant="danger"
            size="sm"
            block
            icon={<Square className="h-3 w-3 fill-current" />}
            onClick={() => stop(instance.id)}
          >
            Stop
          </Button>
        ) : instance.installed ? (
          <Button
            variant={selected ? 'primary' : 'ghost'}
            size="sm"
            block
            icon={<Play className="h-3 w-3 fill-current" />}
            onClick={async () => {
              await selectInstance(instance.id);
              await play(instance.id);
            }}
            disabled={installing || Boolean(launchLimitation)}
            title={launchLimitation ?? undefined}
          >
            Play
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            block
            icon={<Download className="h-3 w-3" />}
            onClick={() => install(instance.id)}
            disabled={installing}
          >
            {installing ? 'Installing…' : 'Install'}
          </Button>
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/45 transition hover:border-white/20 hover:text-white"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <>
              <button
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              />
              <div className="absolute bottom-10 right-0 z-30 w-52 animate-scale-in overflow-hidden rounded-2xl border border-white/10 bg-ink-800/95 p-1 shadow-card backdrop-blur-2xl">
                <MenuItem
                  icon={<Play className="h-3.5 w-3.5" />}
                  label="Set as selected"
                  onClick={() => {
                    void selectInstance(instance.id);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Download className="h-3.5 w-3.5" />}
                  label={instance.installed ? 'Reinstall / repair' : 'Install'}
                  onClick={() => {
                    void install(instance.id, true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Star className="h-3.5 w-3.5" />}
                  label={isFavorite ? 'Remove favorite' : 'Add favorite'}
                  onClick={() => { void api.setFavoriteInstance(instance.id, !isFavorite).then(patchSettings).catch((err) => toast({ title: 'Favorite failed', description: String(err), tone: 'error' })); setMenuOpen(false); }}
                />
                <MenuItem
                  icon={<Copy className="h-3.5 w-3.5" />}
                  label="Duplicate"
                  onClick={() => { void api.duplicateInstance(instance.id).then(async (copy) => { await refreshInstances(); toast({ title: 'Duplicated', description: copy.name, tone: 'success' }); }).catch((err) => toast({ title: 'Duplicate failed', description: String(err), tone: 'error' })); setMenuOpen(false); }}
                />
                <MenuItem
                  icon={<Archive className="h-3.5 w-3.5" />}
                  label="Export .zip"
                  onClick={() => { void api.exportInstance(instance.id).then((path) => toast({ title: 'Exported', description: path, tone: 'success' })).catch((err) => toast({ title: 'Export failed', description: String(err), tone: 'error' })); setMenuOpen(false); }}
                />
                <MenuItem
                  icon={<FolderOpen className="h-3.5 w-3.5" />}
                  label="Open game folder"
                  onClick={() => {
                    void api.openInstanceFolder(instance.id).catch(() => undefined);
                    setMenuOpen(false);
                  }}
                />
                <div className="my-1 h-px bg-white/[0.07]" />
                {confirming ? (
                  <button
                    onClick={() => {
                      void remove(instance.id);
                      setMenuOpen(false);
                      setConfirming(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl bg-rose-500/15 px-2.5 py-2 text-[12px] font-medium text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Confirm delete
                  </button>
                ) : (
                  <MenuItem
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    label="Delete instance"
                    danger
                    onClick={() => setConfirming(true)}
                  />
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12px] font-medium transition',
        danger
          ? 'text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-200'
          : 'text-white/65 hover:bg-white/[0.07] hover:text-white',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
