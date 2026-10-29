/**
 * Browser demo backend.
 *
 * The Tauri build talks to Rust (`src-tauri/`). When the same UI is opened in
 * a plain browser — `npm run dev` without the native shell — there is no IPC,
 * so this module stands in for it: realistic fixture data, persisted to
 * localStorage, with install/launch simulated on timers. Every command and
 * event below has a 1:1 Rust counterpart, so the UI code never branches.
 */

import type {
  Account,
  CreateInstanceArgs,
  DeviceCode,
  GameStatus,
  InstallArgs,
  Instance,
  JavaRuntime,
  Loader,
  Progress,
  Settings,
  SystemInfo,
  AppearanceProfile,
  CatalogFile,
  CatalogPage,
  CatalogProject,
  CatalogQuery,
  ContentItem,
  ContentKind,
  InstallContentArgs,
  PerformancePreset,
  WorldItem,
} from './types';

const release = (id: string, releaseTime: string) => ({
  id,
  type: 'release',
  releaseTime,
});

const VERSIONS: Array<{
  id: string;
  type: string;
  releaseTime: string;
}> = [
  release('1.21.8', '2025-07-17T09:41:00+00:00'),
  release('1.21.7', '2025-06-30T10:00:00+00:00'),
  release('1.21.6', '2025-06-17T11:34:00+00:00'),
  release('1.21.5', '2025-03-25T12:00:00+00:00'),
  release('1.21.4', '2024-12-03T10:12:00+00:00'),
  release('1.21.3', '2024-10-23T10:00:00+00:00'),
  release('1.21.1', '2024-08-08T14:00:00+00:00'),
  release('1.21', '2024-06-13T10:24:00+00:00'),
  release('1.20.6', '2024-04-29T10:00:00+00:00'),
  release('1.20.4', '2023-12-07T10:00:00+00:00'),
  release('1.20.1', '2023-06-12T12:00:00+00:00'),
  release('1.19.4', '2023-03-14T12:00:00+00:00'),
  release('1.19.2', '2022-08-05T11:00:00+00:00'),
  release('1.18.2', '2022-02-28T10:00:00+00:00'),
  release('1.17.1', '2021-07-06T12:00:00+00:00'),
  release('1.16.5', '2021-01-14T15:00:00+00:00'),
  release('1.15.2', '2020-01-17T10:00:00+00:00'),
  release('1.14.4', '2019-07-19T10:00:00+00:00'),
  release('1.12.2', '2017-09-18T10:00:00+00:00'),
  release('1.8.9', '2015-12-09T10:00:00+00:00'),
  release('1.7.10', '2014-05-14T10:00:00+00:00'),
  { id: '25w45a', type: 'snapshot', releaseTime: '2025-11-06T10:00:00+00:00' },
  { id: '25w44a', type: 'snapshot', releaseTime: '2025-10-30T10:00:00+00:00' },
  { id: '25w43a', type: 'snapshot', releaseTime: '2025-10-23T10:00:00+00:00' },
  { id: '24w14potato', type: 'snapshot', releaseTime: '2024-04-01T10:00:00+00:00' },
];

const LOADER_VERSIONS: Record<Loader, Record<string, string[]>> = {
  vanilla: {},
  fabric: {
    '1.21.8': ['0.16.14', '0.16.10', '0.16.5', '0.15.11', '0.14.24'],
    '1.21.1': ['0.16.14', '0.16.9', '0.16.5', '0.15.11', '0.14.24'],
    '1.20.1': ['0.16.14', '0.15.11', '0.14.24', '0.14.21'],
    '1.20.4': ['0.16.14', '0.15.11', '0.14.24'],
    '1.19.2': ['0.16.14', '0.15.11', '0.14.21'],
    '1.16.5': ['0.16.14', '0.15.11', '0.14.21'],
    '1.8.9': ['0.16.14', '0.15.11', '0.14.21'],
    '1.12.2': ['0.16.14', '0.15.11', '0.14.21'],
  },
  quilt: {
    '1.21.8': ['0.27.0', '0.26.5', '0.26.0'],
    '1.21.1': ['0.27.0', '0.26.5', '0.26.0'],
    '1.20.1': ['0.27.0', '0.26.5', '0.25.0'],
    '1.19.2': ['0.27.0', '0.26.5'],
  },
  forge: {
    '1.21.8': ['58.0.4', '58.0.1'],
    '1.21.1': ['52.0.29', '52.0.14'],
    '1.20.6': ['50.1.0'],
    '1.20.4': ['49.0.50', '49.0.30'],
    '1.20.1': ['47.3.22', '47.2.20', '47.1.3'],
    '1.19.2': ['43.4.0', '43.2.14'],
    '1.16.5': ['36.2.39', '36.2.34'],
    '1.12.2': ['14.23.5.2860'],
    '1.8.9': ['11.15.1.2318'],
    '1.7.10': ['10.13.4.1614'],
  },
  neoforge: {
    '1.21.8': ['21.8.52', '21.8.31'],
    '1.21.1': ['21.1.209', '21.1.172'],
    '1.20.6': ['20.6.194'],
    '1.20.4': ['20.4.237', '20.4.190'],
    '1.20.2': ['20.2.88'],
  },
};

