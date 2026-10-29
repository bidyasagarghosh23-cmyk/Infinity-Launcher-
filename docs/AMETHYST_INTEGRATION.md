# Amethyst Android engine integration

Status: **pinned, not integrated**. See also [ENGINE_COMPARISON.md](ENGINE_COMPARISON.md). The current APK is still a management/content
preview. Android Play is intentionally disabled.

## Selected upstream

- Repository: https://github.com/AngelAuraMC/Amethyst-Android
- Branch: `v3_openjdk`
- Pinned commit: `28d6e12d68121b7dd75f2e841058a6b7cdfe4a29`
- License: LGPL-3.0
- Lock file: `engine/amethyst.lock.json`

Legacy `PojavLauncherTeam/PojavLauncher` is discontinued; Amethyst is the
maintained successor selected for this project.

## Integration boundary

Infinity keeps its own Tauri hub, instance store, catalog adapters and content
manager. The Android engine boundary is `src-tauri/src/engine.rs`, which reports
`integrated=false`, `runtime_ready=false`, `gameplay_verified=false` until a real
runtime is packaged and tested.

Do not remove the Android launch guard or claim Java gameplay works before:

1. Amethyst source is fetched at the pinned revision in CI.
2. JRE 8/17/21, LWJGL3/GLFW and renderer native libraries are packaged for
   `aarch64` and `x86_64` with correct Android permissions.
3. Infinity instance metadata is translated into Amethyst launch arguments
   (game dir, version JSON, classpath, natives, assets, account, memory, renderer).
4. LGPL-3.0 notices, source offer and upstream attributions ship with the APK.
5. A physical-device smoke test launches vanilla Minecraft and reaches a world.

## Known upstream build facts

- Application ID: `org.angelauramc.amethyst` (debug suffix `.debug`)
- Namespace: `net.kdt.pojavlaunch`
- Gradle task: `:app_pojavlauncher:assembleDebug`
- NDK: `27.3.13750724`; ndkBuild JNI under `src/main/jni/Android.mk`
- Submodules include MobileGlues, SDL, sdl2-compat, MioLibPatcher and
  `androidnsbypass`; the last uses an SSH URL and needs an HTTPS rewrite in CI.
- CurseForge key is read from `CURSEFORGE_API_KEY` / `curseforge_key.txt`;
  Infinity keeps its own key in the native process and never embeds it.

## Next concrete steps

1. Add a CI job that clones Amethyst at the lock-file commit and builds its
   native components without publishing them as Infinity gameplay.
2. Add an Android `AmethystBridge` Kotlin/JNI boundary that accepts an Infinity
   launch request and starts the Amethyst game activity/service.
3. Package JRE/LWJGL/renderer artifacts with license notices.
4. Run device tests, then flip `engine_status` flags and remove the launch guard.
