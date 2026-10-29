/** Typed wrappers around every backend command. */

import { call } from './bridge';
import type {
  Account,
  AppearanceProfile,
  CatalogFile,
  CatalogPage,
  CatalogQuery,
  CatalogSource,
  CatalogStatus,
  ContentItem,
  ContentKind,
  EngineStatus,
  InstallContentArgs,
  PerformancePreset,
  WorldItem,
  CreateInstanceArgs,
  DeviceCode,
  GameStatus,
  InstallArgs,
  Instance,
  JavaRuntime,
  Loader,
  LoaderVersion,
  Settings,
  SystemInfo,
  VersionManifest,
} from './types';

export const api = {
  systemInfo: () => call<SystemInfo>('system_info'),

  getSettings: () => call<Settings>('get_settings'),
  saveSettings: (settings: Settings) => call<Settings>('save_settings', { settings }),

  listInstances: () => call<Instance[]>('list_instances'),
  createInstance: (args: CreateInstanceArgs) => call<Instance>('create_instance', { args }),
  updateInstance: (instance: Instance) => call<Instance>('update_instance', { instance }),
  deleteInstance: (instanceId: string, deleteFiles = true) =>
    call<void>('delete_instance', { instanceId, deleteFiles }),
  openInstanceFolder: (instanceId: string) => call<void>('open_instance_folder', { instanceId }),
  openDataDir: () => call<void>('open_data_dir'),

  fetchVersionManifest: () => call<VersionManifest>('fetch_version_manifest'),
  fetchLoaderVersions: (loader: Loader, mcVersion: string) =>
    call<LoaderVersion[]>('fetch_loader_versions', { loader, mcVersion }),

  installInstance: (args: InstallArgs) => call<void>('install_instance', { args }),
  launchInstance: (instanceId: string) => call<GameStatus>('launch_instance', { instanceId }),
  killInstance: (instanceId: string) => call<void>('kill_instance', { instanceId }),
  instanceStatus: () => call<GameStatus[]>('instance_status'),

  listAccounts: () => call<Account[]>('list_accounts'),
  addOfflineAccount: (username: string) =>
    call<Account>('add_offline_account', { args: { username } }),
  removeAccount: (accountId: string) => call<void>('remove_account', { accountId }),
  setActiveAccount: (accountId: string) => call<void>('set_active_account', { accountId }),
  beginDeviceCode: () => call<DeviceCode>('auth_device_code_begin'),
  pollDeviceCode: (deviceCode: string) =>
    call<Account>('auth_device_code_poll', { deviceCode }),
  refreshAccount: (accountId: string) => call<Account>('refresh_account', { accountId }),

  detectJava: () => call<JavaRuntime[]>('detect_java_runtimes'),
  provisionJava: (major: number) => call<JavaRuntime>('provision_java_runtime', { major }),

  readLog: (instanceId: string, lines = 400) =>
    call<string[]>('read_log', { instanceId, lines }),
  consoleLines: () => call<string[]>('console_lines'),
  clearLog: (instanceId: string) => call<void>('clear_log', { instanceId }),

  catalogStatus: () => call<CatalogStatus>('catalog_status'),
  catalogSearch: (query: CatalogQuery) => call<CatalogPage>('catalog_search', { query }),
  catalogFiles: (source: CatalogSource, projectId: string, kind: ContentKind, mcVersion?: string | null, loader?: string | null) =>
    call<CatalogFile[]>('catalog_files', { source, projectId, kind, mcVersion, loader }),
  listContent: (instanceId: string, kind: ContentKind) => call<ContentItem[]>('list_content', { instanceId, kind }),
  installContent: (args: InstallContentArgs) => call<ContentItem>('install_content', { args }),
  toggleContent: (instanceId: string, kind: ContentKind, id: string, enabled: boolean) =>
    call<ContentItem>('toggle_content', { instanceId, kind, id, enabled }),
  removeContent: (instanceId: string, kind: ContentKind, id: string) =>
    call<void>('remove_content', { instanceId, kind, id }),
  listWorlds: (instanceId: string) => call<WorldItem[]>('list_worlds', { instanceId }),
  listAppearance: () => call<AppearanceProfile[]>('list_appearance'),
  saveAppearance: (profile: AppearanceProfile) => call<AppearanceProfile>('save_appearance', { profile }),
  removeAppearance: (id: string) => call<void>('remove_appearance', { id }),
  performancePresets: () => call<PerformancePreset[]>('performance_presets'),
  applyPerformance: (instanceId: string, presetId: string) => call<void>('apply_performance', { instanceId, presetId }),
  engineStatus: () => call<EngineStatus>('engine_status'),
};
