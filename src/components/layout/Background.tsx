/** Ambient background: brand aurora, fine grid and film grain. */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-900 grain">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(99,102,241,0.22),transparent_60%)]" />
      <div
        className="absolute -left-40 top-[-10%] h-[42rem] w-[42rem] animate-drift rounded-full opacity-45 blur-[110px]"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.55), transparent 68%)' }}
      />
      <div
        className="absolute -right-32 top-[8%] h-[34rem] w-[34rem] animate-float rounded-full opacity-40 blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.42), transparent 70%)' }}
      />
      <div
        className="absolute bottom-[-18%] left-1/3 h-[30rem] w-[36rem] animate-drift rounded-full opacity-30 blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.34), transparent 72%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, black, transparent 75%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-ink-900 to-transparent" />
    </div>
  );
}
