import { cn } from '../../lib/util';

type Props = { className?: string };

export function WindowsGlyph({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor" aria-hidden>
      <path d="M3 5.6 10.4 4.6v6.8H3V5.6Zm0 12.8 7.4 1v-6.7H3v5.7ZM11.5 4.4 21 3v8.4h-9.5V4.4Zm0 15.2L21 21v-8.5h-9.5V19.6Z" />
    </svg>
  );
}

export function AppleGlyph({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor" aria-hidden>
      <path d="M16.2 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9-.7 0-1.9-.9-3.1-.9-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3.1-.7s1.8.7 3.1.7c1.3 0 2.1-1.1 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.6Z" />
      <path d="M14.1 5.3c.6-.8 1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  );
}

export function LinuxGlyph({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor" aria-hidden>
      <path d="M12 2a3.6 3.6 0 0 0-3.6 3.6c0 .9.3 1.7.3 1.7-.9 1.3-2 3.2-2.5 5.2-.4 1.6-1.3 2.1-1.6 3.5-.2 1.1.2 2 .7 2.4-.2.5-.4 1 0 1.6.5.8 1.7 1 2.7 1 1.1 0 1.9-.4 2.7-.4h2.6c.8 0 1.6.4 2.7.4 1 0 2.2-.2 2.7-1 .4-.6.2-1.1 0-1.6.5-.4.9-1.3.7-2.4-.3-1.4-1.2-1.9-1.6-3.5-.5-2-1.6-3.9-2.5-5.2 0 0 .3-.8.3-1.7A3.6 3.6 0 0 0 12 2Zm-1.6 3.3c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm3.2 0c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9ZM12 8c.8 0 1.5.5 1.5.9 0 .4-.7.9-1.5.9s-1.5-.5-1.5-.9c0-.4.7-.9 1.5-.9Zm-3.6 6.1c.6 0 1.1.7 1.1 1.5s-.5 1.5-1.1 1.5-1.1-.7-1.1-1.5.5-1.5 1.1-1.5Zm7.2 0c.6 0 1.1.7 1.1 1.5s-.5 1.5-1.1 1.5-1.1-.7-1.1-1.5.5-1.5 1.1-1.5Z" />
    </svg>
  );
}

export function AndroidGlyph({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="currentColor" aria-hidden>
      <path d="M7.2 6.4 6 4.3a.4.4 0 1 1 .7-.4l1.2 2.2a7.7 7.7 0 0 1 4.2 0l1.2-2.2a.4.4 0 1 1 .7.4L12.8 6.4A6.6 6.6 0 0 1 17 12H7a6.6 6.6 0 0 1 5.8-5.6ZM9.4 8.6a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Zm5.2 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4ZM7 12.8h10v4.4a1.4 1.4 0 0 1-1.4 1.4H8.4A1.4 1.4 0 0 1 7 17.2v-4.4Zm-2.4 0a1.2 1.2 0 0 1 1.2 1.2v3.6a1.2 1.2 0 0 1-2.4 0V14a1.2 1.2 0 0 1 1.2-1.2Zm14.8 0A1.2 1.2 0 0 1 20.6 14v3.6a1.2 1.2 0 0 1-2.4 0V14a1.2 1.2 0 0 1 1.2-1.2Z" />
    </svg>
  );
}

export function IosGlyph({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="none" aria-hidden>
      <rect
        x="7"
        y="2.4"
        width="10"
        height="19.2"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10.6 4.6h2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export const PLATFORMS = [
  { id: 'windows', label: 'Windows', Glyph: WindowsGlyph, note: 'Windows 10/11 · x64 & ARM64' },
  { id: 'macos', label: 'macOS', Glyph: AppleGlyph, note: 'Apple silicon & Intel · 10.15+' },
  { id: 'linux', label: 'Linux', Glyph: LinuxGlyph, note: 'deb · rpm · AppImage' },
  { id: 'android', label: 'Android', Glyph: AndroidGlyph, note: 'Android 8+ · ARM64' },
  { id: 'ios', label: 'iOS', Glyph: IosGlyph, note: 'iOS 14+ · iPadOS' },
] as const;

export function platformGlyph(os: string) {
  switch (os) {
    case 'windows':
      return WindowsGlyph;
    case 'macos':
      return AppleGlyph;
    case 'linux':
      return LinuxGlyph;
    case 'android':
      return AndroidGlyph;
    case 'ios':
      return IosGlyph;
    default:
      return WindowsGlyph;
  }
}
