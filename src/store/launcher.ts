import { create } from 'zustand';
import { api } from '../lib/api';
import { subscribe } from '../lib/bridge';
import { javaLaunchLimitation } from '../lib/util';
import type {
  Account,
  CreateInstanceArgs,
  GameStatus,
  Instance,
  Progress,
  Settings,
  SystemInfo,
  VersionManifest,
} from '../lib/types';

export type Route = 'home' | 'instances' | 'discover' | 'content' | 'appearance' | 'engine' | 'console' | 'accounts' | 'settings';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
}

interface LauncherState {
  ready: boolean;
  bootError: string | null;
  route: Route;
  settings: Settings | null;
  instances: Instance[];
  accounts: Account[];
  system: SystemInfo | null;
  manifest: VersionManifest | null;
  running: Record<string, GameStatus>;
  progress: Record<string, Progress>;
  consoleLines: string[];
  toasts: Toast[];
  search: string;

  init: () => Promise<void>;
  setRoute: (route: Route) => void;
  setSearch: (value: string) => void;
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;

  refreshInstances: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  applySettings: (settings: Settings) => Promise<void>;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
  selectInstance: (instanceId: string) => Promise<void>;

  play: (instanceId: string) => Promise<void>;
  stop: (instanceId: string) => Promise<void>;
  install: (instanceId: string, fresh?: boolean) => Promise<void>;
  createInstance: (args: CreateInstanceArgs) => Promise<Instance | null>;
  removeInstance: (instanceId: string) => Promise<void>;
  saveInstance: (instance: Instance) => Promise<void>;

  addOfflineAccount: (username: string) => Promise<boolean>;
  removeAccount: (accountId: string) => Promise<void>;
  setActiveAccount: (accountId: string) => Promise<void>;

  clearConsole: (instanceId: string) => Promise<void>;
}

const MAX_CONSOLE = 3000;
let booted = false;
let toastSeq = 0;

