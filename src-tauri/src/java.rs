//! Java runtime discovery and (desktop) automatic provisioning.
//!
//! Android and iOS cannot ship a desktop JVM, so on those targets this module
//! only *detects* runtimes (Android 13+ can expose one through the system) and
//! reports [`Error::NoJava`] otherwise. See `docs/PLATFORMS.md`.

use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{Context, Error, Result};
use crate::model::JavaRuntime;
use crate::paths::Paths;

pub const ADOPTIUM_API: &str =
    "https://api.adoptium.net/v3/assets/latest";

/// Scan the well-known install locations plus PATH for usable JVMs.
pub fn detect() -> Vec<JavaRuntime> {
    let mut found: Vec<JavaRuntime> = Vec::new();
    let mut candidates: Vec<(PathBuf, bool)> = Vec::new();

    for home in home_candidates() {
        candidates.push((home, true));
    }
    for root in search_roots() {
        collect_from_root(&root, &mut candidates);
    }
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let exe = dir.join(exe_name("java"));
            if exe.is_file() {
                candidates.push((exe, false));
            }
        }
    }

    for (path, is_home) in candidates {
        let executable = if is_home { java_in_home(&path) } else { Some(path) };
        let Some(executable) = executable else { continue };
        if found.iter().any(|j| j.path == executable.to_string_lossy()) {
            continue;
        }
        if let Some(info) = probe(&executable) {
            found.push(info);
        }
    }

    // Newest first — most players want the newest runtime for the newest game.
    found.sort_by(|a, b| b.major.cmp(&a.major));
    found
}

fn exe_name(base: &str) -> String {
    if cfg!(windows) {
        format!("{base}.exe")
    } else {
        base.to_string()
    }
}

fn java_in_home(home: &Path) -> Option<PathBuf> {
    let candidates = [
        home.join("bin").join(exe_name("java")),
        home.join("Contents").join("Home").join("bin").join(exe_name("java")),
        home.join("jre").join("bin").join(exe_name("java")),
    ];
    candidates.into_iter().find(|p| p.is_file())
}

fn home_from_java(java: &Path) -> Option<PathBuf> {
    // <home>/bin/java[.exe] or <home>/Contents/Home/bin/java
    let bin = java.parent()?;
    if bin.file_name()? != "bin" {
        return None;
    }
    let home = bin.parent()?;
    if home.file_name().map(|n| n == "Home").unwrap_or(false) {
        return home.parent()?.parent().map(|p| p.to_path_buf());
    }
    Some(home.to_path_buf())
}

pub fn home_candidates() -> Vec<PathBuf> {
    let mut homes: Vec<PathBuf> = Vec::new();
    if let Some(explicit) = std::env::var_os("JAVA_HOME") {
        homes.push(PathBuf::from(explicit));
    }
    if cfg!(target_os = "macos") || cfg!(target_os = "ios") {
        homes.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
        if let Some(home) = dirs::home_dir() {
            homes.push(home.join("Library/Java/JavaVirtualMachines"));
            homes.push(home.join(".sdkman/candidates/java"));
        }
        // `/usr/libexec/java_home` is the authoritative answer on macOS.
        if let Ok(out) = Command::new("/usr/libexec/java_home").arg("-V").output() {
            for line in String::from_utf8_lossy(&out.stderr).lines() {
                if let Some(start) = line.find('/') {
                    let path = line[start..].trim();
                    if !path.is_empty() {
                        homes.push(PathBuf::from(path));
                    }
                }
            }
        }
    }
    if cfg!(target_os = "windows") {
        for base in [
            r"C:\Program Files\Java",
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files\Microsoft",
            r"C:\Program Files\Zulu",
            r"C:\Program Files\BellSoft",
            r"C:\Program Files\Amazon Corretto",
        ] {
            homes.push(PathBuf::from(base));
        }
        if let Some(local) = dirs::data_local_dir() {
            homes.push(local.join("Programs").join("Eclipse Adoptium"));
        }
    }
    if cfg!(any(target_os = "linux", target_os = "android")) {
        for base in ["/usr/lib/jvm", "/usr/java", "/opt/java", "/opt/jdk"] {
            homes.push(PathBuf::from(base));
        }
        if let Some(home) = dirs::home_dir() {
            homes.push(home.join(".sdkman/candidates/java"));
            homes.push(home.join(".jdks"));
        }
    }
    homes
}

