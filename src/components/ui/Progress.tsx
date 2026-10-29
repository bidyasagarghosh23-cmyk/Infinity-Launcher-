import { cn } from '../../lib/util';

export function Progress({
  value,
  max = 100,
  className,
  indeterminate,
}: {
  value: number;
  max?: number;
  className?: string;
  indeterminate?: boolean;
}) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full bg-brand transition-[width] duration-500 ease-out',
          indeterminate && 'animate-shimmer',
        )}
        style={{
          width: indeterminate ? '100%' : `${percent}%`,
          backgroundSize: indeterminate ? '200% 100%' : undefined,
        }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
    </div>
  );
}
