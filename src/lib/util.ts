import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPlaytime(seconds: number): string {
  if (!seconds) return 'Never played';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h played`;
  }
  if (hours > 0) return `${hours}h ${minutes}m played`;
  return `${minutes}m played`;
}

export function formatRelative(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Never';
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export const LOADER_LABEL: Record<string, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
};

export const LOADER_ACCENT: Record<string, string> = {
  vanilla: 'from-emerald-400/80 to-teal-500/80',
  fabric: 'from-amber-300/80 to-orange-400/80',
  quilt: 'from-fuchsia-400/80 to-purple-500/80',
  forge: 'from-sky-400/80 to-blue-500/80',
  neoforge: 'from-orange-400/80 to-rose-500/80',
};

/** Rough Java requirement per version, mirroring `java::required_for`. */
export function requiredJava(mcVersion: string): number {
  const parts = mcVersion.split('.');
  if (parts[0] !== '1') return 21; // snapshots and oddities
  const minor = Number.parseInt(parts[1] ?? '21', 10);
  const patch = Number.parseInt(parts[2] ?? '0', 10);
  if (!Number.isFinite(minor)) return 21;
  if (minor <= 16) return 8;
  if (minor <= 19) return 17;
  if (minor === 20) return Number.isFinite(patch) && patch >= 5 ? 21 : 17;
  return 21;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.resolve();
}

export function platformLabel(os: string): string {
  switch (os) {
    case 'windows':
      return 'Windows';
    case 'macos':
      return 'macOS';
    case 'linux':
      return 'Linux';
    case 'android':
      return 'Android';
    case 'ios':
      return 'iOS';
    default:
      return os;
  }
}
