import { useEffect, useRef, useState } from 'react';
import { Palette, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { useLauncher } from '../store/launcher';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Select, TextInput, Toggle } from '../components/ui/Field';
import { api } from '../lib/api';
import type { AppearanceProfile } from '../lib/types';
import { cn } from '../lib/util';

const EMPTY: AppearanceProfile = {
  id: '', accountId: '', name: 'My look', skinDataUrl: null, skinVariant: 'classic',
  capeDataUrl: null, capeEnabled: true, capeColor: '#38bdf8', capePattern: 'solid',
  wings: 'none', auraColor: '#a78bfa', auraEnabled: false, updatedAt: 0,
};

function readPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type !== 'image/png') return reject(new Error('Use a PNG texture.'));
    if (file.size > 1024 * 1024) return reject(new Error('Texture must be 1 MiB or smaller.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function SkinPreview({ profile }: { profile: AppearanceProfile }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const draw = (img?: HTMLImageElement) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (profile.auraEnabled) {
        const gradient = ctx.createRadialGradient(96, 120, 20, 96, 120, 110);
        gradient.addColorStop(0, `${profile.auraColor}55`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 192, 240);
      }
      if (profile.capeEnabled) {
        ctx.fillStyle = profile.capeColor;
        ctx.fillRect(58, 78, 76, 108);
        if (profile.capePattern === 'stripe') { ctx.fillStyle = '#ffffff33'; ctx.fillRect(88, 78, 16, 108); }
        if (profile.capePattern === 'gradient') { const g = ctx.createLinearGradient(0, 78, 0, 186); g.addColorStop(0, '#ffffff44'); g.addColorStop(1, '#00000055'); ctx.fillStyle = g; ctx.fillRect(58, 78, 76, 108); }
      }
      if (profile.wings !== 'none') {
        ctx.fillStyle = profile.wings === 'angel' ? '#e2e8f0aa' : '#7c3aedaa';
        ctx.beginPath(); ctx.moveTo(58, 92); ctx.lineTo(18, 62); ctx.lineTo(30, 140); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(134, 92); ctx.lineTo(174, 62); ctx.lineTo(162, 140); ctx.closePath(); ctx.fill();
      }
      if (img) {
        // Minimal front-facing skin renderer: head, body, arms, legs.
        ctx.drawImage(img, 8, 8, 8, 8, 72, 24, 48, 48);
        ctx.drawImage(img, 20, 20, 8, 12, 72, 72, 48, 72);
        ctx.drawImage(img, 44, 20, 4, 12, 48, 72, 24, 72);
        ctx.drawImage(img, 44, 20, 4, 12, 120, 72, 24, 72);
        ctx.drawImage(img, 4, 20, 4, 12, 72, 144, 24, 72);
        ctx.drawImage(img, 4, 20, 4, 12, 96, 144, 24, 72);
      } else {
        ctx.fillStyle = '#c68642'; ctx.fillRect(72, 24, 48, 48);
        ctx.fillStyle = '#38bdf8'; ctx.fillRect(72, 72, 48, 72);
        ctx.fillStyle = '#c68642'; ctx.fillRect(48, 72, 24, 72); ctx.fillRect(120, 72, 24, 72);
        ctx.fillStyle = '#1e3a8a'; ctx.fillRect(72, 144, 24, 72); ctx.fillRect(96, 144, 24, 72);
        ctx.fillStyle = '#fff'; ctx.fillRect(80, 44, 10, 6); ctx.fillRect(102, 44, 10, 6);
        ctx.fillStyle = '#3b2f2f'; ctx.fillRect(84, 44, 5, 6); ctx.fillRect(106, 44, 5, 6);
      }
    };
    if (profile.skinDataUrl) {
      const img = new Image();
      img.onload = () => draw(img);
      img.onerror = () => draw();
      img.src = profile.skinDataUrl;
    } else draw();
  }, [profile]);
  return <canvas ref={canvasRef} width={192} height={240} className="mx-auto h-60 w-48 [image-rendering:pixelated]" aria-label="Local appearance preview" />;
}

