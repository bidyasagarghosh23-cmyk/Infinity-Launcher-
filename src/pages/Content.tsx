import { useEffect, useState } from 'react';
import { FolderOpen, Puzzle, RefreshCw, Trash2 } from 'lucide-react';
import { useLauncher, selectSelectedInstance } from '../store/launcher';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select, Toggle } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { api } from '../lib/api';
import type { ContentItem, ContentKind } from '../lib/types';
import { cn, formatBytes, formatRelative } from '../lib/util';

const KINDS: Array<{ id: ContentKind; label: string; hint: string }> = [
  { id: 'mod', label: 'Mods', hint: 'Disabled mods are renamed to .jar.disabled so Minecraft ignores them.' },
  { id: 'resourcepack', label: 'Resource packs', hint: 'Toggle packs without deleting them. In-game order still follows Minecraft’s selected-packs list.' },
  { id: 'shader', label: 'Shaders', hint: 'Shader packs live in shaderpacks/ and are selected in Iris/OptiFine when those mods are present.' },
  { id: 'world', label: 'Worlds', hint: 'Worlds are folders in saves/. Back up a world before removing it.' },
  { id: 'datapack', label: 'Data packs', hint: 'Instance-level data packs. Per-world data packs stay inside the world folder.' },
  { id: 'modpack', label: 'Modpacks', hint: 'Saved archives. Full modpack import/resolution is a separate staged milestone.' },
];

export function Content() {
  const instances = useLauncher((state) => state.instances);
  const selected = useLauncher(selectSelectedInstance);
  const toast = useLauncher((state) => state.toast);
  const setRoute = useLauncher((state) => state.setRoute);
  const [instanceId, setInstanceId] = useState(selected?.id ?? '');
  const [kind, setKind] = useState<ContentKind>('mod');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (selected) setInstanceId(selected.id); }, [selected?.id]);

  async function refresh() {
    if (!instanceId) return;
    setLoading(true);
    try { setItems(await api.listContent(instanceId, kind)); }
    catch (err) { toast({ title: 'Could not list content', description: String(err), tone: 'error' }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [instanceId, kind]);

  async function toggle(item: ContentItem, enabled: boolean) {
    setBusy(item.id);
    try {
      const updated = await api.toggleContent(instanceId, kind, item.id, enabled);
      setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) { toast({ title: 'Could not toggle content', description: String(err), tone: 'error' }); }
    finally { setBusy(null); }
  }

  async function remove(item: ContentItem) {
    setBusy(item.id);
    try {
      await api.removeContent(instanceId, kind, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      toast({ title: 'Removed', description: item.name, tone: 'info' });
    } catch (err) { toast({ title: 'Could not remove content', description: String(err), tone: 'error' }); }
    finally { setBusy(null); }
  }

  const active = KINDS.find((entry) => entry.id === kind)!;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <SectionHeading title="Content manager" subtitle="Per-instance mods, packs, shaders, worlds and data packs. Changes apply the next time the instance starts." action={<Button size="sm" variant="primary" onClick={() => setRoute('discover')} icon={<Puzzle className="h-3.5 w-3.5" />}>Browse content</Button>} />
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={instanceId} onChange={(e) => setInstanceId(e.target.value)} aria-label="Instance">
            {instances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name} · {instance.mcVersion} · {instance.loader}</option>)}
          </Select>
          <Button variant="ghost" onClick={() => void refresh()} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {KINDS.map((entry) => (
            <button key={entry.id} onClick={() => setKind(entry.id)} className={cn('rounded-xl px-3 py-2 text-[12.5px] font-semibold transition', kind === entry.id ? 'bg-brand text-white shadow-glow-sm' : 'bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white')}>{entry.label}</button>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-white/40">{active.hint}</p>
      </Card>

      {loading ? <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div> : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Puzzle className="h-8 w-8 text-white/25" />
          <p className="text-[14px] font-medium text-white/75">No {active.label.toLowerCase()} in this instance yet</p>
          <Button variant="primary" size="sm" onClick={() => setRoute('discover')}>Find some in Discover</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <Card key={item.id} className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', !item.enabled && 'opacity-70')}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[14px] font-semibold text-white">{item.name}</h3>
                  <Badge tone={item.enabled ? 'success' : 'neutral'}>{item.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  {item.source ? <Badge tone="info">{item.source}</Badge> : null}
                </div>
                <p className="mt-1 truncate text-[11.5px] text-white/40">{item.fileName} · {formatBytes(item.sizeBytes)} · added {formatRelative(item.installedAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Toggle checked={item.enabled} disabled={busy === item.id} onChange={(value) => void toggle(item, value)} label={<span className="sr-only">Enable {item.name}</span>} />
                <Button size="sm" variant="danger" disabled={busy === item.id} onClick={() => void remove(item)} icon={<Trash2 className="h-3.5 w-3.5" />}>Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-[11.5px] text-white/35"><FolderOpen className="h-3.5 w-3.5" /> Native builds can also open the instance folder from the Instances page for manual edits.</div>
    </div>
  );
}
