# Infinity Launcher client-hub roadmap

This file is the honest feature matrix. “Implemented” means the code path exists
and is covered by UI/Rust checks where practical; it does not imply Android Java
gameplay works.

| Area | Status | Notes |
| --- | --- | --- |
| Lunar-inspired dark client theme | Implemented | Original Infinity branding; blue/cyan theme, no Lunar assets/code. |
| Modrinth browse/search | Implemented | Native Rust adapter; browser preview uses labeled demo fixtures. |
| CurseForge browse/search | Implemented, key required | Set `CURSEFORGE_API_KEY` in the native process. Never embedded in the APK/EXE. |
| Mods / resource packs / shaders / data packs install | Implemented | Checksum-verified downloads into per-instance folders. |
| Worlds install/list | Implemented | Safe zip extraction into `saves/`; lists folders with `level.dat`. |
| Modpacks browse/save archive | Partial | Archives are saved; full loader/override/dependency resolution is future work. |
| Enable/disable mods and packs | Implemented | Rename to `.disabled`; no destructive toggle. |
| Remove content | Implemented | Deletes file/folder and manifest record. |
| Offline skins/capes/cosmetics creator | Implemented, local-only | PNG upload, cape color/pattern, wings, aura, saved profiles. Not injected into Minecraft or visible to servers. |
| Performance presets | Implemented | Writes conservative vanilla `options.txt` values per instance. |
| Android renderer preference | Stored only | Saved for future Amethyst bridge; no effect until engine integration. |
| Amethyst engine pin/notices | Prepared | `engine/amethyst.lock.json`, `docs/AMETHYST_INTEGRATION.md`, `THIRD_PARTY_NOTICES.md`. |
| Android Java gameplay | Not enabled | Play remains disabled until runtime packaging + physical-device test pass. |
| SKlauncher 4.0 parity | Roadmap | Imports, friends, server browser, screenshot gallery, malware scanning, full modpack resolution and in-game cosmetics remain future stages. |

## Next stage: real Android gameplay

1. Build Amethyst native components at the pinned commit in CI.
2. Package JRE/LWJGL/renderer libraries and LGPL notices.
3. Add an Infinity → Amethyst launch bridge.
4. Device-test vanilla launch and world entry.
5. Only then flip engine flags and remove the Android launch guard.
