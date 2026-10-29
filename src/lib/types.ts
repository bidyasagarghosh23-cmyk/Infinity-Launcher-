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
