import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useLauncher } from '../../store/launcher';
import { cn } from '../../lib/util';

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const tones = {
  success: 'border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-300',
  error: 'border-rose-500/25 bg-rose-500/[0.08] text-rose-300',
  info: 'border-violet-500/25 bg-violet-500/[0.08] text-violet-300',
};

export function Toasts() {
  const toasts = useLauncher((state) => state.toasts);
  const dismiss = useLauncher((state) => state.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:inset-auto sm:bottom-6 sm:right-6 sm:items-end sm:p-0 sm:pb-0">
      {toasts.map((toast) => {
        const Icon = icons[toast.tone];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-2xl border px-4 py-3 shadow-card backdrop-blur-xl',
              tones[toast.tone],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-none" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white">{toast.title}</div>
              {toast.description ? (
                <div className="mt-0.5 break-words text-[12px] leading-relaxed text-white/55">
                  {toast.description}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
