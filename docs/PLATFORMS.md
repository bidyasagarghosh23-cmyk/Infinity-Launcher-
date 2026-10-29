# Platforms

Infinity Launcher targets five platforms from one codebase. What "supported"
means differs per platform, mostly because of one blunt fact: **Minecraft: Java
Edition needs a desktop JVM**, and mobile operating systems do not have one.

## Desktop — done

| Target | Bundle | Notes |
|---|---|---|
| Windows x64 / ARM64 | `.msi`, `.exe` (NSIS) | WebView2 is preinstalled on Windows 11; the installer can bootstrap it. |
| macOS Intel / Apple silicon | `.dmg`, `.app` | Universal binary via `--target universal-apple-darwin`. Hardened runtime + JIT entitlements are already in `src-tauri/entitlements.plist` because the launcher spawns a JVM. |
| Linux x64 / ARM64 | `.deb`, `.rpm`, `.AppImage` | Needs `libwebkit2gtk-4.1` at runtime. |

```bash
npm run tauri:build                                    # current OS
npm run tauri:build -- --target universal-apple-darwin # macOS universal
```

## Android — UI and core compile; game needs a JVM

Tauri builds a real APK/AAB with the identical Rust core and UI, mobile layout,
safe-area insets and touch targets.

```bash
# prerequisites: JDK 17, Android Studio + SDK/NDK, ANDROID_HOME + NDK_HOME
npm run tauri android init
npm run tauri android dev
npm run tauri android build -- --apk --aab
```

**The honest part:** Android ships no JVM, and Minecraft: Java Edition cannot
run on ART. Running Java Edition on Android is only possible by bundling a
Java runtime compiled for the device (this is the approach projects like
PojavLauncher take: a Pojav-style JRE, Pango/Cairo shims and an OpenGL surface
with GL4ES/ANGLE/VirGL translation).

Infinity Launcher is structured so that is a *plumbing* change, not a rewrite:

1. `java::provision` already installs runtimes into `runtime/`; add an Android
   branch that unpacks a Pojav-style JRE bundle into the app's native library
   directory (Android will not execute binaries from ordinary storage).
2. `launch::spawn` builds a normal JVM command line; on Android it must instead
   be marshalled through a JNI entry point in a small native shim.
3. `java::detect` should also probe `$PREFIX/bin/java` for Termux users, which
   already works today via `PATH` on rooted/dev setups.

Until that lands, the Android build is a fully working launcher UI + download
and instance manager, and it reports the missing runtime with a clear message
rather than pretending.

## iOS — UI runs, Java cannot

```bash
# prerequisites: macOS, Xcode 15+, CocoaPods, an Apple developer team
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build
```

iOS forbids JIT compilation for third-party apps outside of specific
entitlements, and there is no JVM for iOS. Java Edition therefore cannot run on
stock iOS, period. The iOS target is useful as:

- a companion app (browse instances, manage accounts, read the console),
- a foundation if you self-sign a build with JIT entitlements on a jailbroken or
  MDM-managed device.

The UI detects the platform and disables launch affordances with an explanatory
message instead of failing at spawn time.

## Runtime matrix

| Feature | Windows | macOS | Linux | Android | iOS |
|---|---|---|---|---|---|
| Sign in (device code) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Browse versions / loaders | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download & verify game files | ✅ | ✅ | ✅ | ✅ | ✅ |
| Instance management | ✅ | ✅ | ✅ | ✅ | ✅ |
| Launch Minecraft | ✅ | ✅ | ✅ | needs bundled JRE (see above) | not possible |
| Managed Java downloads | ✅ | ✅ | ✅ | — | — |

## Environment variables

| Variable | Purpose |
|---|---|
| `INFINITY_DATA_DIR` | Override the data folder (handy for portable installs and tests). |
| `INFINITY_MS_CLIENT_ID` | Azure application (client) ID used for Microsoft sign-in. See [AUTH.md](AUTH.md). |
| `TAURI_DEV_HOST` | Set by `tauri android dev` / `tauri ios dev` so the device can reach the Vite server. |
