import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Copy, Play, Square, Terminal, Trash2 } from 'lucide-react';
import { useLauncher, selectSelectedInstance } from '../store/launcher';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Progress } from '../components/ui/Progress';
import { cn, copyToClipboard } from '../lib/util';

type Level = 'all' | 'info' | 'warn' | 'error';

function levelOf(line: string): Exclude<Level, 'all'> {
  if (/\b(ERROR|SEVERE|FATAL|Exception|error:)\b/.test(line)) return 'error';
  if (/\b(WARN|WARNING)\b/.test(line)) return 'warn';
  return 'info';
}

const LEVEL_COLOR: Record<Exclude<Level, 'all'>, string> = {
  error: 'text-rose-300/90',
  warn: 'text-amber-200/80',
  info: 'text-white/55',
};

export function Console() {
  const lines = useLauncher((state) => state.consoleLines);
  const progress = useLauncher((state) => state.progress);
  const instances = useLauncher((state) => state.instances);
  const running = useLauncher((state) => state.running);
  const selected = useLauncher(selectSelectedInstance);
  const play = useLauncher((state) => state.play);
  const stop = useLauncher((state) => state.stop);
  const clearConsole = useLauncher((state) => state.clearConsole);
  const [level, setLevel] = useState<Level>('all');
  const [autoscroll, setAutoscroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (level === 'all' ? lines : lines.filter((line) => levelOf(line) === level)),
    [lines, level],
  );

  useEffect(() => {
    if (autoscroll) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [filtered.length, autoscroll]);

  const activeInstalls = Object.entries(progress).filter(
    ([, value]) => value.stage !== 'done' && value.stage !== 'error',
  );
  const runningGames = instances.filter((instance) => running[instance.id]?.running);
  const isRunning = selected ? Boolean(running[selected.id]?.running) : false;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-4">
      {activeInstalls.length > 0 ? (
        <div className="flex flex-col gap-2">
          {activeInstalls.map(([instanceId, value]) => {
            const instance = instances.find((entry) => entry.id === instanceId);
            const percent =
              value.total > 0 ? Math.min(100, Math.round((value.current / value.total) * 100)) : 0;
            return (
              <Card key={instanceId} className="p-3.5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                    <span className="truncate text-[12.5px] font-semibold text-white">
                      {instance?.name ?? instanceId}
                    </span>
                    <span className="truncate text-[11.5px] capitalize text-white/35">
                      {value.message || value.stage}
                    </span>
                  </div>
                  <span className="font-pixel text-[10px] text-white/45">{percent}%</span>
                </div>
                <Progress value={value.current} max={value.total || 1} className="h-1.5" />
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] bg-black/20 px-3 py-2.5">
          <span className="mr-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/35">
            <Terminal className="h-3.5 w-3.5" />
            Output
          </span>

          <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-black/25 p-0.5">
            {(['all', 'info', 'warn', 'error'] as Level[]).map((entry) => (
              <button
                key={entry}
                onClick={() => setLevel(entry)}
                className={cn(
                  'rounded-lg px-2 py-1 text-[10.5px] font-medium uppercase tracking-wide transition',
                  level === entry
                    ? 'bg-white/10 text-white'
                    : 'text-white/35 hover:text-white/70',
                )}
              >
                {entry}
              </button>
            ))}
          </div>

          <span className="hidden font-pixel text-[9px] uppercase tracking-wider text-white/25 sm:inline">
            {lines.length} lines
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setAutoscroll((value) => !value)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] font-medium transition',
                autoscroll
                  ? 'border-violet-400/30 bg-violet-500/15 text-violet-200'
                  : 'border-white/10 text-white/40 hover:text-white/70',
              )}
            >
              <ArrowDownToLine className="h-3 w-3" />
              Follow
            </button>
            <button
              onClick={async () => {
                await copyToClipboard(lines.join('\n'));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:text-white"
              aria-label="Copy log"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              onClick={() => selected && clearConsole(selected.id)}
              className="rounded-lg border border-white/10 p-1.5 text-white/40 transition hover:text-rose-300"
              aria-label="Clear log"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="scroll-area min-h-0 flex-1 bg-[#05050A]/80 p-3 font-mono text-[11.5px] leading-[1.7]">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/25">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[12.5px] font-medium text-white/45">Nothing here yet</div>
                <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-relaxed text-white/25">
                  Launch the game or install an instance and the full log appears here in real time.
                </p>
              </div>
              {selected ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Play className="h-3 w-3 fill-current" />}
                  onClick={() => play(selected.id)}
                  disabled={!selected.installed || isRunning}
                >
                  Launch {selected.name}
                </Button>
              ) : null}
            </div>
          ) : (
            filtered.map((line, index) => (
              <div
                key={`${index}-${line.slice(0, 12)}`}
                className={cn(
                  'whitespace-pre-wrap break-words border-l-2 border-transparent pl-2 hover:border-white/10 hover:bg-white/[0.03]',
                  LEVEL_COLOR[levelOf(line)],
                  line.startsWith('[Infinity]') && 'text-violet-300/80',
                )}
              >
                {line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-black/20 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-white/35">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isRunning || runningGames.length > 0 ? 'animate-pulse bg-emerald-400' : 'bg-white/20',
              )}
            />
            <span className="truncate">
              {runningGames.length > 0
                ? `${runningGames.length} game${runningGames.length > 1 ? 's' : ''} running`
                : 'Idle'}
            </span>
            {copied ? <span className="text-emerald-300">copied</span> : null}
          </div>
          {selected ? (
            isRunning ? (
              <Button
                size="sm"
                variant="danger"
                icon={<Square className="h-3 w-3 fill-current" />}
                onClick={() => stop(selected.id)}
              >
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<Play className="h-3 w-3 fill-current" />}
                onClick={() => play(selected.id)}
                disabled={!selected.installed}
              >
                Launch {selected.name.split(' ')[0]}
              </Button>
            )
          ) : null}
        </div>
      </Card>
    </div>
  );
}
