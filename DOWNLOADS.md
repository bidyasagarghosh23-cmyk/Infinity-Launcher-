# Infinity Client — native downloads

Built from commit `8ea4a651bdb5d0ee71e6c281e57ad584ef76bd44`.

Release page: <https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/tag/v2.0.0>

| Platform | File | Size | Download |
|---|---|---:|---|
| Android 8+ (ARM64 / x86_64) | `infinity-client-2.0.apk` | 86.3 MB | [APK](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v2.0.0/infinity-client-2.0.apk) |
| Windows 10/11 x64 | `infinity-client-2.0-windows-x64-setup.exe` | 2.7 MB | [Installer](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v2.0.0/infinity-client-2.0-windows-x64-setup.exe) |
| Windows 10/11 x64 | `infinity-client-2.0-windows-x64.exe` | 6.3 MB | [Standalone EXE](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v2.0.0/infinity-client-2.0-windows-x64.exe) |

## What is new in this preview

- Lunar-inspired client hub theme and navigation.
- Discover browser for mods, resource packs, shaders, worlds, data packs and modpack archives.
- Modrinth catalog support; CurseForge support requires an owner-supplied `CURSEFORGE_API_KEY`.
- Per-instance content manager with enable/disable/remove.
- Local appearance studio for skins, capes, wings and aura profiles.
- Performance presets that update an instance’s `options.txt`.
- Amethyst engine status/roadmap and engine comparison docs.

## Install

- **Windows:** run the installer. The standalone EXE needs Microsoft Edge WebView2 Runtime already installed. These builds are unsigned, so Windows SmartScreen may warn about an unknown publisher.
- **Android:** open the APK and allow installation from that source when prompted. This is a debug-signed sideload preview, not a Play Store release. A future preview may use a different signing key and require uninstall/reinstall.

## Important limitations

- The **Android APK is still a client hub/content manager**, not a working Android Java gameplay build. Amethyst is the selected engine target, but no Android JVM/rendering bridge is bundled or device-tested yet. Android Play remains disabled.
- Offline skins/capes/cosmetics are **local-only previews**. They are not injected into Minecraft or visible to servers.
- Modpacks are currently saved as archives; full modpack resolution/import is future work.
- Microsoft sign-in requires an owner-configured Azure application client ID (`INFINITY_MS_CLIENT_ID`). Offline profiles are available without it.
- These packages were build-tested and the APK signature was verified, but they have not been tested here on a physical Android device or Windows PC.

## Verify and rebuild

- [SHA256SUMS.txt](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v2.0.0/SHA256SUMS.txt)
- [INSTALL.md](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v2.0.0/INSTALL.md)
- [Successful package build run](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/actions/runs/40863411581)
- Packaging instructions: [docs/PACKAGING.md](docs/PACKAGING.md)
- Engine comparison: [docs/ENGINE_COMPARISON.md](docs/ENGINE_COMPARISON.md)