const STORAGE_KEY = 'infinity-launcher.demo.v1';

interface DemoDb {
  settings: Settings;
  instances: Instance[];
  accounts: Account[];
}

const defaultSettings: Settings = {
  offlineUsername: 'Steve',
  ramMb: 4096,
  javaPath: null,
  jvmArgs: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
  gameArgs: '',
  dataDir: null,
  fullscreen: false,
  windowWidth: 1280,
  windowHeight: 720,
  closeOnLaunch: false,
  autoUpdate: true,
  downloadConcurrency: 8,
  showSnapshots: false,
  language: 'en',
  selectedInstance: 'fabric-1.21.1',
  theme: 'lunar',
  performanceProfile: 'balanced',
  androidRenderer: 'gl4es',
  touchControls: true,
  reduceEffects: false,
  favoriteInstances: [],
  showNews: true,
  compactMode: false,
};

function seedInstances(): Instance[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: 'fabric-1.21.1',
      name: 'Fabulously Optimized',
      mcVersion: '1.21.1',
      loader: 'fabric',
      loaderVersion: '0.16.9',
      versionId: 'fabric-loader-0.16.9-1.21.1',
      gameDir: '~/Infinity Launcher/instances/fabric-1.21.1',
      icon: 'grass',
      ramMb: 6144,
      javaPath: null,
      jvmArgs: null,
      createdAt: now - 86400 * 42,
      lastPlayed: now - 3600 * 5,
      playtimeSecs: 86400 * 3 + 1500,
      installed: true,
    },
    {
      id: 'vanilla-1.21.8',
      name: 'Vanilla 1.21.8',
      mcVersion: '1.21.8',
      loader: 'vanilla',
      loaderVersion: null,
      versionId: '1.21.8',
      gameDir: '~/Infinity Launcher/instances/vanilla-1.21.8',
      icon: 'diamond',
      ramMb: 4096,
      javaPath: null,
      jvmArgs: null,
      createdAt: now - 86400 * 21,
      lastPlayed: now - 86400 * 2,
      playtimeSecs: 3600 * 4,
      installed: true,
    },
    {
      id: 'forge-1.20.1',
      name: 'All the Mods 9',
      mcVersion: '1.20.1',
      loader: 'forge',
      loaderVersion: '47.3.22',
      versionId: '1.20.1-forge-47.3.22',
      gameDir: '~/Infinity Launcher/instances/forge-1.20.1',
      icon: 'redstone',
      ramMb: 8192,
      javaPath: null,
      jvmArgs: '-XX:+UseG1GC',
      createdAt: now - 86400 * 9,
      lastPlayed: now - 86400 * 6,
      playtimeSecs: 3600 * 11,
      installed: true,
    },
    {
      id: 'neoforge-1.21.1',
      name: 'NeoForge Tech Lab',
      mcVersion: '1.21.1',
      loader: 'neoforge',
      loaderVersion: '21.1.209',
      versionId: 'neoforge-21.1.209',
      gameDir: '~/Infinity Launcher/instances/neoforge-1.21.1',
      icon: 'gold',
      ramMb: 6144,
      javaPath: null,
      jvmArgs: null,
      createdAt: now - 86400 * 3,
      lastPlayed: null,
      playtimeSecs: 0,
      installed: false,
    },
  ];
}

function seedAccounts(): Account[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: '5627dd98e6be3c21b8a8e92344183641',
      username: 'Steve',
      uuid: '5627dd98-e6be-3c21-b8a8-e92344183641',
      kind: 'offline',
      avatarUrl: 'https://mc-heads.net/avatar/Steve/128',
      addedAt: now - 86400 * 30,
    },
    {
      id: '069a79f444e94726a5befca90e38aaf5',
      username: 'Notch',
      uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
      kind: 'microsoft',
      avatarUrl: 'https://mc-heads.net/avatar/069a79f444e94726a5befca90e38aaf5/128',
      addedAt: now - 86400 * 12,
    },
  ];
}