fn search_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if cfg!(target_os = "macos") || cfg!(target_os = "ios") {
        roots.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
    }
    if cfg!(target_os = "windows") {
        roots.push(PathBuf::from(r"C:\Program Files\Java"));
        roots.push(PathBuf::from(r"C:\Program Files\Eclipse Adoptium"));
        roots.push(PathBuf::from(r"C:\Program Files\Microsoft"));
        roots.push(PathBuf::from(r"C:\Program Files\Zulu"));
    }
    if cfg!(any(target_os = "linux", target_os = "android")) {
        roots.push(PathBuf::from("/usr/lib/jvm"));
    }
    roots
}

/// One level deep scan: `/usr/lib/jvm/temurin-17-jdk` -> that folder's java.
fn collect_from_root(root: &Path, out: &mut Vec<(PathBuf, bool)>) {
    if !root.is_dir() {
        return;
    }
    if java_in_home(root).is_some() {
        out.push((root.to_path_buf(), true));
        return;
    }
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && java_in_home(&path).is_some() {
            out.push((path, true));
        }
    }
}

fn probe(java: &Path) -> Option<JavaRuntime> {
    let output = Command::new(java).arg("-XshowSettings:properties").arg("-version").output().ok()?;
    let mut text = String::from_utf8_lossy(&output.stdout).to_string();
    text.push_str(&String::from_utf8_lossy(&output.stderr));

    let mut version = String::new();
    let mut vendor = String::new();
    let mut arch = String::new();
    for line in text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("java.version = ") {
            version = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("java.vendor = ") {
            vendor = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("os.arch = ") {
            arch = rest.trim().to_string();
        }
    }
    if version.is_empty() {
        // Fall back to the first line of `java -version` output.
        if let Some(first) = text.lines().next() {
            if let Some(quoted) = first.split('"').nth(1) {
                version = quoted.to_string();
            }
        }
    }
    if version.is_empty() {
        return None;
    }
    Some(JavaRuntime {
        path: java.to_string_lossy().to_string(),
        major: major_version(&version),
        version,
        vendor: if vendor.is_empty() { "Unknown".to_string() } else { vendor },
        arch: if arch.is_empty() { std::env::consts::ARCH.to_string() } else { arch },
        managed: false,
    })
}

/// `17.0.8` -> 17, `1.8.0_392` -> 8, `21-ea` -> 21.
pub fn major_version(version: &str) -> u32 {
    let cleaned = version.trim_start_matches("1.");
    cleaned
        .split(|c: char| !c.is_ascii_digit())
        .find(|part| !part.is_empty())
        .and_then(|part| part.parse::<u32>().ok())
        .unwrap_or(0)
}

/// Runtimes already provisioned by the launcher itself.
pub fn managed(paths: &Paths) -> Vec<JavaRuntime> {
    let root = paths.runtime();
    let Ok(entries) = std::fs::read_dir(&root) else {
        return Vec::new();
    };
    let mut runtimes = Vec::new();
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        if let Some(java) = java_in_home(&dir) {
            if let Some(mut info) = probe(&java) {
                info.managed = true;
                runtimes.push(info);
            }
        }
    }
    runtimes
}

pub fn all(paths: &Paths) -> Vec<JavaRuntime> {
    let mut runtimes = managed(paths);
    for runtime in detect() {
        if !runtimes.iter().any(|r| r.path == runtime.path) {
            runtimes.push(runtime);
        }
    }
    runtimes.sort_by(|a, b| b.major.cmp(&a.major));
    runtimes
}

/// Picks the best runtime for a required major version.
pub fn pick<'a>(runtimes: &'a [JavaRuntime], required: u32) -> Option<&'a JavaRuntime> {
    runtimes
        .iter()
        .filter(|r| r.major >= required)
        .min_by_key(|r| r.major) // smallest runtime that satisfies the game
        .or_else(|| runtimes.iter().max_by_key(|r| r.major))
}

/// Resolves the runtimes directory for a managed install of `major`.
fn managed_dir(paths: &Paths, major: u32) -> PathBuf {
    paths.runtime().join(format!("jre-{major}"))
}

