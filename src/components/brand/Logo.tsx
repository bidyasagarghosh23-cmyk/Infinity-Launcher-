import { cn } from '../../lib/util';

/**
 * The Infinity mark: a blocky lemniscate drawn from isometric cubes, echoing
 * both the brand and Minecraft's voxel world.
 */
export function InfinityMark({ className, animated }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-9 w-9', className)} aria-hidden="true">
      <defs>
        <linearGradient id="infinity-mark" x1="4" y1="40" x2="44" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="45%" stopColor="#818CF8" />
          <stop offset="78%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
        <filter id="infinity-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#infinity-glow)" fill="none" stroke="url(#infinity-mark)" strokeWidth="4.6">
        <path
          d="M15.6 15.2c-3.6 0-6.6 3.4-6.6 8.8s3 8.8 6.6 8.8c6.2 0 9.2-17.6 16.8-17.6 3.6 0 6.6 3.4 6.6 8.8s-3 8.8-6.6 8.8c-7.6 0-10.6-17.6-16.8-17.6Z"
          strokeLinecap="round"
          className={animated ? 'origin-center [stroke-dasharray:200] [stroke-dashoffset:0]' : undefined}
        />
      </g>
      <g fill="#FFFFFF" opacity="0.9">
        <rect x="21" y="21" width="2" height="2" rx="0.4" opacity="0.7" />
        <rect x="25" y="25" width="2" height="2" rx="0.4" opacity="0.5" />
        <rect x="19" y="18" width="1.5" height="1.5" rx="0.3" opacity="0.35" />
      </g>
    </svg>
  );
}

export function Wordmark({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col leading-none', className)}>
      <span className="text-[17px] font-semibold tracking-tight text-white">
        Infinity<span className="text-brand"> Launcher</span>
      </span>
      {!compact ? (
        <span className="mt-1 font-pixel text-[8px] uppercase tracking-[0.22em] text-white/30">
          java edition · cross-platform
        </span>
      ) : null}
    </div>
  );
}

export function LogoLockup({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-inset">
        <div className="absolute inset-0 rounded-2xl bg-brand opacity-[0.14] blur-md" aria-hidden />
        <InfinityMark className="relative h-6 w-6" />
      </div>
      {!collapsed ? <Wordmark /> : null}
    </div>
  );
}