function defaultDb(): DemoDb {
  return {
    settings: { ...defaultSettings },
    instances: seedInstances(),
    accounts: seedAccounts(),
  };
}

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDb();
    const parsed = JSON.parse(raw) as Partial<DemoDb>;
    return {
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      instances: parsed.instances ?? seedInstances(),
      accounts: parsed.accounts ?? seedAccounts(),
    };
  } catch {
    return defaultDb();
  }
}

let db: DemoDb = load();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* private mode — demo state simply resets */
  }
}

export function resetDemoData() {
  db = defaultDb();
  persist();
}

// ---------------------------------------------------------------------------
// Tiny event bus mirroring Tauri's `listen`
// ---------------------------------------------------------------------------

type Handler = (payload: unknown) => void;
const listeners = new Map<string, Set<Handler>>();

export function mockListen(event: string, handler: Handler): () => void {
  const set = listeners.get(event) ?? new Set<Handler>();
  set.add(handler);
  listeners.set(event, set);
  return () => set.delete(handler);
}

function emit(event: string, payload: unknown) {
  listeners.get(event)?.forEach((handler) => {
    try {
      handler(payload);
    } catch {
      /* a bad listener must never break the launcher */
    }
  });
}

// ---------------------------------------------------------------------------
// Simulated processes
// ---------------------------------------------------------------------------

const running = new Map<string, { pid: number; startedAt: number; lines: string[] }>();
const timers = new Map<string, ReturnType<typeof setInterval>>();
const installTimers = new Map<string, ReturnType<typeof setInterval>>();

const LAUNCH_LOG = (instance: Instance, account: Account) => [
  `[Infinity] Launching ${instance.name} (${instance.mcVersion}, ${instance.loader})`,
  `[Infinity] Java runtime: 21.0.5 Temurin (x86_64)`,
  `[Infinity] Memory: ${instance.ramMb ?? 4096} MB`,
  `[main/INFO] Starting org.lwjgl.system.Library`,
  `[main/INFO] Loading Minecraft ${instance.mcVersion} with Fabric Loader`,
  `[main/INFO] Loading 214 mods:`,
  `[main/INFO]   - fabric-api 0.110.0+1.21.1`,
  `[main/INFO]   - sodium 0.6.13+mc1.21.1`,
  `[main/INFO]   - iris 1.8.8+mc1.21.1`,
  `[main/INFO]   - lithium 0.14.3+mc1.21.1`,
  `[Render thread/INFO] Backend library: LWJGL version 3.3.3+skiko`,
  `[Render thread/INFO] OpenGL debug message: OpenGL 4.6.0 NVIDIA 566.36`,
  `[Render thread/INFO] Narrator library for x64 successfully loaded`,
  `[Render thread/INFO] Reloading ResourceManager: vanilla, fabric`,
  `[Sound engine/INFO] OpenAL initialized on device "Speakers (Realtek(R) Audio)"`,
  `[Render thread/INFO] Loaded 1832 recipes, 1407 advancements`,
  `[Render thread/INFO] Setting user: ${account.username}`,
  `[Render thread/INFO] Using optional environment variables for authentication`,
  `[Render thread/INFO] Started integrated server in 1.42s`,
  `[Render thread/INFO] Loaded 12 chunks in 984 ms`,
  `[Render thread/INFO] Time elapsed: 3841 ms`,
  `[Render thread/INFO] Sound engine started`,
  `[Render thread/INFO] Created: 512x512x4 minecraft:textures/atlas/blocks.png`,
  `[Render thread/INFO] Player ${account.username} joined the world`,
];

async function launch(instanceId: string): Promise<GameStatus> {
  const instance = db.instances.find((i) => i.id === instanceId);
  if (!instance) throw new Error('no such instance');
  if (!instance.installed) {
    throw new Error('This instance is not installed yet — run the install step first.');
  }
  const account = db.accounts[0];
  if (!account) throw new Error('Sign in or add an offline account first.');
  if (running.has(instanceId)) throw new Error('This instance is already running.');

  const pid = 4000 + Math.floor(Math.random() * 30000);
  const startedAt = Math.floor(Date.now() / 1000);
  const lines = LAUNCH_LOG(instance, account);
  running.set(instanceId, { pid, startedAt, lines });

  instance.lastPlayed = startedAt;
  persist();

  emit('game://state', { instanceId, running: true, pid, startedAt });

  let index = 0;
  const timer = setInterval(() => {
    const game = running.get(instanceId);
    if (!game) return;
    if (index < game.lines.length) {
      const line = game.lines[index++];
      if (line) emit('game://log', line);
    }
  }, 420);
  timers.set(instanceId, timer);

  return { instanceId, running: true, pid, startedAt };
}

