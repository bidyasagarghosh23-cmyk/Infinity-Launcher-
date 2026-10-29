import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Search, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { BlockIcon, BLOCK_NAMES } from '../brand/BlockIcon';
import { LoaderBadge } from '../brand/LoaderBadge';
import { useLauncher } from '../../store/launcher';
import { api } from '../../lib/api';
import type { Loader, LoaderVersion, VersionSummary } from '../../lib/types';
import { cn, requiredJava } from '../../lib/util';
import { Spinner } from '../ui/Spinner';

const LOADERS: Array<{ id: Loader; label: string; blurb: string }> = [
  { id: 'vanilla', label: 'Vanilla', blurb: 'Pure Mojang build' },
  { id: 'fabric', label: 'Fabric', blurb: 'Lightweight modding' },
  { id: 'quilt', label: 'Quilt', blurb: 'Fabric-compatible fork' },
  { id: 'forge', label: 'Forge', blurb: 'Classic modpacks' },
  { id: 'neoforge', label: 'NeoForge', blurb: 'Modern Forge fork' },
];

export function CreateInstanceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const manifest = useLauncher((state) => state.manifest);
  const settings = useLauncher((state) => state.settings);
  const createInstance = useLauncher((state) => state.createInstance);
  const install = useLauncher((state) => state.install);
  const route = useLauncher((state) => state.setRoute);

  const [name, setName] = useState('');
  const [mcVersion, setMcVersion] = useState('1.21.8');
  const [loader, setLoader] = useState<Loader>('vanilla');
  const [loaderVersion, setLoaderVersion] = useState<string | null>(null);
  const [versions, setVersions] = useState<LoaderVersion[]>([]);
  const [loadingLoader, setLoadingLoader] = useState(false);
  const [icon, setIcon] = useState('grass');
  const [ram, setRam] = useState(settings?.ramMb ?? 4096);
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<'details' | 'version'>('details');
  const [submitting, setSubmitting] = useState(false);

  const releases = useMemo(() => {
    const list = manifest?.versions ?? [];
    const filtered = list.filter((version: VersionSummary) =>
      /^\d+\.\d+(\.\d+)?$/.test(version.id),
    );
    if (!query.trim()) return filtered.slice(0, 40);
    return filtered
      .filter((version) => version.id.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 40);
  }, [manifest, query]);

  useEffect(() => {
    if (!open) return;
    setStep('details');
    setQuery('');
    setLoaderVersion(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (loader === 'vanilla') {
      setVersions([]);
      setLoaderVersion(null);
      return;
    }
    let cancelled = false;
    setLoadingLoader(true);
    api
      .fetchLoaderVersions(loader, mcVersion)
      .then((list) => {
        if (cancelled) return;
        setVersions(list);
        setLoaderVersion(list[0]?.version ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([]);
          setLoaderVersion(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLoader(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loader, mcVersion]);

  const suggestedName = useMemo(() => {
    if (loader === 'vanilla') return `Vanilla ${mcVersion}`;
    const label = LOADERS.find((entry) => entry.id === loader)?.label ?? loader;
    return `${label} ${mcVersion}`;
  }, [loader, mcVersion]);

  async function submit(andInstall: boolean) {
    setSubmitting(true);
    const instance = await createInstance({
      name: name.trim() || suggestedName,
      mcVersion,
      loader,
      loaderVersion,
      icon,
      ramMb: ram,
    });
    setSubmitting(false);
    if (!instance) return;
    onClose();
    if (andInstall) {
      await install(instance.id);
      route('console');
    } else {
      route('instances');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New instance"
      description="Pick a Minecraft version, optionally a mod loader, and Infinity handles the rest."
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={() => submit(false)}
            disabled={submitting || (loader !== 'vanilla' && !loaderVersion)}
          >
            Create
          </Button>
          <Button
            variant="primary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => submit(true)}
            loading={submitting}
            disabled={loader !== 'vanilla' && !loaderVersion}
          >
            Create &amp; install
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Instance name">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={suggestedName}
            />
          </Field>
          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_NAMES.slice(0, 7).map((block) => (
                <button
                  key={block}
                  onClick={() => setIcon(block)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border transition',
                    icon === block
                      ? 'border-violet-400/60 bg-violet-500/15'
                      : 'border-white/10 bg-black/25 hover:border-white/25',
                  )}
                  aria-label={block}
                >
                  <BlockIcon name={block} size={22} />
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/40">
              Minecraft version
            </span>
            <span className="font-pixel text-[9px] uppercase tracking-wider text-white/30">
              java {requiredJava(mcVersion)}
            </span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search releases…"
                className="h-9 w-full rounded-xl border border-white/[0.07] bg-black/30 pl-9 pr-3 text-[12.5px] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <div className="scroll-area grid max-h-44 grid-cols-3 gap-1 sm:grid-cols-4">
              {releases.length === 0 ? (
                <div className="col-span-full flex items-center justify-center gap-2 py-6 text-[12px] text-white/35">
                  <Spinner className="h-3.5 w-3.5" /> Loading versions…
                </div>
              ) : (
                releases.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setMcVersion(version.id)}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-2.5 py-2 text-left transition',
                      mcVersion === version.id
                        ? 'border-violet-400/50 bg-violet-500/15 text-white'
                        : 'border-transparent text-white/55 hover:bg-white/[0.05] hover:text-white',
                    )}
                  >
                    <span className="font-pixel text-[10px] tracking-wide">{version.id}</span>
                    {mcVersion === version.id ? <Check className="h-3 w-3 text-violet-300" /> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/40">
            Mod loader
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {LOADERS.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setLoader(entry.id)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-2xl border p-2.5 text-left transition',
                  loader === entry.id
                    ? 'border-violet-400/50 bg-violet-500/10'
                    : 'border-white/[0.07] bg-black/20 hover:border-white/20',
                )}
              >
                <LoaderBadge loader={entry.id} size="sm" />
                <span className="text-[10px] leading-tight text-white/35">{entry.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {loader !== 'vanilla' ? (
          <div className="animate-fade-up">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/40">
              Loader build
            </span>
            {loadingLoader ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-[12px] text-white/40">
                <Spinner className="h-3.5 w-3.5" /> Checking available builds for {mcVersion}…
              </div>
            ) : versions.length === 0 ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-3 text-[12px] text-amber-200/80">
                No {loader} builds for {mcVersion}. Try another version or loader.
              </div>
            ) : (
              <div className="scroll-area flex max-h-24 flex-wrap gap-1.5">
                {versions.map((version) => (
                  <button
                    key={version.version}
                    onClick={() => setLoaderVersion(version.version)}
                    className={cn(
                      'rounded-xl border px-2.5 py-1.5 font-mono text-[11px] transition',
                      loaderVersion === version.version
                        ? 'border-violet-400/50 bg-violet-500/15 text-white'
                        : 'border-white/[0.07] bg-black/20 text-white/50 hover:border-white/20 hover:text-white/80',
                    )}
                  >
                    {version.version}
                    {version.stable ? <span className="ml-1 text-emerald-400/70">•</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <Field
          label={`Memory allocation — ${(ram / 1024).toFixed(1)} GB`}
          hint="Pick roughly half of your system RAM. Large modpacks want 6–8 GB."
        >
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={ram}
            onChange={(event) => setRam(Number(event.target.value))}
          />
        </Field>

        <div className="flex items-start gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-violet-300" />
          <p className="text-[11.5px] leading-relaxed text-white/40">
            Instances keep their own game directory, so worlds, mods, resource packs and configs
            never leak between profiles.
          </p>
        </div>

        {step === 'version' ? null : null}
      </div>
    </Modal>
  );
}
