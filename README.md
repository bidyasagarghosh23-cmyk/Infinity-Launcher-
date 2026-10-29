# Infinity Launcher

A **custom Minecraft: Java Edition launcher** built once and shipped to
**Windows, macOS, Linux, Android and iOS**.

Infinity Launcher is a native app — not a website wrapper around someone else's
launcher. It downloads Minecraft itself, resolves version metadata, applies
Mojang's rule engine, builds the JVM command line and launches the game. The UI
is React + TypeScript; the launcher core is Rust on top of [Tauri 2](https://tauri.app).

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="112" alt="Infinity Launcher icon" />
</p>

<p align="center">
  <b>Home · Instances · Console · Accounts · Settings</b><br/>
  glass-dark UI · live install progress · device-code Microsoft sign-in
</p>

---

## What it does

| | |
|---|---|
| **Real installer** | Fetches `version_manifest_v2.json`, resolves `inheritsFrom` chains, verifies SHA-1 on every library and asset, extracts natives, writes logging configs. |
| **Mod loaders** | Vanilla, **Fabric**, **Quilt**, **Forge**, **NeoForge** — loader builds are queried per Minecraft version, Forge/NeoForge installers are executed for you. |
| **Accounts** | Microsoft sign-in via the **OAuth device-code flow** (no browser redirect, works identically on desktop and mobile), plus instant offline profiles using vanilla's `OfflinePlayer:<name>` UUID algorithm. |
| **Instances** | Every profile gets its own game directory, icon, memory allocation, Java runtime and extra arguments. |
| **Java management** | Detects JVMs across the usual install locations and `PATH`, picks the smallest runtime that satisfies the version, and can download a managed Temurin JRE on desktop. |
| **Live console** | Game stdout/stderr is streamed into the launcher with level filters, plus per-instance log files on disk. |
| **Offline-first UI** | Settings, accounts and instances are plain JSON in your data folder. No telemetry, no accounts server, no phoning home. |

## Platform support

| Platform | Shell | Status |
|---|---|---|
| Windows 10/11 (x64, ARM64) | Tauri / WebView2 | ✅ fully supported |
| macOS 10.15+ (Intel & Apple silicon) | Tauri / WKWebView | ✅ fully supported |
| Linux (deb, rpm, AppImage) | Tauri / WebKitGTK | ✅ fully supported |
| Android 8+ (ARM64) | Tauri / Android WebView | ⚠️ UI + launcher core compile and run; playing Java Edition needs a bundled JVM — see [docs/PLATFORMS.md](docs/PLATFORMS.md) |
| iOS / iPadOS 14+ | Tauri / WKWebView | ⚠️ UI compiles and runs; Java execution is not possible on stock iOS — see [docs/PLATFORMS.md](docs/PLATFORMS.md) |

Desktop is the honest, complete target today. Mobile is wired end-to-end (the
same Rust commands, the same UI, mobile layouts, safe-area handling) with the
JVM situation documented rather than hand-waved.

## Native downloads

Windows `.exe` and Android `.apk` preview packages are built by GitHub Actions.
See [DOWNLOADS.md](DOWNLOADS.md) for the current package links,
[Releases](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases)
for all builds, and [docs/PACKAGING.md](docs/PACKAGING.md) for compatibility,
signing and installation details. The Android APK is a client hub/content
manager; it does **not** yet include a tested Android JVM/rendering bridge for
playing Java Edition on Android. See
[docs/ENGINE_COMPARISON.md](docs/ENGINE_COMPARISON.md) for the Amethyst vs
ZalithLauncher2/MJLauncher engine comparison.

## Quick start

```bash
# prerequisites: Node 20+, Rust 1.77+, and the Tauri system deps for your OS
npm install

npm run dev          # UI only, in a browser, against a built-in demo backend
npm run tauri:dev    # the real native app
npm run tauri:build  # installers/bundles for the current platform
```

The browser demo (`npm run dev`) runs the **same React app** with a mock backend
so every screen is explorable without a Rust toolchain: instances, install
progress, logs and account flows are simulated and persisted in
`localStorage`. Anything you see there exists 1:1 as a Tauri command.

### Building for phones

```bash
# Android — needs JDK 17, Android SDK/NDK, ANDROID_HOME
npm run tauri android init
npm run tauri android dev          # device/emulator
npm run tauri android build        # .apk / .aab

# iOS — needs Xcode 15+, CocoaPods, and a signing team
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build
```

## Project layout

```
├─ src/                     React + TypeScript UI
│  ├─ components/           design system, brand marks, layout shell
│  ├─ pages/                Home · Instances · Console · Accounts · Settings
│  ├─ lib/                  typed API bridge, demo backend, helpers
│  └─ store/                zustand store (single source of UI state)
├─ src-tauri/               Rust launcher core (Tauri 2)
│  ├─ src/mojang.rs         manifest, version JSON, rules, CDN downloads
│  ├─ src/install.rs        install pipeline + loader profiles
│  ├─ src/launch.rs         JVM command line + process management
│  ├─ src/auth.rs           Microsoft / Xbox Live / Minecraft auth
│  ├─ src/java.rs           runtime discovery + provisioning
│  ├─ src/rules.rs          Mojang rule engine (OS / arch / features)
│  └─ src/commands.rs       IPC surface used by the UI
├─ docs/                    architecture, platforms, auth
└─ scripts/                 icon generation, headless UI smoke test
```

### Data folder

Everything lives under one directory (overridable with `INFINITY_DATA_DIR`,
otherwise the OS data dir):

```
Infinity Launcher/
├─ settings.json      accounts.json      instances.json
├─ versions/          libraries/         assets/       natives/
├─ runtime/           (managed JREs)
├─ instances/<id>/    (worlds, mods, resourcepacks, shaderpacks, config)
└─ logs/<instance>.log
```

It mirrors a normal `.minecraft` folder, so worlds and packs move between
launchers without conversion.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how a launch happens, end to end
- [docs/PLATFORMS.md](docs/PLATFORMS.md) — per-platform builds and the Java-on-mobile reality
- [docs/AUTH.md](docs/AUTH.md) — Microsoft sign-in setup and token handling

## Development notes

- `npm run typecheck` — strict TypeScript, no `any` escapes.
- `node scripts/smoke.mjs` — mounts the real UI in jsdom against the demo
  backend, walks every page and asserts nothing throws. Runs in CI.
- `cargo test` in `src-tauri/` — rule engine, Maven path building, MD5/offline
  UUID vectors, Java version mapping, argument splitting.
- `npm run icons` — regenerate every platform icon from one square PNG.

## Legal

Infinity Launcher is an unofficial, community project. It is **not affiliated
with, endorsed by, or associated with Mojang Studios or Microsoft**. “Minecraft”
is a trademark of Mojang Synergies AB. You must own a legitimate copy of
Minecraft: Java Edition to play online.

Code is MIT licensed — see [LICENSE](LICENSE).
