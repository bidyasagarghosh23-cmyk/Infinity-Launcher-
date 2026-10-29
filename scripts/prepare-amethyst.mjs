#!/usr/bin/env node
/**
 * Fetch the pinned Amethyst source into .tmp/amethyst for integration work.
 * This does NOT build or bundle the engine, and does not enable Android Play.
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const lock = JSON.parse(readFileSync(path.join(root, 'engine/amethyst.lock.json'), 'utf8'));
const dest = path.join(root, '.tmp', 'amethyst');
mkdirSync(path.dirname(dest), { recursive: true });

const git = (args, cwd = root) => execFileSync('git', args, { cwd, stdio: 'inherit' });

if (!existsSync(path.join(dest, '.git'))) {
  git(['clone', '--branch', lock.ref, lock.upstream, dest]);
}
git(['fetch', 'origin', lock.commit], dest);
git(['checkout', '--detach', lock.commit], dest);
// CI cannot use the upstream SSH submodule URL; rewrite it locally for this clone.
git(['config', 'url.https://github.com/.insteadOf', 'git@github.com:'], dest);
git(['submodule', 'update', '--init', '--recursive'], dest);

const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dest, encoding: 'utf8' }).trim();
if (head !== lock.commit) throw new Error(`Amethyst checkout mismatch: ${head} != ${lock.commit}`);
console.log(`\nAmethyst source prepared at ${dest} (${head}).`);
console.log('Status: source only. No runtime is bundled and Android Play remains disabled.');
