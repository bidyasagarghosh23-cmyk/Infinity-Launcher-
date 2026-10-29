import { cn } from '../../lib/util';

/**
 * Isometric Minecraft-ish block, drawn entirely with CSS-friendly SVG so it
 * stays crisp at every size and costs no image bytes.
 */
type Palette = {
  top: string;
  left: string;
  right: string;
  speck?: string;
  label: string;
};

export const BLOCKS: Record<string, Palette> = {
  grass: { top: '#5FBF4A', left: '#8B5A2B', right: '#6B4421', speck: '#7ED957', label: 'Grass' },
  dirt: { top: '#8B5A2B', left: '#7A4E26', right: '#5E3A1B', speck: '#A06A38', label: 'Dirt' },
  stone: { top: '#9AA0A6', left: '#7C8288', right: '#5F656B', speck: '#B4BABF', label: 'Stone' },
  diamond: { top: '#5EEAD4', left: '#2DD4BF', right: '#14B8A6', speck: '#CCFBF1', label: 'Diamond' },
  gold: { top: '#FDE047', left: '#FACC15', right: '#CA8A04', speck: '#FEF9C3', label: 'Gold' },
  redstone: { top: '#F87171', left: '#DC2626', right: '#991B1B', speck: '#FCA5A5', label: 'Redstone' },
  emerald: { top: '#4ADE80', left: '#22C55E', right: '#15803D', speck: '#BBF7D0', label: 'Emerald' },
  nether: { top: '#B91C1C', left: '#7F1D1D', right: '#571313', speck: '#EF4444', label: 'Nether' },
  end: { top: '#FDE68A', left: '#D6D3A5', right: '#A8A47F', speck: '#FEF3C7', label: 'End' },
  obsidian: { top: '#4C1D95', left: '#3B1578', right: '#26104F', speck: '#7C3AED', label: 'Obsidian' },
  lapis: { top: '#3B82F6', left: '#2563EB', right: '#1D4ED8', speck: '#93C5FD', label: 'Lapis' },
  copper: { top: '#FB923C', left: '#EA580C', right: '#9A3412', speck: '#FDBA74', label: 'Copper' },
};

export function BlockIcon({
  name = 'grass',
  className,
  size = 44,
}: {
  name?: string;
  className?: string;
  size?: number;
}) {
  const palette = BLOCKS[name] ?? BLOCKS.grass!;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]', className)}
      aria-label={palette.label}
      role="img"
    >
      <polygon points="32,4 60,19 32,34 4,19" fill={palette.top} />
      <polygon points="4,19 32,34 32,60 4,45" fill={palette.left} />
      <polygon points="60,19 32,34 32,60 60,45" fill={palette.right} />
      {palette.speck ? (
        <g fill={palette.speck} opacity="0.55">
          <rect x="24" y="14" width="3" height="3" rx="0.5" />
          <rect x="36" y="18" width="3" height="3" rx="0.5" />
          <rect x="30" y="24" width="2.5" height="2.5" rx="0.5" />
          <rect x="18" y="20" width="2.5" height="2.5" rx="0.5" opacity="0.7" />
          <rect x="42" y="14" width="2.5" height="2.5" rx="0.5" opacity="0.6" />
        </g>
      ) : null}
      {palette.speck ? (
        <g fill="#000" opacity="0.12">
          <rect x="12" y="30" width="3" height="3" rx="0.5" />
          <rect x="20" y="40" width="3" height="3" rx="0.5" />
          <rect x="44" y="32" width="3" height="3" rx="0.5" />
          <rect x="38" y="44" width="3" height="3" rx="0.5" />
        </g>
      ) : null}
      <polygon
        points="32,4 60,19 32,34 4,19"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
    </svg>
  );
}

export const BLOCK_NAMES = Object.keys(BLOCKS);
