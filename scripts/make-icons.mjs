#!/usr/bin/env node
/**
 * Regenerates every platform icon (Windows .ico, macOS .icns, Android mipmaps,
 * iOS asset catalog, Linux PNGs) from one square source image.
 *
 *   npm run icons                 # uses src-tauri/icons/source-logo.png
 *   npm run icons -- path/to.png
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const source = path.resolve(process.argv[2] ?? path.join(root, 'src-tauri/icons/source-logo.png'));

if (!fs.existsSync(source)) {
  console.error(`Source image not found: ${source}`);
  process.exit(1);
}

console.log(`Generating icons from ${path.relative(root, source)}…`);
execFileSync('npx', ['tauri', 'icon', source], { cwd: root, stdio: 'inherit' });

const png = path.join(root, 'src-tauri/icons/128x128@2x.png');
if (fs.existsSync(png)) {
  fs.copyFileSync(png, path.join(root, 'public/icon.png'));
  fs.copyFileSync(path.join(root, 'src-tauri/icons/32x32.png'), path.join(root, 'public/favicon-32.png'));
  console.log('Copied web icons into public/');
}