function kill(instanceId: string) {
  const timer = timers.get(instanceId);
  if (timer) clearInterval(timer);
  timers.delete(instanceId);
  const game = running.get(instanceId);
  running.delete(instanceId);
  emit('game://log', '[Infinity] Game process terminated.');
  emit('game://state', {
    instanceId,
    running: false,
    pid: game?.pid ?? null,
    startedAt: game?.startedAt ?? null,
  });
}

function instanceStatuses(): GameStatus[] {
  return [...running.entries()].map(([instanceId, game]) => ({
    instanceId,
    running: true,
    pid: game.pid,
    startedAt: game.startedAt,
  }));
}

function simulateInstall({ instanceId }: InstallArgs) {
  const instance = db.instances.find((i) => i.id === instanceId);
  if (!instance) throw new Error('no such instance');
  const taskId = `install:${instanceId}`;
  const existing = installTimers.get(taskId);
  if (existing) clearInterval(existing);

  const totalAssets = 3120;
  const totalLibs = instance.loader === 'vanilla' ? 62 : 118;
  const stages = [
    { stage: 'metadata', total: 3, label: `Fetching metadata for ${instance.mcVersion}` },
    { stage: 'client', total: 1, label: 'Downloading client jar' },
    { stage: 'libraries', total: totalLibs, label: 'Downloading libraries' },
    { stage: 'assets', total: totalAssets, label: 'Downloading assets' },
  ] as const;

  let stageIndex = 0;
  let current = 0;

  const tick = () => {
    const stage = stages[stageIndex];
    if (!stage) {
      clearInterval(timer);
      installTimers.delete(taskId);
      instance.installed = true;
      persist();
      emit('install://progress', {
        taskId,
        stage: 'done',
        current: 1,
        total: 1,
        message: 'Ready to play',
      } satisfies Progress);
      return;
    }
    const step = stage.stage === 'assets' ? 140 : stage.stage === 'libraries' ? 6 : 1;
    current = Math.min(stage.total, current + step);
    emit('install://progress', {
      taskId,
      stage: stage.stage,
      current,
      total: stage.total,
      message:
        stage.stage === 'assets'
          ? `Assets ${current}/${stage.total}`
          : stage.stage === 'libraries'
            ? `Libraries ${current}/${stage.total}`
            : stage.label,
    } satisfies Progress);
    if (current >= stage.total) {
      stageIndex += 1;
      current = 0;
    }
  };

  const timer = setInterval(tick, 90);
  installTimers.set(taskId, timer);
  tick();
}

let deviceCodeTimer: ReturnType<typeof setTimeout> | null = null;

function beginDeviceCode(): DeviceCode {
  return {
    deviceCode: 'M.C539_BAY.2.9d3f7c9a1b4e',
    userCode: 'QK7T-4XW2',
    verificationUri: 'https://microsoft.com/link',
    expiresIn: 900,
    interval: 5,
    message: 'To sign in, use a web browser to open https://microsoft.com/link and enter the code QK7T-4XW2.',
  };
}

function pollDeviceCode(): Promise<Account> {
  return new Promise((resolve, reject) => {
    if (deviceCodeTimer) clearTimeout(deviceCodeTimer);
    // Demo: the "player" finishes signing in after a moment.
    deviceCodeTimer = setTimeout(() => {
      const account: Account = {
        id: 'infinitydemo',
        username: 'InfinityPlayer',
        uuid: '8f2e1c0a-1b2c-4d3e-9f10-abcdef123456',
        kind: 'microsoft',
        avatarUrl: 'https://mc-heads.net/avatar/8f2e1c0a1b2c4d3e9f10abcdef123456/128',
        addedAt: Math.floor(Date.now() / 1000),
      };
      db.accounts = [account, ...db.accounts.filter((a) => a.kind !== 'microsoft')];
      persist();
      resolve(account);
    }, 5200);
    void reject;
  });
}

