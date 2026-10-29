import type { ReactNode } from 'react';
import { Background } from './Background';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { Toasts } from '../ui/Toasts';
import { useLauncher } from '../../store/launcher';
import { Spinner } from '../ui/Spinner';
import { javaLaunchLimitation } from '../../lib/util';

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useLauncher((state) => state.ready);
  const system = useLauncher((state) => state.system);
  const limitation = javaLaunchLimitation(system);

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <Background />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {limitation ? (
          <aside role="status" className="safe-x border-b border-amber-300/15 bg-amber-400/10 px-4 py-2 text-[11px] leading-relaxed text-amber-100/85 sm:px-6">
            {limitation}
          </aside>
        ) : null}
        <main className="scroll-area relative min-h-0 flex-1 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          {ready ? (
            children
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-white/40">
              <Spinner className="h-6 w-6" />
              <span className="text-[13px]">Starting Infinity Launcher…</span>
            </div>
          )}
        </main>
        <MobileNav />
      </div>
      <Toasts />
    </div>
  );
}
