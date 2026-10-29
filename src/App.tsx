import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Home } from './pages/Home';
import { Instances } from './pages/Instances';
import { Console } from './pages/Console';
import { Accounts } from './pages/Accounts';
import { Settings } from './pages/Settings';
import { Discover } from './pages/Discover';
import { Content } from './pages/Content';
import { Appearance } from './pages/Appearance';
import { Engine } from './pages/Engine';
import { Tools } from './pages/Tools';
import { CommandPalette } from './components/features/CommandPalette';
import { useState } from 'react';
import { useLauncher } from './store/launcher';
import { isNative } from './lib/bridge';

export default function App() {
  const ready = useLauncher((state) => state.ready);
  const route = useLauncher((state) => state.route);
  const init = useLauncher((state) => state.init);
  const theme = useLauncher((state) => state.settings?.theme ?? 'lunar');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-native', isNative);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <AppShell>
      {ready ? (
        <div key={route} className="h-full animate-fade-up">
          {route === 'home' ? <Home /> : null}
          {route === 'instances' ? <Instances /> : null}
          {route === 'discover' ? <Discover /> : null}
          {route === 'content' ? <Content /> : null}
          {route === 'appearance' ? <Appearance /> : null}
          {route === 'engine' ? <Engine /> : null}
          {route === 'tools' ? <Tools /> : null}
          {route === 'console' ? <Console /> : null}
          {route === 'accounts' ? <Accounts /> : null}
          {route === 'settings' ? <Settings /> : null}
        </div>
      ) : null}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </AppShell>
  );
}