const javaRuntimes: JavaRuntime[] = [
  {
    path: '/Users/you/Library/Application Support/Infinity Launcher/runtime/jre-21/bin/java',
    version: '21.0.5',
    major: 21,
    vendor: 'Eclipse Adoptium',
    arch: 'x86_64',
    managed: true,
  },
  {
    path: '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/java',
    version: '17.0.13',
    major: 17,
    vendor: 'Eclipse Adoptium',
    arch: 'x86_64',
    managed: false,
  },
  {
    path: '/usr/lib/jvm/java-8-openjdk-amd64/jre/bin/java',
    version: '1.8.0_432',
    major: 8,
    vendor: 'Oracle Corporation',
    arch: 'x86_64',
    managed: false,
  },
];

function systemInfo(): SystemInfo {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const os = /Windows/i.test(ua)
    ? 'windows'
    : /Mac/i.test(ua)
      ? 'macos'
      : /Android/i.test(ua)
        ? 'android'
        : /iPhone|iPad|iPod/i.test(ua)
          ? 'ios'
          : 'linux';
  return {
    os,
    arch: 'x86_64',
    platform: 'desktop',
    totalMemoryMb: 16384,
    dataDir:
      os === 'windows'
        ? 'C:\\Users\\you\\AppData\\Roaming\\Infinity Launcher'
        : os === 'macos'
          ? '/Users/you/Library/Application Support/Infinity Launcher'
          : '/home/you/.local/share/Infinity Launcher',
    java: javaRuntimes,
    gameProcesses: instanceStatuses(),
    deviceName: 'Infinity Desktop',
  };
}

// ---------------------------------------------------------------------------
// Command router
// ---------------------------------------------------------------------------

