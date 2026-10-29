# Bundled resources

Files placed here are shipped inside the application bundle
(`bundle.resources` in `tauri.conf.json`).

Nothing is required on desktop. This folder exists for things a mobile build
needs to carry with it, for example:

- `android/jre/` — a Pojav-style JVM bundle for the Android runtime
  (see `docs/PLATFORMS.md`)
- `assets/fonts/` — bundled fonts or shaders

Keep large binaries out of git if you can; publish them as release assets and
download them on first run instead (the installer already supports arbitrary
URLs — see `mojang::download`).
