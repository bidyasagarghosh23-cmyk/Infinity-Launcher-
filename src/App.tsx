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
import { useLauncher } from './store/launcher';
import { isNative } from './lib/bridge';

export default function App() {
  const ready = useLauncher((state) => state.ready);
  const route = useLauncher((state) => state.route);
  const init = useLauncher((state) => state.init);
  const theme = useLauncher((state) => state.settings?.theme ?? 'lunar');

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-native', isNative);
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
          {route === 'console' ? <Console /> : null}
          {route === 'accounts' ? <Accounts /> : null}
          {route === 'settings' ? <Settings /> : null}
        </div>
      ) : null}
    </AppShell>
  );
}