export const useLauncher = create<LauncherState>((set, get) => ({
  ready: false,
  bootError: null,
  route: 'home',
  settings: null,
  instances: [],
  accounts: [],
  system: null,
  manifest: null,
  running: {},
  progress: {},
  consoleLines: [],
  toasts: [],
  search: '',

  async init() {
    if (booted) return;
    booted = true;
    try {
      const [system, settings, instances, accounts] = await Promise.all([
        api.systemInfo(),
        api.getSettings(),
        api.listInstances(),
        api.listAccounts(),
      ]);
      const running: Record<string, GameStatus> = {};
      for (const status of system.gameProcesses ?? []) {
        if (status.running) running[status.instanceId] = status;
      }
      set({ system, settings, instances, accounts, running, ready: true });

      // Fire and forget: the UI works before the manifest arrives.
      api
        .fetchVersionManifest()
        .then((manifest) => set({ manifest }))
        .catch(() => undefined);

      await subscribe<Progress>('install://progress', (progress) => {
        const instanceId = progress.taskId.replace(/^install:/, '');
        set((state) => ({
          progress: { ...state.progress, [instanceId]: progress },
        }));
        if (progress.stage === 'done') {
          void get().refreshInstances();
          setTimeout(() => {
            set((state) => {
              const next = { ...state.progress };
              delete next[instanceId];
              return { progress: next };
            });
          }, 2500);
          get().toast({ title: 'Installed', description: progress.message, tone: 'success' });
        }
        if (progress.stage === 'error') {
          get().toast({ title: 'Install failed', description: progress.message, tone: 'error' });
        }
      });

      await subscribe<string>('game://log', (line) => {
        set((state) => {
          const next = [...state.consoleLines, line];
          if (next.length > MAX_CONSOLE) next.splice(0, next.length - MAX_CONSOLE);
          return { consoleLines: next };
        });
      });

      await subscribe<GameStatus>('game://state', (status) => {
        set((state) => ({
          running: { ...state.running, [status.instanceId]: status },
        }));
        if (!status.running) {
          void get().refreshInstances();
        }
      });
    } catch (error) {
      set({ bootError: String(error), ready: true });
    }
  },

  setRoute: (route) => set({ route }),
  setSearch: (search) => set({ search }),

  toast: (toast) => {
    const id = ++toastSeq;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => get().dismissToast(id), toast.tone === 'error' ? 7000 : 4200);
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  async refreshInstances() {
    const instances = await api.listInstances();
    set({ instances });
  },

  async refreshAccounts() {
    const accounts = await api.listAccounts();
    set({ accounts });
  },

  async applySettings(settings) {
    const saved = await api.saveSettings(settings);
    set({ settings: saved });
    get().toast({ title: 'Settings saved', tone: 'success' });
  },

  async patchSettings(patch) {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ settings: next });
    try {
      await api.saveSettings(next);
    } catch (error) {
      get().toast({ title: 'Could not save settings', description: String(error), tone: 'error' });
    }
  },

  async selectInstance(instanceId) {
    const current = get().settings;
    if (!current) return;
    set({ settings: { ...current, selectedInstance: instanceId } });
    try {
      await api.saveSettings({ ...current, selectedInstance: instanceId });
    } catch {
      /* selecting is best-effort — never block the UI on it */
    }
  },

  async play(instanceId) {
    const limitation = javaLaunchLimitation(get().system);
    if (limitation) {
      get().toast({ title: 'Android engine not ready', description: limitation, tone: 'info' });
      return;
    }
    try {
      const status = await api.launchInstance(instanceId);
      set((state) => ({ running: { ...state.running, [instanceId]: status } }));
      get().toast({ title: 'Launching Minecraft', tone: 'info' });
    } catch (error) {
      get().toast({
        title: 'Could not launch',
        description: String(error),
        tone: 'error',
      });
    }
  },

  async stop(instanceId) {
    try {
      await api.killInstance(instanceId);
      set((state) => ({
        running: {
          ...state.running,
          [instanceId]: { instanceId, running: false },
        },
      }));
      get().toast({ title: 'Game closed', tone: 'info' });
    } catch (error) {
      get().toast({ title: 'Could not stop the game', description: String(error), tone: 'error' });
    }
  },

  async install(instanceId, fresh = false) {
    set((state) => ({
      progress: {
        ...state.progress,
        [instanceId]: {
          taskId: `install:${instanceId}`,
          stage: 'metadata',
          current: 0,
          total: 1,
          message: 'Starting…',
        },
      },
    }));
    try {
      await api.installInstance({ instanceId, fresh });
      set({ route: 'console' });
    } catch (error) {
      set((state) => {
        const next = { ...state.progress };
        delete next[instanceId];
        return { progress: next };
      });
      get().toast({ title: 'Install failed', description: String(error), tone: 'error' });
    }
  },

  async createInstance(args) {
    try {
      const instance = await api.createInstance(args);
      set((state) => ({ instances: [instance, ...state.instances] }));
      const current = get().settings;
      if (current && !current.selectedInstance) {
        await get().patchSettings({ selectedInstance: instance.id });
      }
      get().toast({ title: `Created ${instance.name}`, tone: 'success' });
      return instance;
    } catch (error) {
      get().toast({ title: 'Could not create instance', description: String(error), tone: 'error' });
      return null;
    }
  },

  async removeInstance(instanceId) {
    try {
      await api.deleteInstance(instanceId, true);
      set((state) => ({
        instances: state.instances.filter((instance) => instance.id !== instanceId),
      }));
      get().toast({ title: 'Instance deleted', tone: 'info' });
    } catch (error) {
      get().toast({ title: 'Could not delete instance', description: String(error), tone: 'error' });
    }
  },

  async saveInstance(instance) {
    try {
      const saved = await api.updateInstance(instance);
      set((state) => ({
        instances: state.instances.map((entry) => (entry.id === saved.id ? saved : entry)),
      }));
    } catch (error) {
      get().toast({ title: 'Could not save instance', description: String(error), tone: 'error' });
    }
  },

  async addOfflineAccount(username) {
    try {
      const account = await api.addOfflineAccount(username);
      set((state) => ({ accounts: [account, ...state.accounts] }));
      get().toast({ title: `Signed in as ${account.username}`, tone: 'success' });
      return true;
    } catch (error) {
      get().toast({ title: 'Could not add account', description: String(error), tone: 'error' });
      return false;
    }
  },

  async removeAccount(accountId) {
    try {
      await api.removeAccount(accountId);
      set((state) => ({ accounts: state.accounts.filter((a) => a.id !== accountId) }));
    } catch (error) {
      get().toast({ title: 'Could not remove account', description: String(error), tone: 'error' });
    }
  },

  async setActiveAccount(accountId) {
    try {
      await api.setActiveAccount(accountId);
      await get().refreshAccounts();
      get().toast({ title: 'Active account switched', tone: 'success' });
    } catch (error) {
      get().toast({ title: 'Could not switch account', description: String(error), tone: 'error' });
    }
  },

  async clearConsole(instanceId) {
    try {
      await api.clearLog(instanceId);
      set({ consoleLines: [] });
    } catch {
      set({ consoleLines: [] });
    }
  },
}));

export const selectSelectedInstance = (state: LauncherState): Instance | undefined => {
  const id = state.settings?.selectedInstance;
  return state.instances.find((instance) => instance.id === id) ?? state.instances[0];
};
