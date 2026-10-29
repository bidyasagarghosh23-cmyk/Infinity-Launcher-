import { useEffect, useState } from 'react';
import { Cpu, ExternalLink, Gauge, Play, ShieldCheck, Smartphone } from 'lucide-react';
import { useLauncher, selectSelectedInstance } from '../store/launcher';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { api } from '../lib/api';
import { openExternal } from '../lib/bridge';
import type { EngineStatus, PerformancePreset } from '../lib/types';
import { cn } from '../lib/util';

const ROADMAP = [
  ['Hub + catalogs + content toggles', 'implemented'],
  ['Local appearance studio', 'implemented'],
  ['Performance presets → options.txt', 'implemented'],
  ['Amethyst source pin + license notices', 'prepared'],
  ['Android runtime packaging (JRE + LWJGL + renderers)', 'next'],
  ['Amethyst launch bridge + touch controls', 'next'],
  ['Physical-device gameplay verification', 'required before enabling Play'],
  ['In-game cosmetics bridge', 'future'],
  ['Modpack import (.mrpack / CurseForge)', 'implemented'],
  ['Screenshots, backups, favorites, export', 'implemented'],
  ['Android engine handoff (external Amethyst)', 'implemented'],
  ['Full modpack dependency resolution', 'future'],
] as const;

export function Engine() {
  const selected = useLauncher(selectSelectedInstance);
  const settings = useLauncher((state) => state.settings);
  const patchSettings = useLauncher((state) => state.patchSettings);
  const toast = useLauncher((state) => state.toast);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [presets, setPresets] = useState<PerformancePreset[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const system = useLauncher((s) => s.system);

  useEffect(() => {
    void api.engineStatus().then(setStatus).catch(() => setStatus(null));
    void api.performancePresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  async function apply(preset: PerformancePreset) {
    if (!selected) return;
    setApplying(preset.id);
    try {
      await api.applyPerformance(selected.id, preset.id);
      await patchSettings({ performanceProfile: preset.id });
      toast({ title: `${preset.name} applied`, description: `Updated options.txt for ${selected.name}. Restart the game to pick up the new values.`, tone: 'success' });
    } catch (err) { toast({ title: 'Could not apply preset', description: String(err), tone: 'error' }); }
    finally { setApplying(null); }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <SectionHeading title="Engine & performance" subtitle="Honest integration status: Android Java gameplay is not enabled until Amethyst is packaged and device-tested." />
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft"><Cpu className="h-6 w-6 text-violet-200" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold text-white">{status?.name ?? 'Amethyst'}</h3>
              <Badge tone={status?.gameplayVerified ? 'success' : 'warn'}>{status?.gameplayVerified ? 'Verified' : 'Not bundled yet'}</Badge>
              <Badge tone="info">{status?.license ?? 'LGPL-3.0'}</Badge>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">{status?.message ?? 'Loading engine status…'}</p>
            {status ? <p className="mt-2 break-all font-mono text-[11px] text-white/30">Pinned upstream: {status.sourceCommit}</p> : null}
          </div>
          <Button size="sm" variant="ghost" icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openExternal(status?.sourceUrl ?? 'https://github.com/AngelAuraMC/Amethyst-Android')}>Upstream</Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['Integrated', status?.integrated],
            ['Runtime ready', status?.runtimeReady],
            ['Gameplay verified', status?.gameplayVerified],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/[0.07] bg-black/20 p-3">
              <div className="text-[11px] uppercase tracking-wider text-white/35">{String(label)}</div>
              <div className={cn('mt-1 text-[13px] font-semibold', value ? 'text-emerald-300' : 'text-amber-300')}>{value ? 'Yes' : 'Not yet'}</div>
            </div>
          ))}
        </div>
      </Card>

      {system?.os === 'android' ? (
        <Card className="flex flex-col gap-3 border-violet-400/25 bg-violet-500/[0.06] p-5 sm:flex-row sm:items-center">
          <Smartphone className="h-6 w-6 flex-none text-violet-300" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-white">Android engine handoff</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">Infinity manages your library here. To play Java Edition on this device, open the installed Amethyst engine and select/import the instance there. Embedded in-app gameplay is not enabled until device verification passes.</p>
          </div>
          <Button variant="primary" icon={<Play className="h-4 w-4" />} loading={handoff} onClick={async () => { setHandoff(true); try { await api.openAndroidEngine(); toast({ title: 'Opening Amethyst', tone: 'info' }); } catch (err) { toast({ title: 'Install Amethyst first', description: String(err), tone: 'error' }); } finally { setHandoff(false); } }}>Open Amethyst</Button>
        </Card>
      ) : null}

      <section>
        <SectionHeading title="Performance presets" subtitle={selected ? `Apply to ${selected.name} by updating its options.txt. These are conservative vanilla settings, not engine-level patches.` : 'Create an instance first.'} />
        <div className="grid gap-3 sm:grid-cols-3">
          {presets.map((preset) => (
            <Card key={preset.id} className={cn('flex flex-col gap-3 p-4', settings?.performanceProfile === preset.id && 'border-violet-400/40')}>
              <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-violet-300" /><h3 className="text-[14px] font-semibold text-white">{preset.name}</h3></div>
              <ul className="flex-1 space-y-1 text-[12px] text-white/50">
                <li>Render distance: {preset.renderDistance}</li>
                <li>Simulation: {preset.simulationDistance}</li>
                <li>FPS cap: {preset.maxFps}</li>
                <li>Graphics mode: {preset.graphicsMode}</li>
              </ul>
              <Button size="sm" variant={settings?.performanceProfile === preset.id ? 'ghost' : 'primary'} disabled={!selected} loading={applying === preset.id} onClick={() => void apply(preset)}>Apply</Button>
            </Card>
          ))}
        </div>
      </section>

      {settings ? (
        <Card className="p-5">
          <SectionHeading title="Android renderer preference" subtitle="Saved for the future Amethyst bridge. It does not affect this build until the engine is integrated." className="mb-3" />
          <Select value={settings.androidRenderer} onChange={(e) => void patchSettings({ androidRenderer: e.target.value })} className="max-w-xs">
            {(status?.renderers ?? ['gl4es', 'mobileglues', 'angle', 'mesa']).map((renderer) => <option key={renderer} value={renderer}>{renderer}</option>)}
          </Select>
        </Card>
      ) : null}

      <Card className="p-5">
        <SectionHeading title="Staged roadmap" className="mb-3" />
        <div className="flex flex-col gap-2">
          {ROADMAP.map(([label, state]) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <ShieldCheck className={cn('h-4 w-4', state === 'implemented' || state === 'prepared' ? 'text-emerald-300' : 'text-white/25')} />
              <span className="flex-1 text-[13px] text-white/75">{label}</span>
              <Badge tone={state === 'implemented' ? 'success' : state === 'prepared' ? 'info' : state === 'next' ? 'warn' : 'neutral'}>{state}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
