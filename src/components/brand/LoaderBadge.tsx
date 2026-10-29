import { LOADER_ACCENT, LOADER_LABEL, cn } from '../../lib/util';
import type { Loader } from '../../lib/types';

export function LoaderBadge({
  loader,
  version,
  className,
  size = 'md',
}: {
  loader: Loader | string;
  version?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const accent = LOADER_ACCENT[loader] ?? LOADER_ACCENT.vanilla!;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 pr-2.5 backdrop-blur',
        size === 'sm' ? 'py-0.5 pl-1.5 text-[10px]' : 'py-1 pl-1.5 text-[11px]',
        className,
      )}
    >
      <span
        className={cn('h-4 w-4 rounded-full bg-gradient-to-br', accent)}
        aria-hidden
      />
      <span className="font-semibold text-white/80">{LOADER_LABEL[loader] ?? loader}</span>
      {version ? <span className="text-white/35">{version}</span> : null}
    </span>
  );
}
