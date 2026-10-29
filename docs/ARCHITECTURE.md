# Architecture

Infinity Launcher is two halves that only meet at one narrow, typed boundary.

```
┌──────────────────────────────┐        invoke("launch_instance")        ┌─────────────────────────────┐
│  React + TypeScript (src/)   │ ──────────────────────────────────────▶ │  Rust launcher core         │
│  zustand store, design system│ ◀────────────────────────────────────── │  (src-tauri/src)            │
│  pages: home/instances/...   │   events: install://progress game://log  │  mojang · install · launch  │
└──────────────────────────────┘                                          └─────────────────────────────┘
                                                                                     │
                                                                            ┌────────▼────────┐
                                                                            │  data folder    │
                                                                            │  versions/      │
                                                                            │  libraries/     │
                                                                            │  assets/        │
                                                                            │  instances/     │
                                                                            └─────────────────┘
```

`src/lib/bridge.ts` is the only place that knows whether it is talking to Rust
or to the in-browser demo backend (`src/lib/mock.ts`). Every command exists in
both, with the same argument names and payload shapes, so pages never branch on
platform.

## Launching, step by step

1. **Version resolution** — `mojang::resolve_version` reads
   `versions/<id>/<id>.json` and walks `inheritsFrom` upward (Forge, NeoForge,
   Fabric, Quilt and OptiFine profiles all rely on this). Fields are merged
   root→child so a child overrides what it declares and inherits the rest;
   libraries are merged by exact Maven coordinate.
2. **Rule filtering** — every library and every argument carries Mojang's
   `rules` array. `rules::allows` evaluates them last-match-wins against the
   host OS (`windows` / `osx` / `linux`), architecture (`x86` / `arm64`) and
   feature flags (custom resolution, quick play, demo).
3. **Classpath** — applicable libraries are resolved to
   `libraries/<group path>/<artifact>/<version>/<artifact>-<version>.jar`, plus
   the client jar from the version that owns `downloads.client`.
4. **Natives** — classifier natives (`natives-linux`, `natives-windows-64`, …)
   are extracted into `natives/<version id>/`; `-Djava.library.path` points
   there. `extract.exclude` is honoured.
5. **Variable substitution** — `${auth_player_name}`, `${auth_uuid}`,
   `${assets_root}`, `${game_directory}`, `${launcher_name}`, … are filled from
   the account, instance and settings.
6. **Command line** — `java <memory> <natives> <jvm args> -cp <classpath>
   <mainClass> <game args>`, then spawned with the instance game directory as
   cwd and stdout/stderr piped into `<logs>/<instance>.log` and the Console page.
7. **Process tracking** — the child handle lives in `AppState.running`; a
   watcher thread polls `try_wait` and emits `game://state` so the UI flips the
   Play button back when the game exits. `kill_instance` terminates it.

## Memory model

Arguments are built in three layers, most specific last:

```
settings.jvm_args → instance.jvm_args → version JSON jvm args (rules applied)
```

so a modpack's own flags never get clobbered by the launcher, but users can
still add theirs.

## Install pipeline

`install_instance` runs on a dedicated thread with its own Tokio runtime so a
multi-thousand-file download never fights the UI thread.

| Stage | What happens | Event |
|---|---|---|
| `metadata` | fetch + cache the version JSON | `install://progress` |
| `client` | download the client jar (SHA-1 verified) | |
| `libraries` | download libraries concurrently (default 8, configurable) | |
| `assets` | asset index, then ~3k object blobs by hash, 4× concurrency | |
| `java` | optional managed JRE download (desktop) | |
| `loader` | write Fabric/Quilt profile JSON or run the Forge/NeoForge installer | |
| `done` | mark the instance installed | |

Downloads are idempotent: a file whose SHA-1 already matches is skipped, which
makes "repair" cheap and safe.

## State and storage

| File | Contents |
|---|---|
| `settings.json` | memory, Java path, arguments, resolution, download concurrency, data dir |
| `accounts.json` | accounts with refresh tokens and cached profile/skin URLs |
| `instances.json` | instance definitions (version, loader, game dir, playtime) |

Writes are atomic (temp file + rename) so a crash never leaves a half-written
file. Nothing is stored in a database, and nothing is uploaded anywhere.

## Frontend architecture

- **zustand** store (`src/store/launcher.ts`) holds settings, instances,
  accounts, running processes, install progress, console lines and toasts.
- Backend events are subscribed once at boot (`init`) and folded into that
  store; components only read derived slices.
- Pages are lazy in spirit but tiny — the whole UI ships as ~120 KB gzipped.
- The layout is responsive to the pixel: a 264 px sidebar on desktop, a bottom
  tab bar with safe-area padding on phones, and large touch targets throughout.

## Extending

- **New loader**: add a variant to `model::Loader`, a case in
  `install::loader_versions` / `install_loader` / `loader_version_id`, and a
  label in `src/lib/util.ts`.
- **New IPC command**: write it in `src-tauri/src/commands.rs`, register it in
  `lib.rs`, add a wrapper in `src/lib/api.ts`, and mirror it in
  `src/lib/mock.ts` so the browser demo keeps working.
- **New page**: add a route id to `Route`, a nav entry, and render it in
  `src/App.tsx`.