export function Appearance() {
  const accounts = useLauncher((state) => state.accounts);
  const toast = useLauncher((state) => state.toast);
  const [profiles, setProfiles] = useState<AppearanceProfile[]>([]);
  const [draft, setDraft] = useState<AppearanceProfile>({ ...EMPTY, accountId: accounts[0]?.id ?? '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { void api.listAppearance().then(setProfiles).catch(() => setProfiles([])); }, []);

  async function save() {
    setSaving(true);
    try {
      const saved = await api.saveAppearance({ ...draft, accountId: draft.accountId || accounts[0]?.id || 'local' });
      setProfiles((current) => [...current.filter((p) => p.id !== saved.id), saved]);
      setDraft(saved);
      toast({ title: 'Look saved locally', description: 'This profile is stored on this device. It is not injected into Minecraft or visible to servers yet.', tone: 'success' });
    } catch (err) { toast({ title: 'Could not save look', description: String(err), tone: 'error' }); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    try { await api.removeAppearance(id); setProfiles((current) => current.filter((p) => p.id !== id)); }
    catch (err) { toast({ title: 'Could not remove look', description: String(err), tone: 'error' }); }
  }

  async function upload(kind: 'skin' | 'cape', file?: File) {
    if (!file) return;
    try {
      const dataUrl = await readPng(file);
      setDraft((current) => kind === 'skin' ? { ...current, skinDataUrl: dataUrl } : { ...current, capeDataUrl: dataUrl });
    } catch (err) { toast({ title: 'Invalid texture', description: String(err), tone: 'error' }); }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <SectionHeading title="Appearance studio" subtitle="Create offline skins, capes and cosmetic looks. Local-only until a supported engine/mod bridge can render them in-game." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="flex flex-col items-center gap-4 p-5">
          <SkinPreview profile={draft} />
          <Badge tone="warn">Local preview only</Badge>
          <p className="text-center text-[11.5px] leading-relaxed text-white/40">Vanilla Minecraft will not show these cosmetics to other players. A future Amethyst/mod bridge is required for in-game rendering.</p>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Profile name"><TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Account">
              <Select value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
                <option value="">Local / offline</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.username}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Skin PNG" hint="64×32 or 64×64 PNG, max 1 MiB.">
              <label className="btn btn-ghost cursor-pointer"><Upload className="h-4 w-4" /> Upload skin<input type="file" accept="image/png" className="hidden" onChange={(e) => void upload('skin', e.target.files?.[0])} /></label>
            </Field>
            <Field label="Skin model">
              <Select value={draft.skinVariant} onChange={(e) => setDraft({ ...draft, skinVariant: e.target.value })}><option value="classic">Classic (4px arms)</option><option value="slim">Slim (3px arms)</option></Select>
            </Field>
          </div>
          <Toggle checked={draft.capeEnabled} onChange={(value) => setDraft({ ...draft, capeEnabled: value })} label="Cape" description="Local cape preview; not an official Minecraft cape." />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cape color"><input type="color" value={draft.capeColor} onChange={(e) => setDraft({ ...draft, capeColor: e.target.value })} className="h-10 w-full cursor-pointer rounded-xl border border-white/10 bg-black/25" /></Field>
            <Field label="Pattern"><Select value={draft.capePattern} onChange={(e) => setDraft({ ...draft, capePattern: e.target.value })}><option value="solid">Solid</option><option value="stripe">Stripe</option><option value="gradient">Gradient</option></Select></Field>
            <Field label="Cape PNG"><label className="btn btn-ghost cursor-pointer"><Upload className="h-4 w-4" /> Upload<input type="file" accept="image/png" className="hidden" onChange={(e) => void upload('cape', e.target.files?.[0])} /></label></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Wings"><Select value={draft.wings} onChange={(e) => setDraft({ ...draft, wings: e.target.value })}><option value="none">None</option><option value="angel">Angel</option><option value="ender">Ender</option></Select></Field>
            <Field label="Aura color"><input type="color" value={draft.auraColor} onChange={(e) => setDraft({ ...draft, auraColor: e.target.value })} className="h-10 w-full cursor-pointer rounded-xl border border-white/10 bg-black/25" /></Field>
          </div>
          <Toggle checked={draft.auraEnabled} onChange={(value) => setDraft({ ...draft, auraEnabled: value })} label="Aura" description="Cosmetic particle-style glow in the local preview." />
          <div className="flex gap-2">
            <Button variant="primary" loading={saving} onClick={() => void save()} icon={<Save className="h-4 w-4" />}>Save look</Button>
            <Button variant="ghost" onClick={() => setDraft({ ...EMPTY, accountId: accounts[0]?.id ?? '' })} icon={<Sparkles className="h-4 w-4" />}>New</Button>
          </div>
        </Card>
      </div>
      {profiles.length ? (
        <section>
          <SectionHeading title="Saved looks" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card key={profile.id} className={cn('flex items-center gap-3 p-4', draft.id === profile.id && 'border-violet-400/40')}>
                <Palette className="h-5 w-5 text-violet-300" />
                <button className="min-w-0 flex-1 text-left" onClick={() => setDraft(profile)}><div className="truncate text-[13.5px] font-semibold text-white">{profile.name}</div><div className="text-[11px] text-white/40">{profile.capeEnabled ? 'Cape' : 'No cape'} · {profile.wings === 'none' ? 'no wings' : profile.wings}</div></button>
                <Button size="sm" variant="danger" onClick={() => void remove(profile.id)} icon={<Trash2 className="h-3.5 w-3.5" />}><span className="sr-only">Delete</span></Button>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
