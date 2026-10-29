import { useEffect, useMemo, useState } from 'react';
import { Compass, Download, ExternalLink, KeyRound, Search } from 'lucide-react';
import { useLauncher, selectSelectedInstance } from '../store/launcher';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Select, TextInput } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { api } from '../lib/api';
import { isNative, openExternal } from '../lib/bridge';
import type { CatalogFile, CatalogProject, CatalogSource, ContentKind } from '../lib/types';
import { cn, formatBytes } from '../lib/util';

const KINDS: Array<{ id: ContentKind; label: string }> = [
  { id: 'mod', label: 'Mods' },
  { id: 'resourcepack', label: 'Resource packs' },
  { id: 'shader', label: 'Shaders' },
  { id: 'world', label: 'Worlds' },
  { id: 'datapack', label: 'Data packs' },
  { id: 'modpack', label: 'Modpacks' },
];

export function Discover() {
  const instances = useLauncher((state) => state.instances);
  const selected = useLauncher(selectSelectedInstance);
  const toast = useLauncher((state) => state.toast);
  const setRoute = useLauncher((state) => state.setRoute);
  const [kind, setKind] = useState<ContentKind>('mod');
  const [source, setSource] = useState<CatalogSource>('modrinth');
  const [query, setQuery] = useState('');
  const [mcVersion, setMcVersion] = useState(selected?.mcVersion ?? '1.21.1');
  const [loader, setLoader] = useState(selected?.loader ?? 'fabric');
  const [projects, setProjects] = useState<CatalogProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfReady, setCfReady] = useState(false);
  const [target, setTarget] = useState<CatalogProject | null>(null);
  const [files, setFiles] = useState<CatalogFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [instanceId, setInstanceId] = useState(selected?.id ?? '');
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => { void api.catalogStatus().then((status) => setCfReady(status.curseforge)).catch(() => setCfReady(false)); }, []);
  useEffect(() => { if (selected) { setInstanceId(selected.id); setMcVersion(selected.mcVersion); setLoader(selected.loader); } }, [selected?.id]);

  async function search() {
    setLoading(true); setError(null);
    try {
      const page = await api.catalogSearch({ source, kind, query, mcVersion: mcVersion || null, loader: kind === 'mod' ? loader : null, offset: 0 });
      setProjects(page.projects);
      if (!page.projects.length) setError('No results. Try a different search, version or loader.');
    } catch (err) { setError(String(err)); setProjects([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { void search(); }, [kind, source]);

  async function openProject(project: CatalogProject) {
    setTarget(project); setFiles([]); setFilesLoading(true);
    try { setFiles(await api.catalogFiles(project.source, project.id, project.kind, mcVersion || null, kind === 'mod' ? loader : null)); }
    catch (err) { toast({ title: 'Could not load files', description: String(err), tone: 'error' }); }
    finally { setFilesLoading(false); }
  }

  async function install(file: CatalogFile) {
    if (!target || !instanceId) return;
    setInstalling(file.id);
    try {
      await api.installContent({ instanceId, kind: target.kind, project: target, file });
      toast({ title: target.kind === 'modpack' ? 'Modpack archive saved' : 'Installed', description: `${target.title} → ${instances.find((i) => i.id === instanceId)?.name ?? instanceId}`, tone: 'success' });
      setTarget(null);
    } catch (err) { toast({ title: 'Install failed', description: String(err), tone: 'error' }); }
    finally { setInstalling(null); }
  }

  const versionOptions = useMemo(() => Array.from(new Set(['1.21.8', '1.21.1', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9', mcVersion])).filter(Boolean), [mcVersion]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <SectionHeading title="Discover content" subtitle={isNative ? 'Live catalogs. Downloads are checksum-verified and installed into the selected instance.' : 'Browser preview uses demo catalog data. Native builds query Modrinth/CurseForge directly.'} />
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((item) => (
            <button key={item.id} onClick={() => setKind(item.id)} className={cn('rounded-xl px-3 py-2 text-[12.5px] font-semibold transition', kind === item.id ? 'bg-brand text-white shadow-glow-sm' : 'bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white')}>{item.label}</button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <TextInput className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void search()} placeholder={`Search ${KINDS.find((k) => k.id === kind)?.label.toLowerCase()}…`} />
          </div>
          <Select value={source} onChange={(e) => setSource(e.target.value as CatalogSource)} aria-label="Catalog source">
            <option value="modrinth">Modrinth</option>
            <option value="curseforge">CurseForge</option>
          </Select>
          <Select value={mcVersion} onChange={(e) => setMcVersion(e.target.value)} aria-label="Minecraft version">
            {versionOptions.map((version) => <option key={version} value={version}>{version}</option>)}
          </Select>
          <Button variant="primary" onClick={() => void search()} loading={loading} icon={<Compass className="h-4 w-4" />}>Search</Button>
        </div>
        {kind === 'mod' ? (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-white/45">
            <span>Loader</span>
            <Select className="w-40 py-1.5" value={loader} onChange={(e) => setLoader(e.target.value as typeof loader)}>
              {['fabric', 'quilt', 'forge', 'neoforge', 'vanilla'].map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </div>
        ) : null}
        {source === 'curseforge' && !cfReady ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-[12px] text-amber-100/85">
            <KeyRound className="mt-0.5 h-4 w-4 flex-none" />
            CurseForge requires an owner-supplied API key. Set <code>CURSEFORGE_API_KEY</code> on the launcher process; it is never embedded in the app or sent to the WebView.
          </div>
        ) : null}
      </Card>

      {error ? <Card className="p-4 text-[13px] text-white/60">{error}</Card> : null}
      {loading ? <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={`${project.source}:${project.id}`} className="card-hover flex flex-col p-4">
              <div className="flex items-start gap-3">
                {project.iconUrl ? <img src={project.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-lg font-bold text-white/80">{project.title.slice(0, 1)}</div>}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold text-white">{project.title}</h3>
                  <p className="text-[11.5px] text-white/40">{project.author} · {project.downloads.toLocaleString()} downloads</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-white/55">{project.summary}</p>
              <div className="mt-4 flex items-center gap-2">
                <Button size="sm" variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void openProject(project)}>Install</Button>
                <Button size="sm" variant="quiet" icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openExternal(project.webUrl)}>Page</Button>
                <Badge className="ml-auto" tone="info">{project.source}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title={target ? `Install ${target.title}` : ''} description="Choose a file and target instance. Modpacks are saved as archives in this stage; full modpack resolution is tracked on the roadmap." size="lg"
        footer={<Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>}>
        <div className="flex flex-col gap-4">
          <Field label="Target instance">
            <Select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
              {instances.map((instance) => <option key={instance.id} value={instance.id}>{instance.name} · {instance.mcVersion} · {instance.loader}</option>)}
            </Select>
          </Field>
          {filesLoading ? <Spinner className="mx-auto h-5 w-5" /> : files.length === 0 ? <p className="text-[13px] text-white/50">No compatible files found for this version/loader.</p> : (
            <div className="flex flex-col gap-2">
              {files.slice(0, 20).map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-white">{file.name}</div>
                    <div className="text-[11px] text-white/40">{file.fileName} · {formatBytes(file.size)} · {file.gameVersions.slice(0, 4).join(', ')}</div>
                  </div>
                  <Button size="sm" variant="primary" loading={installing === file.id} onClick={() => void install(file)}>Install</Button>
                </div>
              ))}
            </div>
          )}
          <button className="self-start text-[12px] text-violet-300 hover:underline" onClick={() => setRoute('content')}>Open content manager →</button>
        </div>
      </Modal>
    </div>
  );
}