export async function mockCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  // Small delay so loading states are actually visible in the demo.
  await new Promise((resolve) => setTimeout(resolve, 120));

  switch (command) {
    case 'system_info':
      return systemInfo() as T;

    case 'get_settings':
      return { ...db.settings } as T;

    case 'save_settings':
      db.settings = { ...(args?.settings as Settings) };
      persist();
      return db.settings as T;

    case 'list_instances':
      return [...db.instances].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)) as T;

    case 'create_instance': {
      const input = args?.args as CreateInstanceArgs;
      const id = `${input.mcVersion}-${Math.random().toString(36).slice(2, 8)}`;
      const created: Instance = {
        id,
        name: input.name || `${input.mcVersion} instance`,
        mcVersion: input.mcVersion,
        loader: input.loader,
        loaderVersion: input.loaderVersion,
        versionId:
          input.loader === 'vanilla'
            ? input.mcVersion
            : `${input.loader}-loader-${input.loaderVersion}-${input.mcVersion}`,
        gameDir: `~/Infinity Launcher/instances/${id}`,
        icon: input.icon ?? 'grass',
        ramMb: input.ramMb ?? db.settings.ramMb,
        javaPath: null,
        jvmArgs: null,
        createdAt: Math.floor(Date.now() / 1000),
        lastPlayed: null,
        playtimeSecs: 0,
        installed: false,
      };
      db.instances.push(created);
      persist();
      return created as T;
    }

    case 'update_instance': {
      const updated = args?.instance as Instance;
      db.instances = db.instances.map((i) => (i.id === updated.id ? updated : i));
      persist();
      return updated as T;
    }

    case 'delete_instance': {
      const id = args?.instanceId as string;
      db.instances = db.instances.filter((i) => i.id !== id);
      if (db.settings.selectedInstance === id) {
        db.settings.selectedInstance = db.instances[0]?.id ?? null;
      }
      persist();
      return undefined as T;
    }

    case 'open_instance_folder':
    case 'open_data_dir':
      return undefined as T;

    case 'fetch_version_manifest':
      return {
        latest: { release: '1.21.8', snapshot: '25w45a' },
        versions: VERSIONS.map((v) => ({
          id: v.id,
          type: v.type,
          releaseTime: v.releaseTime,
          time: v.releaseTime,
          url: `https://piston-meta.mojang.com/v1/packages/${v.id}/version.json`,
        })),
      } as T;

    case 'fetch_loader_versions': {
      const loader = args?.loader as Loader;
      const mcVersion = args?.mcVersion as string;
      const list = LOADER_VERSIONS[loader]?.[mcVersion] ?? [];
      return list.map((version, index) => ({
        version,
        stable: index < list.length - 1,
        mcVersion,
      })) as T;
    }

    case 'install_instance':
      simulateInstall(args?.args as InstallArgs);
      return undefined as T;

    case 'launch_instance':
      return (await launch(args?.instanceId as string)) as T;

    case 'kill_instance':
      kill(args?.instanceId as string);
      return undefined as T;

    case 'instance_status':
      return instanceStatuses() as T;

    case 'list_accounts':
      return [...db.accounts] as T;

    case 'add_offline_account': {
      const username = (args?.args as { username: string }).username.trim();
      if (!username) throw new Error('Enter a username.');
      if (username.length > 16) throw new Error('Minecraft usernames are at most 16 characters.');
      if (db.accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
        throw new Error('That account is already added.');
      }
      const account: Account = {
        id: username.toLowerCase(),
        username,
        uuid: offlineUuid(username),
        kind: 'offline',
        avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128`,
        addedAt: Math.floor(Date.now() / 1000),
      };
      db.accounts = [account, ...db.accounts];
      persist();
      return account as T;
    }

    case 'remove_account': {
      const id = args?.accountId as string;
      db.accounts = db.accounts.filter((a) => a.id !== id);
      persist();
      return undefined as T;
    }

    case 'set_active_account': {
      const id = args?.accountId as string;
      const account = db.accounts.find((a) => a.id === id);
      if (account) db.accounts = [account, ...db.accounts.filter((a) => a.id !== id)];
      persist();
      return undefined as T;
    }

    case 'auth_device_code_begin':
      return beginDeviceCode() as T;

    case 'auth_device_code_poll':
      return (await pollDeviceCode()) as T;

    case 'refresh_account':
      return db.accounts.find((a) => a.id === args?.accountId) as T;

    case 'detect_java_runtimes':
      return javaRuntimes as T;

    case 'provision_java_runtime':
      throw new Error('Runtime downloads are only available in the native app.');

    case 'read_log':
      return [] as T;

    case 'console_lines':
      return [] as T;

    case 'clear_log':
      return undefined as T;

    case 'catalog_status':
      return { modrinth: true, curseforge: false, curseforgeKeyConfigured: false } as T;

    case 'catalog_search':
      return demoCatalogSearch(args?.query as CatalogQuery) as T;

    case 'catalog_files':
      return demoCatalogFiles(args?.projectId as string, args?.kind as ContentKind) as T;

    case 'list_content':
      return demoContent.filter((item) => item.instanceId === args?.instanceId && item.kind === args?.kind) as T;

    case 'install_content': {
      const input = args?.args as InstallContentArgs;
      const item: ContentItem = {
        id: input.file.fileName,
        instanceId: input.instanceId,
        kind: input.kind,
        name: input.project.title,
        fileName: input.file.fileName,
        enabled: true,
        sizeBytes: input.file.size,
        source: input.project.source,
        projectId: input.project.id,
        versionId: input.file.id,
        installedAt: Math.floor(Date.now() / 1000),
      };
      demoContent = [...demoContent.filter((entry) => !(entry.instanceId === item.instanceId && entry.kind === item.kind && entry.id === item.id)), item];
      persistDemoContent();
      return item as T;
    }

    case 'toggle_content': {
      const { instanceId, kind, id, enabled } = args as { instanceId: string; kind: ContentKind; id: string; enabled: boolean };
      const item = demoContent.find((entry) => entry.instanceId === instanceId && entry.kind === kind && entry.id === id);
      if (!item) throw new Error('content not found');
      item.enabled = enabled;
      persistDemoContent();
      return item as T;
    }

    case 'remove_content': {
      const { instanceId, kind, id } = args as { instanceId: string; kind: ContentKind; id: string };
      demoContent = demoContent.filter((entry) => !(entry.instanceId === instanceId && entry.kind === kind && entry.id === id));
      persistDemoContent();
      return undefined as T;
    }

    case 'list_worlds':
      return demoWorlds.filter((world) => world.instanceId === args?.instanceId) as T;

    case 'list_appearance':
      return [...demoAppearance] as T;

    case 'save_appearance': {
      const profile = args?.profile as AppearanceProfile;
      const saved = { ...profile, id: profile.id || `look-${Date.now()}`, updatedAt: Math.floor(Date.now() / 1000) };
      demoAppearance = [...demoAppearance.filter((entry) => entry.id !== saved.id), saved];
      persistDemoAppearance();
      return saved as T;
    }

    case 'remove_appearance':
      demoAppearance = demoAppearance.filter((entry) => entry.id !== args?.id);
      persistDemoAppearance();
      return undefined as T;

    case 'performance_presets':
      return DEMO_PRESETS as T;

    case 'apply_performance':
      return undefined as T;

    case 'duplicate_instance': {
      const src = db.instances.find((i) => i.id === args?.instanceId);
      if (!src) throw new Error('instance not found');
      const copy = { ...src, id: `copy-${Date.now()}`, name: (args?.name as string) || `${src.name} (copy)`, createdAt: Math.floor(Date.now()/1000), lastPlayed: null, playtimeSecs: 0 };
      db.instances.push(copy); persist(); return copy as T;
    }
    case 'set_favorite_instance': {
      const id = args?.instanceId as string; const favorite = Boolean(args?.favorite);
      db.settings.favoriteInstances = [...(db.settings.favoriteInstances ?? []).filter((x) => x !== id), ...(favorite ? [id] : [])];
      persist(); return db.settings as T;
    }
    case 'check_content_updates': return [] as T;
    case 'list_screenshots': return [] as T;
    case 'backup_world': return { id: `backup-${Date.now()}`, instanceId: args?.instanceId, worldId: args?.worldId, fileName: `${args?.worldId}.zip`, path: '', sizeBytes: 0, createdAt: Math.floor(Date.now()/1000) } as T;
    case 'list_backups': return [] as T;
    case 'restore_backup': throw new Error('Backups are available in the native app.');
    case 'export_instance': return '' as T;
    case 'open_path': return undefined as T;
    case 'open_android_engine': throw new Error('Android engine handoff is available in the Android app.');
    case 'import_modpack': throw new Error('Modpack import is available in the native app.');

    case 'engine_status':
      return {
        id: 'amethyst', name: 'Amethyst (Pojav successor)',
        sourceUrl: 'https://github.com/AngelAuraMC/Amethyst-Android',
        sourceCommit: '28d6e12d68121b7dd75f2e841058a6b7cdfe4a29',
        license: 'LGPL-3.0', integrated: false, runtimeReady: false, gameplayVerified: false,
        renderers: ['gl4es', 'mobileglues', 'angle', 'mesa'],
        message: 'Amethyst is the selected Android Java engine, but this build does not yet bundle or launch it. Android Play remains disabled until runtime packaging, licensing notices and a physical-device gameplay test pass.',
      } as T;

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/** Java's `UUID.nameUUIDFromBytes("OfflinePlayer:<name>")`, approximated for the demo. */
function offlineUuid(username: string): string {
  let hash = 0;
  const input = `OfflinePlayer:${username}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
  return `${hex}-${hex.slice(0, 4)}-3${hex.slice(1, 4)}-a${hex.slice(2, 5)}-${hex}${hex.slice(0, 4)}`;
}

export const mockDb = {
  get settings() {
    return db.settings;
  },
};


// ---------------------------------------------------------------------------
// Browser-demo catalog/content/appearance fixtures. Native builds use Rust.
// ---------------------------------------------------------------------------

const CONTENT_KEY = 'infinity-launcher.demo.content.v1';
const APPEARANCE_KEY = 'infinity-launcher.demo.appearance.v1';

function readDemoArray<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]; } catch { return []; }
}
let demoContent: ContentItem[] = readDemoArray<ContentItem>(CONTENT_KEY);
let demoAppearance: AppearanceProfile[] = readDemoArray<AppearanceProfile>(APPEARANCE_KEY);
let demoWorlds: WorldItem[] = [
  { id: 'skyblock', instanceId: 'fabric-1.21.1', name: 'Skyblock Reborn', folderName: 'skyblock', sizeBytes: 48_200_000, modifiedAt: Math.floor(Date.now() / 1000) - 7200 },
];
function persistDemoContent() { try { localStorage.setItem(CONTENT_KEY, JSON.stringify(demoContent)); } catch { /* demo only */ } }
function persistDemoAppearance() { try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(demoAppearance)); } catch { /* demo only */ } }

