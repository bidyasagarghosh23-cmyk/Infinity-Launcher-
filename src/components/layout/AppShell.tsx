import type { ReactNode } from 'react';
import { Background } from './Background';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { Toasts } from '../ui/Toasts';
import { useLauncher } from '../../store/launcher';
import { Spinner } from '../ui/Spinner';

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useLauncher((state) => state.ready);

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <Background />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
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
