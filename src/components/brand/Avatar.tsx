import { useState } from 'react';
import { cn } from '../../lib/util';

export function Avatar({
  username,
  src,
  size = 40,
  className,
  ring,
}: {
  username: string;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials = username.slice(0, 2).toUpperCase();
  const hue = [...username].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <div
      className={cn(
        'relative flex flex-none items-center justify-center overflow-hidden rounded-xl',
        ring && 'ring-2 ring-violet-500/50 ring-offset-2 ring-offset-ink-900',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={username}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover [image-rendering:pixelated]"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-[0.7em] font-bold text-white/80"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 48) % 360} 70% 30%))`,
            fontSize: size * 0.34,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