const DEMO_PROJECTS: Array<CatalogProject & { loaders: string[] }> = [
  { id: 'sodium', source: 'modrinth', kind: 'mod', title: 'Sodium', summary: 'Modern rendering engine and client-side optimization for Minecraft.', author: 'CaffeineMC', iconUrl: null, webUrl: 'https://modrinth.com/mod/sodium', downloads: 92_000_000, updatedAt: '2026-10-01T00:00:00Z', loaders: ['fabric', 'quilt', 'neoforge'] },
  { id: 'lithium', source: 'modrinth', kind: 'mod', title: 'Lithium', summary: 'No-compromises game logic optimization for servers and singleplayer.', author: 'CaffeineMC', iconUrl: null, webUrl: 'https://modrinth.com/mod/lithium', downloads: 41_000_000, updatedAt: '2026-09-20T00:00:00Z', loaders: ['fabric', 'quilt', 'neoforge'] },
  { id: 'iris', source: 'modrinth', kind: 'mod', title: 'Iris Shaders', summary: 'A modern shaders mod for Minecraft, compatible with existing OptiFine shaderpacks.', author: 'coderbot', iconUrl: null, webUrl: 'https://modrinth.com/mod/iris', downloads: 38_000_000, updatedAt: '2026-09-12T00:00:00Z', loaders: ['fabric', 'quilt'] },
  { id: 'fabric-api', source: 'modrinth', kind: 'mod', title: 'Fabric API', summary: 'Essential hooks for Fabric mods.', author: 'FabricMC', iconUrl: null, webUrl: 'https://modrinth.com/mod/fabric-api', downloads: 120_000_000, updatedAt: '2026-10-10T00:00:00Z', loaders: ['fabric'] },
  { id: 'faithful', source: 'modrinth', kind: 'resourcepack', title: 'Faithful 32x', summary: 'The original 32x upgrade of the default Minecraft textures.', author: 'Faithful Team', iconUrl: null, webUrl: 'https://modrinth.com/resourcepack/faithful-32x', downloads: 14_000_000, updatedAt: '2026-08-01T00:00:00Z', loaders: [] },
  { id: 'complementary', source: 'modrinth', kind: 'shader', title: 'Complementary Shaders', summary: 'Beautiful, optimized shaders with a wide range of presets.', author: 'EminGTR', iconUrl: null, webUrl: 'https://modrinth.com/shader/complementary-reimagined', downloads: 22_000_000, updatedAt: '2026-09-01T00:00:00Z', loaders: [] },
  { id: 'skyblock-reborn', source: 'modrinth', kind: 'world', title: 'Skyblock Reborn', summary: 'A modern skyblock survival map with progression and challenges.', author: 'Community', iconUrl: null, webUrl: 'https://modrinth.com/world/skyblock-reborn', downloads: 900_000, updatedAt: '2026-07-01T00:00:00Z', loaders: [] },
  { id: 'fabulously-optimized', source: 'modrinth', kind: 'modpack', title: 'Fabulously Optimized', summary: 'A simple Minecraft modpack focused on performance and graphics.', author: 'FO Team', iconUrl: null, webUrl: 'https://modrinth.com/modpack/fabulously-optimized', downloads: 8_000_000, updatedAt: '2026-10-05T00:00:00Z', loaders: ['fabric'] },
];

