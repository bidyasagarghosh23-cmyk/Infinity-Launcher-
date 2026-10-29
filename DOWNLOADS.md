# Infinity Launcher — native downloads

Built from commit `79d58402692b68a246355686f8bef21dbdc007a0`.

Release page: <https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/tag/v1.0.0-preview.40854813024>

| Platform | File | Size | Download |
|---|---|---:|---|
| Android 8+ (ARM64 / x86_64) | `Infinity-Launcher-1.0.0-android-preview.apk` | 84.1 MB | [APK](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v1.0.0-preview.40854813024/Infinity-Launcher-1.0.0-android-preview.apk) |
| Windows 10/11 x64 | `Infinity-Launcher-1.0.0-windows-x64-setup.exe` | 2.6 MB | [Installer](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v1.0.0-preview.40854813024/Infinity-Launcher-1.0.0-windows-x64-setup.exe) |
| Windows 10/11 x64 | `Infinity-Launcher-1.0.0-windows-x64.exe` | 6.1 MB | [Standalone EXE](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v1.0.0-preview.40854813024/Infinity-Launcher-1.0.0-windows-x64.exe) |

## Install

- **Windows:** run the installer. The standalone EXE needs Microsoft Edge WebView2 Runtime already installed. These builds are unsigned, so Windows SmartScreen may warn about an unknown publisher.
- **Android:** open the APK and allow installation from that source when prompted. This is a debug-signed sideload preview, not a Play Store release. A future preview may use a different signing key and require uninstall/reinstall.

## Important limitations

- The **Android APK manages instances and downloads only**. It cannot play Minecraft: Java Edition because no Android JVM/rendering bridge is bundled. Use the Windows version to play.
- Microsoft sign-in requires an owner-configured Azure application client ID (`INFINITY_MS_CLIENT_ID`). Offline profiles are available without it.
- These packages were build-tested and the APK signature was verified, but they have not been tested here on a physical Android device or Windows PC.

## Verify and rebuild

- [SHA256SUMS.txt](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v1.0.0-preview.40854813024/SHA256SUMS.txt)
- [INSTALL.md](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/releases/download/v1.0.0-preview.40854813024/INSTALL.md)
- [Successful build run](https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-/actions/runs/40854813024)
- Packaging instructions: [docs/PACKAGING.md](docs/PACKAGING.md)
