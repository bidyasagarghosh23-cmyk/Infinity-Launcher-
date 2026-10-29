# Android Java engine comparison

Decision status: **compare first, do not switch yet**. Infinity Launcher currently
pins **Amethyst** in `engine/amethyst.lock.json` and keeps Android Play disabled
until a real runtime is packaged and device-tested.

This comparison covers the open-source Android launchers requested:

- `AngelAuraMC/Amethyst-Android`
- `ZalithLauncher/ZalithLauncher2`
- `ZalithLauncher/ZalithLauncher` (original)
- `BOMBA-NA/MJLauncher` / other “MJ Launcher” candidates

## Summary

| Candidate | Maintenance | License | Fit with Infinity | Recommendation |
| --- | --- | --- | --- | --- |
| **Amethyst** | Active; selected Pojav successor | LGPL-3.0 | Best license fit for a Tauri/Rust hub that links or bridges to an Android engine | **Keep as current target** |
| **ZalithLauncher2** | Active; modern Compose rewrite | GPL-3.0 plus additional naming/unofficial-modified-version terms | Technically strong, but stronger copyleft and branding obligations if embedded/forked | Consider only if you accept GPL/rebranding obligations |
| **ZalithLauncher original** | Archived; README points to ZalithLauncher2 | GPL-family | Do not start new integration on an archived base | Reject |
| **MJLauncher candidates** | Unclear/fragmented; some repos lack README/license | Unclear | Cannot safely bundle without clear license and maintenance | Reject for now |

## Amethyst

- Upstream: https://github.com/AngelAuraMC/Amethyst-Android
- Default branch: `v3_openjdk`
- Pinned commit: `28d6e12d68121b7dd75f2e841058a6b7cdfe4a29`
- License: **LGPL-3.0**
- Latest observed release: `1.1.7` (2026-07-31)
- Repo observed active: pushed 2026-10-26
- It is the maintained successor in the PojavLauncher family.
- Existing Infinity integration docs already target its Pojav-style launch core,
  JRE/LWJGL/renderer packaging and Android activity/service boundary.

### Why it fits Infinity

Infinity’s hub is MIT-licensed Tauri/Rust + React. LGPL is generally easier to
combine with a separate hub than GPL, provided we satisfy LGPL notice/source and
relinking obligations. It still requires careful compliance, but it does not
automatically impose GPL-style naming/unofficial-modified-version terms.

### Costs

- Still not a drop-in library: we must package JRE/LWJGL/renderers and build a
  launch bridge.
- Must ship LGPL notices and corresponding source/source offer.
- Must device-test before enabling Play.

## ZalithLauncher2

- Upstream: https://github.com/ZalithLauncher/ZalithLauncher2
- Default branch: `main`
- Latest observed release: `2.7.2` (2026-10-20)
- Repo observed active: pushed 2026-10-29
- License: **GPL-3.0** with additional terms under GPLv3 section 7.
- README says it is a newly designed Android launcher using PojavLauncher’s JNI
  launching core, Jetpack Compose and Material Design 3.
- Observed build facts: minSdk 26, targetSdk 34 in Gradle, compileSdk 37,
  NDK `25.2.9519653`, applicationId `com.movtery.zalithlauncher.v2`.

### Additional terms that matter

If we distribute a modified version, upstream requires:

1. Reasonably change the program name/version to distinguish it.
2. Modified versions must **not** include “ZalithLauncher” or “ZL” in the name,
   nor use confusingly similar names.
3. Modified versions must clearly say **“Unofficial Modified Version”** on the
   startup screen or main interface.
4. Do not remove displayed copyright notices.

### Why it is attractive

- Modern Android UI and active development.
- Pojav-family launch core, so it is technically relevant to Android Java gameplay.
- Release APKs are already large, feature-rich launcher builds.

### Why it is not the default switch

- GPL-3.0 is stronger copyleft than Amethyst’s LGPL. Embedding/forking it into
  Infinity’s Android app could require the combined Android work to be distributed
  under GPL-compatible terms.
- The extra naming/unofficial-label terms create product/branding obligations.
- It is a full Compose launcher, not a small embeddable engine SDK. Switching
  would likely mean a larger Android-native rewrite or a separate engine app plus
  IPC/intent bridge.

## MJLauncher / “MJ Launcher”

Search results include `BOMBA-NA/MJLauncher` and several forks/derivatives. The
candidate inspected had unclear licensing/README availability and fragmented
maintenance. Without a clear license, we cannot safely copy/bundle its code.

**Decision:** do not use MJLauncher code unless a specific repository is provided
with a clear open-source license and maintained launch core.

## Recommendation

Keep **Amethyst** as the current Android engine target because:

1. It is the maintained Pojav successor.
2. LGPL-3.0 is a better fit for Infinity’s MIT/Tauri hub than GPL plus extra terms.
3. We already pinned it and documented the integration boundary.
4. Switching to ZalithLauncher2 is possible, but should be an explicit decision
   after accepting GPL/rebranding/unofficial-modified-version obligations.

If you choose ZalithLauncher2 later, the safe path is:

- Pin a specific ZalithLauncher2 commit.
- Add GPL-3.0 + additional-terms notices.
- Rename the Android engine/product surface so it does not use ZalithLauncher/ZL.
- Show “Unofficial Modified Version” prominently.
- Keep Play disabled until physical-device gameplay tests pass.
