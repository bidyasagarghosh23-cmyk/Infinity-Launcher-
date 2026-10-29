import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Camera, Download, FolderOpen, Image as ImageIcon, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { useLauncher, selectSelectedInstance } from '../store/launcher';
import { Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { api } from '../lib/api';
import { isNative } from '../lib/bridge';
import { formatBytes, formatRelative } from '../lib/util';
import type { BackupItem, ScreenshotItem } from '../lib/types';

export function Tools() {
  const instances = useLauncher((s) => s.instances);
  const selected = useLauncher(selectSelectedInstance);
  const refreshInstances = useLauncher((s) => s.refreshInstances);
  const selectInstance = useLauncher((s) => s.selectInstance);
  const setRoute = useLauncher((s) => s.setRoute);
  const toast = useLauncher((s) => s.toast);
  const [instanceId, setInstanceId] = useState(selected?.id ?? instances[0]?.id ?? '');
  const [tab, setTab] = useState<'screenshots' | 'backups' | 'import'>('screenshots');
  const [shots, setShots] = useState<ScreenshotItem[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [worlds, setWorlds] = useState<Array<{ id: string; name: string }>>([]);
  const [worldId, setWorldId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScreenshotItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const id = instanceId || instances[0]?.id || '';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, b, w] = await Promise.all([api.listScreenshots(id), api.listBackups(id), api.listWorlds(id)]);
      setShots(s); setBackups(b); setWorlds(w); setWorldId((cur) => cur || w[0]?.id || '');
    } catch (err) { toast({ title: 'Could not load tools', description: String(err), tone: 'error' }); }
  }, [id, toast]);

  useEffect(() => { void load(); }, [load]);

  async function backup() {
    if (!id || !worldId) return;
    setBusy('backup');
    try { const b = await api.backupWorld(id, worldId); toast({ title: 'World backed up', description: `${b.fileName} · ${formatBytes(b.sizeBytes)}`, tone: 'success' }); await load(); }
    catch (err) { toast({ title: 'Backup failed', description: String(err), tone: 'error' }); }
    finally { setBusy(null); }
  }

  async function restore(backupId: string) {
    setBusy(backupId);
    try { const w = await api.restoreBackup(id, backupId); toast({ title: 'World restored', description: w.name, tone: 'success' }); await load(); }
    catch (err) { toast({ title: 'Restore failed', description: String(err), tone: 'error' }); }
    finally { setBusy(null); }
  }

  async function exportInstance() {
    setBusy('export');
    try { const path = await api.exportInstance(id); toast({ title: 'Instance exported', description: path, tone: 'success' }); }
    catch (err) { toast({ title: 'Export failed', description: String(err), tone: 'error' }); }
    finally { setBusy(null); }
  }

  async function duplicate() {
    setBusy('duplicate');
    try { const copy = await api.duplicateInstance(id); await refreshInstances(); toast({ title: 'Instance duplicated', description: copy.name, tone: 'success' }); }
    catch (err) { toast({ title: 'Duplicate failed', description: String(err), tone: 'error' }); }
    finally { setBusy(null); }
  }

  async function importFile(file: File) {
    setBusy('import');
    try {
      // Native: use the file path when available (Tauri file drop), otherwise ask for a path.
      const path = (file as File & { path?: string }).path;
      if (!path) { toast({ title: 'Use a local path', description: 'In the native app, drop a .mrpack/.zip onto the window or enter its full path below.', tone: 'info' }); return; }
      const inst = await api.importModpack({ path });
      await refreshInstances(); await selectInstance(inst.id);
      toast({ title: 'Modpack imported', description: inst.name, tone: 'success' }); setRoute('instances');
    } catch (err) { toast({ title: 'Import failed', description: String(err), tone: 'error' }); }
    finally { setBusy(null); }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <SectionHeading title="Tools" subtitle="Screenshots, world backups, instance export and modpack import" action={
        <div className="flex items-center gap-2">
          <Select value={id} onChange={(e) => setInstanceId(e.target.value)} className="h-9 w-48 text-[12px]">
            {instances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
          <Button size="sm" variant="quiet" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>Refresh</Button>
        </div>
      } />

      <div className="flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
        {([['screenshots', 'Screenshots', Camera], ['backups', 'World backups', Archive], ['import', 'Import / export', Upload]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium transition ${tab === key ? 'bg-violet-500/15 text-violet-100' : 'text-white/45 hover:text-white'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'screenshots' ? (
        <Card className="p-5">
          <SectionHeading title="Screenshot gallery" subtitle={`${shots.length} screenshot${shots.length === 1 ? '' : 's'} in this instance`} />
          {shots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center"><ImageIcon className="h-8 w-8 text-white/20" /><p className="text-[13px] text-white/40">No screenshots yet. They appear here after you capture them in-game.</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shots.map((s) => (
                <button key={s.id} onClick={() => setPreview(s)} className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-black/30 text-left transition hover:border-violet-400/30">
                  <div className="flex aspect-video items-center justify-center bg-black/40"><Camera className="h-6 w-6 text-white/20 transition group-hover:text-violet-300" /></div>
                  <div className="p-2"><div className="truncate text-[11.5px] font-medium text-white/80">{s.fileName}</div><div className="text-[10.5px] text-white/35">{formatBytes(s.sizeBytes)} · {formatRelative(s.modifiedAt)}</div></div>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'backups' ? (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <div className="flex-1"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/40">World</div>
              <Select value={worldId} onChange={(e) => setWorldId(e.target.value)}>{worlds.length === 0 ? <option value="">No worlds found</option> : worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
            </div>
            <Button variant="primary" icon={<Archive className="h-4 w-4" />} loading={busy === 'backup'} disabled={!worldId} onClick={backup}>Back up world</Button>
          </Card>
          <Card className="p-5">
            <SectionHeading title="Backups" subtitle="Stored under the instance's backups/ folder" />
            {backups.length === 0 ? <p className="py-8 text-center text-[13px] text-white/40">No backups yet.</p> : (
              <div className="flex flex-col gap-2">
                {backups.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <Archive className="h-4 w-4 flex-none text-violet-300" />
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium text-white">{b.worldId}</div><div className="text-[11px] text-white/40">{formatBytes(b.sizeBytes)} · {formatRelative(b.createdAt)}</div></div>
                    <Button size="sm" variant="quiet" icon={<RotateCcw className="h-3.5 w-3.5" />} loading={busy === b.id} onClick={() => restore(b.id)}>Restore</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'import' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <SectionHeading title="Import modpack" subtitle="Modrinth .mrpack or CurseForge manifest.zip" />
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void importFile(f); }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
              <Upload className="h-7 w-7 text-violet-300" />
              <p className="text-[12.5px] text-white/50">Drop a .mrpack or CurseForge .zip here{isNative ? '' : ' (native app only)'}.</p>
              <input ref={fileRef} type="file" accept=".mrpack,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
              <Button size="sm" onClick={() => fileRef.current?.click()} loading={busy === 'import'}>Choose file</Button>
            </div>
            <PathImport onDone={async (instId) => { await refreshInstances(); await selectInstance(instId); setRoute('instances'); }} />
          </Card>
          <Card className="p-5">
            <SectionHeading title="Export & duplicate" subtitle="Share a snapshot or branch your setup" />
            <div className="flex flex-col gap-2">
              <Button icon={<Download className="h-4 w-4" />} loading={busy === 'export'} disabled={!id} onClick={exportInstance}>Export instance as .zip</Button>
              <Button icon={<FolderOpen className="h-4 w-4" />} loading={busy === 'duplicate'} disabled={!id} onClick={duplicate}>Duplicate instance</Button>
              <p className="mt-2 text-[11.5px] leading-relaxed text-white/35">Exports land in the launcher data folder under <span className="font-mono">exports/</span>. Imports download only from Modrinth/CurseForge CDNs and verify hashes.</p>
            </div>
          </Card>
        </div>
      ) : null}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.fileName ?? ''} description={preview ? `${formatBytes(preview.sizeBytes)} · ${formatRelative(preview.modifiedAt)}` : undefined}>
        {preview ? <div className="flex flex-col gap-3"><div className="flex aspect-video items-center justify-center rounded-2xl bg-black/40"><Camera className="h-10 w-10 text-white/20" /></div><Button size="sm" icon={<FolderOpen className="h-3.5 w-3.5" />} onClick={() => api.openPath(preview.path).catch(() => undefined)}>Open file</Button></div> : null}
      </Modal>
    </div>
  );
}

function PathImport({ onDone }: { onDone: (id: string) => Promise<void> }) {
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useLauncher((s) => s.toast);
  async function go() {
    if (!path.trim()) return;
    setBusy(true);
    try { const inst = await api.importModpack({ path: path.trim() }); toast({ title: 'Modpack imported', description: inst.name, tone: 'success' }); await onDone(inst.id); }
    catch (err) { toast({ title: 'Import failed', description: String(err), tone: 'error' }); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-4 flex gap-2">
      <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/full/path/to/pack.mrpack" className="input h-9 flex-1 text-[12px]" />
      <Button size="sm" loading={busy} onClick={go}>Import path</Button>
    </div>
  );
}
