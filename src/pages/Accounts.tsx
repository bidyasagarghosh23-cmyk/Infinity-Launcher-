import { useState } from 'react';
import { Check, Plus, ShieldCheck, Trash2, UserRound, WifiOff } from 'lucide-react';
import { useLauncher } from '../store/launcher';
import { Avatar } from '../components/brand/Avatar';
import { Badge, Card, SectionHeading } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AddAccountModal } from '../components/features/AddAccountModal';
import { cn, formatRelative } from '../lib/util';

export function Accounts() {
  const accounts = useLauncher((state) => state.accounts);
  const setActiveAccount = useLauncher((state) => state.setActiveAccount);
  const removeAccount = useLauncher((state) => state.removeAccount);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading
          className="mb-0"
          title="Accounts"
          subtitle="The first account in this list is used when you hit Play"
        />
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
          Add account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/30">
            <UserRound className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white">No accounts yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-white/40">
              Sign in with Microsoft for online play, or create an offline profile to jump straight
              into singleplayer.
            </p>
          </div>
          <Button variant="primary" onClick={() => setModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Add your first account
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {accounts.map((account, index) => {
            const active = index === 0;
            return (
              <Card
                key={account.id}
                className={cn(
                  'flex flex-col gap-4 p-4 transition sm:flex-row sm:items-center',
                  active && 'border-violet-400/30 bg-gradient-to-r from-violet-500/[0.10] to-transparent',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar username={account.username} src={account.avatarUrl} size={44} ring={active} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-white">
                        {account.username}
                      </span>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-200">
                          <Check className="h-2.5 w-2.5" /> active
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={account.kind === 'microsoft' ? 'success' : 'neutral'}>
                        {account.kind === 'microsoft' ? (
                          <ShieldCheck className="h-2.5 w-2.5" />
                        ) : (
                          <WifiOff className="h-2.5 w-2.5" />
                        )}
                        {account.kind === 'microsoft' ? 'Microsoft' : 'Offline'}
                      </Badge>
                      <span className="font-mono text-[10px] text-white/25">
                        {account.uuid.toLowerCase()}
                      </span>
                      <span className="text-[10.5px] text-white/25">
                        added {formatRelative(account.addedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:flex-none">
                  {!active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Check className="h-3.5 w-3.5" />}
                      onClick={() => setActiveAccount(account.id)}
                    >
                      Use this account
                    </Button>
                  ) : (
                    <span className="hidden text-[11px] text-white/30 sm:inline">
                      Used for launches
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => removeAccount(account.id)}
                    aria-label={`Remove ${account.username}`}
                    className="text-white/30 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="flex-1 text-[11.5px] leading-relaxed text-white/40">
          <span className="font-semibold text-white/70">How sessions are stored.</span> Microsoft
          refresh tokens stay on this device inside the launcher data folder and are only exchanged
          over HTTPS with Microsoft, Xbox Live and Mojang. Signing out removes the token from disk.
        </div>
      </Card>

      <AddAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
