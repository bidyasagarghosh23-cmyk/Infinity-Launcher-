import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/util';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default animate-fade-in bg-black/70 backdrop-blur-md"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full animate-scale-in overflow-hidden rounded-t-3xl border border-white/10 bg-ink-850/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:rounded-3xl',
          widths[size],
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent"
          aria-hidden
        />
        <div className="flex items-start justify-between gap-6 px-6 pb-2 pt-6">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-white/45">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] bg-black/20 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