/// Downloads and unpacks a Temurin JRE into the launcher's own runtime folder.
/// Desktop only — mobile targets have no JVM to install.
pub async fn provision(
    client: &reqwest::Client,
    paths: &Paths,
    major: u32,
    on_progress: impl Fn(u64, u64) + Send + Sync,
) -> Result<JavaRuntime> {
    if cfg!(any(target_os = "android", target_os = "ios")) {
        return Err(Error::Message(
            "Mobile targets cannot run a desktop JVM — see docs/PLATFORMS.md".into(),
        ));
    }
    let (os, arch) = adoptium_platform();
    let url = format!(
        "{ADOPTIUM_API}/{major}/hotspot?architecture={arch}&image_type=jre&os={os}&vendor=eclipse",
    );
    let listing: serde_json::Value = client.get(&url).send().await?.error_for_status()?.json().await?;
    let binary = listing
        .get(0)
        .and_then(|v| v.get("binary"))
        .ok_or_else(|| Error::Message(format!("no Temurin {major} build for {os}/{arch}")))?;
    let link = binary
        .get("package")
        .and_then(|p| p.get("link"))
        .and_then(|l| l.as_str())
        .ok_or_else(|| Error::Message("Adoptium returned no download link".into()))?;
    let checksum = binary
        .get("package")
        .and_then(|p| p.get("checksum"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    let archive = paths.runtime().join(format!("jre-{major}.download"));
    crate::mojang::download_forced(client, link, &archive, checksum.as_deref()).await?;
    on_progress(1, 1);

    let dest = managed_dir(paths, major);
    if dest.exists() {
        std::fs::remove_dir_all(&dest).ok();
    }
    std::fs::create_dir_all(&dest)?;
    unpack(&archive, &dest)?;
    std::fs::remove_file(&archive).ok();

    // Archives ship a single top-level folder (or `Contents/Home` on macOS).
    let mut candidates: Vec<PathBuf> = Vec::new();
    if java_in_home(&dest).is_some() {
        candidates.push(dest.clone());
    }
    if let Ok(entries) = std::fs::read_dir(&dest) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                candidates.push(path);
            }
        }
    }
    for candidate in candidates {
        if let Some(java) = java_in_home(&candidate) {
            if let Some(mut info) = probe(&java) {
                info.managed = true;
                return Ok(info);
            }
        }
    }
    Err(Error::Message(format!(
        "Temurin {major} unpacked but no java executable was found in {}",
        dest.display()
    )))
}

fn adoptium_platform() -> (&'static str, &'static str) {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "arm") {
        "arm"
    } else if cfg!(target_arch = "x86") {
        "x86"
    } else {
        "x64"
    };
    (os, arch)
}

fn unpack(archive: &Path, dest: &Path) -> Result<()> {
    let name = archive.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
    if name.ends_with(".zip") {
        let file = std::fs::File::open(archive)?;
        let mut zip = zip::ZipArchive::new(file)
            .map_err(|err| Error::Message(format!("bad JRE archive: {err}")))?;
        zip.extract(dest)
            .map_err(|err| Error::Message(format!("could not unpack JRE: {err}")))?;
        return Ok(());
    }
    if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        let status = Command::new("tar")
            .arg("-xzf")
            .arg(archive)
            .arg("-C")
            .arg(dest)
            .status()
            .context("running tar to unpack the JRE")?;
        if !status.success() {
            return Err(Error::Message("tar failed while unpacking the JRE".into()));
        }
        return Ok(());
    }
    Err(Error::Message(format!("unsupported JRE archive: {}", archive.display())))
}

/// Best-effort guess at the runtime a version needs before its JSON is read.
/// The version JSON's `javaVersion.majorVersion` always wins at launch time.
pub fn required_for(mc_version: &str) -> u32 {
    let mut parts = mc_version.split('.');
    if parts.next() != Some("1") {
        // Snapshots (`24w14a`) and anything else unconventional target the
        // modern toolchain.
        return 21;
    }
    let minor: u32 = parts
        .next()
        .and_then(|p| p.split(|c: char| !c.is_ascii_digit()).next())
        .and_then(|p| p.parse().ok())
        .unwrap_or(21);
    let patch: u32 = parts
        .next()
        .and_then(|p| p.split(|c: char| !c.is_ascii_digit()).next())
        .and_then(|p| p.parse().ok())
        .unwrap_or(0);
    match minor {
        0..=16 => 8,
        17..=19 => 17,
        20 => {
            if patch >= 5 {
                21
            } else {
                17
            }
        }
        _ => 21,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_java_versions() {
        assert_eq!(major_version("1.8.0_392"), 8);
        assert_eq!(major_version("17.0.8"), 17);
        assert_eq!(major_version("21-ea"), 21);
        assert_eq!(major_version("garbage"), 0);
    }

    #[test]
    fn maps_minecraft_versions_to_java() {
        assert_eq!(required_for("1.7.10"), 8);
        assert_eq!(required_for("1.8.9"), 8);
        assert_eq!(required_for("1.16.5"), 8);
        assert_eq!(required_for("1.17.1"), 17);
        assert_eq!(required_for("1.19.4"), 17);
        assert_eq!(required_for("1.20.1"), 17);
        assert_eq!(required_for("1.20.4"), 17);
        assert_eq!(required_for("1.20.6"), 21);
        assert_eq!(required_for("1.21.4"), 21);
        assert_eq!(required_for("24w14a"), 21);
    }
}
