import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/util';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.03] shadow-card backdrop-blur-xl',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-white/40">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info';
}) {
  const tones: Record<string, string> = {
    neutral: 'border-white/10 bg-white/[0.05] text-white/60',
    brand: 'border-violet-500/30 bg-violet-500/15 text-violet-200',
    success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    warn: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    danger: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    info: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