function demoCatalogSearch(query: CatalogQuery): CatalogPage {
  const q = (query.query ?? '').toLowerCase();
  const projects = DEMO_PROJECTS.filter((project) => project.kind === query.kind)
    .filter((project) => !q || project.title.toLowerCase().includes(q) || project.summary.toLowerCase().includes(q))
    .filter((project) => query.kind !== 'mod' || !query.loader || query.loader === 'vanilla' || project.loaders.includes(query.loader));
  return { projects, total: projects.length, offset: query.offset ?? 0, limit: 20 };
}

function demoCatalogFiles(projectId: string, kind: ContentKind): CatalogFile[] {
  const project = DEMO_PROJECTS.find((entry) => entry.id === projectId);
  const ext = kind === 'mod' ? 'jar' : 'zip';
  return [{
    id: `${projectId}-demo`, projectId, name: 'Demo release', versionNumber: '1.0.0',
    fileName: `${projectId}-1.0.0.${ext}`, url: `https://cdn.modrinth.com/data/${projectId}/demo.${ext}`,
    size: 2_400_000, sha1: null, sha512: null, gameVersions: ['1.21.1', '1.20.1'], loaders: project?.loaders ?? [], releaseType: 'release',
  }];
}

const DEMO_PRESETS: PerformancePreset[] = [
  { id: 'battery', name: 'Battery saver', renderDistance: 6, simulationDistance: 4, maxFps: 45, particles: 2, clouds: 0, graphicsMode: 0 },
  { id: 'balanced', name: 'Balanced', renderDistance: 10, simulationDistance: 8, maxFps: 60, particles: 1, clouds: 1, graphicsMode: 1 },
  { id: 'quality', name: 'Quality', renderDistance: 16, simulationDistance: 12, maxFps: 120, particles: 0, clouds: 2, graphicsMode: 2 },
];
