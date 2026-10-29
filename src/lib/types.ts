/**
 * Mirrors `src-tauri/src/model.rs`. Keep both sides in sync — field names are
 * camelCase on the wire.
 */

export type Loader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';
export type AccountKind = 'microsoft' | 'offline' | 'demo';

export interface VersionSummary {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
  sha1?: string | null;
}

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionSummary[];
}

export interface Instance {
  id: string;
  name: string;
  mcVersion: string;
  loader: Loader;
  loaderVersion: string | null;
  versionId: string;
  gameDir: string;
  icon: string;
  ramMb: number | null;
  javaPath: string | null;
  jvmArgs: string | null;
  createdAt: number;
  lastPlayed: number | null;
  playtimeSecs: number;
  installed: boolean;
}

export interface Settings {
  offlineUsername: string;
  ramMb: number;
  javaPath: string | null;
  jvmArgs: string;
  gameArgs: string;
  dataDir: string | null;
  fullscreen: boolean;
  windowWidth: number;
  windowHeight: number;
  closeOnLaunch: boolean;
  autoUpdate: boolean;
  downloadConcurrency: number;
  showSnapshots: boolean;
  language: string;
  selectedInstance: string | null;
  theme: string;
  performanceProfile: string;
  androidRenderer: string;
  touchControls: boolean;
  reduceEffects: boolean;
  favoriteInstances: string[];
  showNews: boolean;
  compactMode: boolean;
}

export interface Account {
  id: string;
  username: string;
  uuid: string;
  kind: AccountKind;
  avatarUrl?: string | null;
  skinUrl?: string | null;
  capeUrl?: string | null;
  skinVariant?: string | null;
  refreshToken?: string | null;
  accessToken?: string | null;
  expiresAt?: number | null;
  xuid?: string | null;
  addedAt: number;
}

export type ProgressStage =
  | 'metadata'
  | 'client'
  | 'libraries'
  | 'assets'
  | 'java'
  | 'loader'
  | 'launching'
  | 'done'
  | 'error';

export interface Progress {
  taskId: string;
  stage: ProgressStage;
  current: number;
  total: number;
  message: string;
  bytesPerSecond?: number | null;
}

export interface GameStatus {
  instanceId: string;
  running: boolean;
  pid?: number | null;
  startedAt?: number | null;
}

export interface JavaRuntime {
  path: string;
  version: string;
  major: number;
  vendor: string;
  arch: string;
  managed: boolean;
}

export interface SystemInfo {
  os: string;
  arch: string;
  platform: string;
  totalMemoryMb: number;
  dataDir: string;
  java: JavaRuntime[];
  gameProcesses: GameStatus[];
  deviceName: string;
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

export interface LoaderVersion {
  version: string;
  stable: boolean;
  mcVersion?: string | null;
}

export interface CreateInstanceArgs {
  name: string;
  mcVersion: string;
  loader: Loader;
  loaderVersion: string | null;
  icon?: string;
  ramMb?: number | null;
}

export interface InstallArgs {
  instanceId: string;
  fresh?: boolean;
}

// ---------------------------------------------------------------------------
// Client hub: catalogs, content, appearance, performance and engine status
// ---------------------------------------------------------------------------

export type ContentKind = 'mod' | 'resourcepack' | 'shader' | 'world' | 'datapack' | 'modpack';
export type CatalogSource = 'modrinth' | 'curseforge';

export interface CatalogQuery {
  source: CatalogSource;
  kind: ContentKind;
  query?: string;
  mcVersion?: string | null;
  loader?: string | null;
  offset?: number;
}

export interface CatalogProject {
  id: string;
  source: CatalogSource;
  kind: ContentKind;
  title: string;
  summary: string;
  author: string;
  iconUrl?: string | null;
  webUrl: string;
  downloads: number;
  updatedAt: string;
}

export interface CatalogFile {
  id: string;
  projectId: string;
  name: string;
  versionNumber: string;
  fileName: string;
  url: string;
  size: number;
  sha1?: string | null;
  sha512?: string | null;
  gameVersions: string[];
  loaders: string[];
  releaseType: string;
}

export interface CatalogPage {
  projects: CatalogProject[];
  total: number;
  offset: number;
  limit: number;
}

export interface CatalogStatus {
  modrinth: boolean;
  curseforge: boolean;
  curseforgeKeyConfigured: boolean;
}

export interface ContentItem {
  id: string;
  instanceId: string;
  kind: ContentKind;
  name: string;
  fileName: string;
  enabled: boolean;
  sizeBytes: number;
  source?: CatalogSource | null;
  projectId?: string | null;
  versionId?: string | null;
  installedAt: number;
}

export interface WorldItem {
  id: string;
  instanceId: string;
  name: string;
  folderName: string;
  sizeBytes: number;
  modifiedAt: number;
}

export interface InstallContentArgs {
  instanceId: string;
  kind: ContentKind;
  project: CatalogProject;
  file: CatalogFile;
}

export interface AppearanceProfile {
  id: string;
  accountId: string;
  name: string;
  skinDataUrl?: string | null;
  skinVariant: string;
  capeDataUrl?: string | null;
  capeEnabled: boolean;
  capeColor: string;
  capePattern: string;
  wings: string;
  auraColor: string;
  auraEnabled: boolean;
  updatedAt: number;
}

export interface EngineStatus {
  id: string;
  name: string;
  sourceUrl: string;
  sourceCommit: string;
  license: string;
  integrated: boolean;
  runtimeReady: boolean;
  gameplayVerified: boolean;
  renderers: string[];
  message: string;
}

export interface PerformancePreset {
  id: string;
  name: string;
  renderDistance: number;
  simulationDistance: number;
  maxFps: number;
  particles: number;
  clouds: number;
  graphicsMode: number;
}

export interface ContentUpdate { item: ContentItem; latest: CatalogFile }
export interface ScreenshotItem { id: string; instanceId: string; fileName: string; path: string; sizeBytes: number; modifiedAt: number }
export interface BackupItem { id: string; instanceId: string; worldId: string; fileName: string; path: string; sizeBytes: number; createdAt: number }
export interface ImportModpackArgs { path: string; name?: string | null }
