//! Everything that talks to Mojang's public metadata: the version manifest,
//! version JSONs, library/asset descriptors and the CDN downloader.

use futures_util::StreamExt;
use serde::Deserialize;
use sha1::{Digest, Sha1};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;

use crate::error::{Context, Error, Result};
use crate::model::{LatestVersions, VersionManifest, VersionSummary};
use crate::paths::Paths;
use crate::rules::{self, Features, Rule};

pub const VERSION_MANIFEST: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
pub const RESOURCES: &str = "https://resources.download.minecraft.net";
pub const LIBRARIES: &str = "https://libraries.minecraft.net";
pub const FABRIC_META: &str = "https://meta.fabricmc.net/v2";
pub const QUILT_META: &str = "https://meta.quiltmc.org/v3";
pub const FORGE_MAVEN: &str = "https://maven.minecraftforge.net";
pub const NEOFORGE_MAVEN: &str = "https://maven.neoforged.net/releases";

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct RawManifest {
    latest: LatestVersions,
    versions: Vec<VersionSummary>,
}

pub async fn fetch_manifest(client: &reqwest::Client) -> Result<VersionManifest> {
    let raw: RawManifest = client
        .get(VERSION_MANIFEST)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(VersionManifest {
        latest: raw.latest,
        versions: raw.versions,
    })
}

// ---------------------------------------------------------------------------
// Version JSON
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDownload {
    pub url: String,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub sha1: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub natives: Option<BTreeMap<String, String>>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub url: Option<String>,
    /// Legacy `maven` layout hints ("Maven" / "Forgelin") — ignored.
    #[serde(default)]
    pub extract: Option<Extract>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Extract {
    #[serde(default)]
    pub exclude: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryDownloads {
    #[serde(default)]
    pub artifact: Option<FileDownload>,
    #[serde(default)]
    pub classifiers: Option<BTreeMap<String, FileDownload>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndexRef {
    pub id: String,
    pub url: String,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub total_size: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionDownloads {
    #[serde(default)]
    pub client: Option<FileDownload>,
    #[serde(default)]
    pub server: Option<FileDownload>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    #[serde(default)]
    pub component: Option<String>,
    #[serde(default)]
    pub major_version: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggingFile {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub argument: Option<String>,
    #[serde(default)]
    pub file: Option<FileDownload>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionJson {
    pub id: String,
    #[serde(default)]
    pub client_version: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub main_class: Option<String>,
    #[serde(default)]
    pub inherits_from: Option<String>,
    #[serde(default)]
    pub minecraft_arguments: Option<String>,
    #[serde(default)]
    pub arguments: Option<Arguments>,
    #[serde(default)]
    pub libraries: Option<Vec<Library>>,
    #[serde(default)]
    pub asset_index: Option<AssetIndexRef>,
    #[serde(default)]
    pub assets: Option<String>,
    #[serde(default)]
    pub downloads: Option<VersionDownloads>,
    #[serde(default)]
    pub java_version: Option<JavaVersion>,
    #[serde(default)]
    pub logging: Option<BTreeMap<String, LoggingFile>>,
    #[serde(default)]
    pub compliance_level: Option<u32>,
}

/// A version JSON with every `inheritsFrom` parent folded in, ready to launch.
#[derive(Debug, Clone)]
pub struct ResolvedVersion {
    pub id: String,
    pub kind: String,
    pub main_class: String,
    pub libraries: Vec<Library>,
    pub arguments: Arguments,
    pub minecraft_arguments: Option<String>,
    pub asset_index: Option<AssetIndexRef>,
    pub assets: Option<String>,
    pub client: Option<FileDownload>,
    /// Required Java feature release, when the version JSON declares one.
    pub java_major: Option<u32>,
    pub logging_argument: Option<String>,
    /// `log_configs/<id>` payload referenced by `logging_argument`.
    pub logging_file: Option<FileDownload>,
    pub logging_url: Option<String>,
    /// The version id that owns the client jar (parents may provide it).
    pub jar_id: String,
}

pub fn read_version_json(paths: &Paths, id: &str) -> Result<VersionJson> {
    let path = paths.version_json(id);
    let bytes = std::fs::read(&path)
        .context(format!("missing metadata for version {id} — install it first"))?;
    serde_json::from_slice(&bytes).context(format!("corrupt version json {id}"))
}

/// Walks `inheritsFrom` upward, then merges downward so children win.
pub fn resolve_version(paths: &Paths, id: &str) -> Result<ResolvedVersion> {
    let mut chain: Vec<VersionJson> = Vec::new();
    let mut current = id.to_string();
    loop {
        if chain.len() > 16 {
            return Err(Error::Message(format!("version {id} inherits in a loop")));
        }
        let json = read_version_json(paths, &current)?;
        let parent = json.inherits_from.clone();
        chain.push(json);
        match parent {
            Some(parent) if !parent.is_empty() => current = parent,
            _ => break,
        }
    }

    // The chain is [child, ..., root]; fold from the root downwards so that
    // every field the child omits is inherited from its parent.
    let mut merged: Option<ResolvedVersion> = None;
    for json in chain.iter().rev() {
        merged = Some(merge_version(merged, json));
    }
    merged.ok_or_else(|| Error::Message(format!("could not resolve version {id}")))
}

fn merge_version(parent: Option<ResolvedVersion>, child: &VersionJson) -> ResolvedVersion {
    let mut libraries: Vec<Library> = parent
        .as_ref()
        .map(|p| p.libraries.clone())
        .unwrap_or_default();
    let mut arguments = parent
        .as_ref()
        .map(|p| p.arguments.clone())
        .unwrap_or_default();

    // A child re-declaring a library (same `group:artifact:version[:classifier]`)
    // replaces the parent entry; anything new is appended.
    for lib in child.libraries.clone().unwrap_or_default() {
        if let Some(slot) = libraries.iter_mut().find(|existing| existing.name == lib.name) {
            *slot = lib;
        } else {
            libraries.push(lib);
        }
    }
    if let Some(extra) = &child.arguments {
        arguments.game.extend(extra.game.iter().cloned());
        arguments.jvm.extend(extra.jvm.iter().cloned());
    }

    let parent_kind = parent.as_ref().map(|p| p.kind.clone());
    let parent_main = parent.as_ref().map(|p| p.main_class.clone());
    let parent_java = parent.as_ref().and_then(|p| p.java_major);
    let parent_logging = parent.as_ref().and_then(|p| p.logging_argument.clone());
    let parent_logging_file = parent.as_ref().and_then(|p| p.logging_file.clone());
    let parent_logging_url = parent.as_ref().and_then(|p| p.logging_url.clone());
    let parent_asset_index = parent.as_ref().and_then(|p| p.asset_index.clone());
    let parent_assets = parent.as_ref().and_then(|p| p.assets.clone());
    let parent_client = parent.as_ref().and_then(|p| p.client.clone());
    let parent_jar = parent.as_ref().map(|p| p.jar_id.clone());
    let parent_mca = parent.as_ref().and_then(|p| p.minecraft_arguments.clone());

    ResolvedVersion {
        id: child.id.clone(),
        kind: child
            .kind
            .clone()
            .or(parent_kind)
            .unwrap_or_else(|| "release".to_string()),
        main_class: child
            .main_class
            .clone()
            .or(parent_main)
            // Pre-1.6 version JSONs have no mainClass at all.
            .unwrap_or_else(|| "net.minecraft.client.main.Main".to_string()),
        libraries,
        arguments,
        minecraft_arguments: child.minecraft_arguments.clone().or(parent_mca),
        asset_index: child.asset_index.clone().or(parent_asset_index),
        assets: child.assets.clone().or(parent_assets),
        client: child
            .downloads
            .as_ref()
            .and_then(|d| d.client.clone())
            .or(parent_client),
        java_major: child
            .java_version
            .as_ref()
            .map(|j| j.major_version)
            .or(parent_java),
        logging_argument: child
            .logging
            .as_ref()
            .and_then(|m| m.get("client"))
            .and_then(|l| l.argument.clone())
            .or(parent_logging),
        logging_file: child
            .logging
            .as_ref()
            .and_then(|m| m.get("client"))
            .and_then(|l| l.file.clone())
            .or(parent_logging_file),
        logging_url: child
            .logging
            .as_ref()
            .and_then(|m| m.get("client"))
            .and_then(|l| l.url.clone())
            .or(parent_logging_url),
        jar_id: child.client_version.clone().or(parent_jar).unwrap_or_else(|| child.id.clone()),
    }
}

impl ResolvedVersion {
    /// Java release required by this version (1.17+ needs 17, 1.20.5+ needs 21).
    pub fn required_java(&self) -> u32 {
        self.java_major.unwrap_or(8)
    }
}

/// `group:artifact:version[:classifier]` -> relative maven path.
pub fn maven_path(name: &str) -> Option<PathBuf> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let (group, artifact, version) = (parts[0], parts[1], parts[2]);
    let classifier = parts.get(3).copied();
    let file = match classifier {
        Some(c) => format!("{artifact}-{version}-{c}.jar"),
        None => format!("{artifact}-{version}.jar"),
    };
    let mut path = PathBuf::new();
    for segment in group.split('.') {
        path.push(segment);
    }
    path.push(artifact);
    path.push(version);
    path.push(file);
    Some(path)
}

/// Libraries that apply to this machine, natives included.
pub fn applicable_libraries(version: &ResolvedVersion, features: &Features) -> Vec<Library> {
    version
        .libraries
        .iter()
        .filter(|lib| rules::allows(&lib.rules, features))
        .cloned()
        .collect()
}

/// Classifier for the current platform, e.g. `natives-windows-64`.
pub fn native_classifier(lib: &Library) -> Option<String> {
    let natives = lib.natives.as_ref()?;
    let template = natives.get(rules::os_name())?;
    let mut classifier = template.replace("${arch}", if rules::is_64_bit() { "64" } else { "32" });
    if classifier.is_empty() {
        return None;
    }
    // Legacy naming used `natives-windows-32/64`; newer always ships 64-bit.
    if !classifier.contains("64") && !classifier.contains("32") && rules::is_64_bit() {
        classifier = format!("{classifier}-64");
    }
    Some(classifier)
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/// Downloads `url` to `dest`, verifying SHA-1 when known. Existing files that
/// already match are skipped, which makes re-running an install cheap.
pub async fn download(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    expected_sha1: Option<&str>,
) -> Result<()> {
    if dest.exists() {
        match expected_sha1 {
            Some(expected) => {
                let actual = sha1_file(dest)?;
                if actual.eq_ignore_ascii_case(expected) {
                    return Ok(());
                }
            }
            None => {
                if std::fs::metadata(dest).map(|m| m.len() > 0).unwrap_or(false) {
                    return Ok(());
                }
            }
        }
    }
    download_forced(client, url, dest, expected_sha1).await
}

pub async fn download_forced(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    expected_sha1: Option<&str>,
) -> Result<()> {
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context(format!("creating {}", parent.display()))?;
    }
    let tmp = dest.with_extension("part");
    let mut last_error = None;

    for attempt in 0..3u32 {
        let response = client.get(url).send().await;
        let response = match response {
            Ok(r) => match r.error_for_status() {
                Ok(r) => r,
                Err(err) => {
                    last_error = Some(Error::Http(err));
                    tokio::time::sleep(std::time::Duration::from_millis(300 * (attempt as u64 + 1)))
                        .await;
                    continue;
                }
            },
            Err(err) => {
                last_error = Some(Error::Http(err));
                tokio::time::sleep(std::time::Duration::from_millis(300 * (attempt as u64 + 1))).await;
                continue;
            }
        };

        let mut file = tokio::fs::File::create(&tmp)
            .await
            .context(format!("creating {}", tmp.display()))?;
        let mut hasher = Sha1::new();
        let mut stream = response.bytes_stream();
        let mut write_error = None;

        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    hasher.update(&bytes);
                    if let Err(err) = file.write_all(&bytes).await {
                        write_error = Some(Error::Io(err));
                        break;
                    }
                }
                Err(err) => {
                    write_error = Some(Error::Http(err));
                    break;
                }
            }
        }
        if let Some(err) = write_error {
            last_error = Some(err);
            let _ = tokio::fs::remove_file(&tmp).await;
            continue;
        }
        file.flush().await.ok();
        drop(file);

        let actual = hex::encode(hasher.finalize());
        if let Some(expected) = expected_sha1 {
            if !actual.eq_ignore_ascii_case(expected) {
                let _ = tokio::fs::remove_file(&tmp).await;
                last_error = Some(Error::Checksum {
                    path: dest.display().to_string(),
                    expected: expected.to_string(),
                    actual,
                });
                continue;
            }
        }
        tokio::fs::rename(&tmp, dest)
            .await
            .context(format!("finalising {}", dest.display()))?;
        return Ok(());
    }

    Err(last_error.unwrap_or_else(|| Error::Message(format!("could not download {url}"))))
}

pub fn sha1_file(path: &Path) -> Result<String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Extracts a natives jar, honouring the `extract.exclude` list.
pub fn extract_natives(jar: &Path, dest: &Path, exclude: &[String]) -> Result<()> {
    std::fs::create_dir_all(dest)?;
    let file = std::fs::File::open(jar)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|err| Error::Message(format!("bad natives archive {}: {err}", jar.display())))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|err| Error::Message(format!("bad natives entry: {err}")))?;
        let name = entry.name().to_string();
        if entry.is_dir() || name.starts_with("META-INF") {
            continue;
        }
        if exclude.iter().any(|pattern| name.starts_with(pattern.trim_end_matches('/'))) {
            continue;
        }
        let Some(file_name) = Path::new(&name).file_name() else {
            continue;
        };
        let out_path = dest.join(file_name);
        let mut out = std::fs::File::create(&out_path)?;
        std::io::copy(&mut entry, &mut out)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maven_paths() {
        let path = maven_path("org.lwjgl:lwjgl:3.3.1").unwrap();
        assert_eq!(
            path.to_string_lossy().replace('\\', "/"),
            "org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1.jar"
        );
        let natives = maven_path("org.lwjgl:lwjgl:3.3.1:natives-linux").unwrap();
        assert_eq!(
            natives.to_string_lossy().replace('\\', "/"),
            "org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1-natives-linux.jar"
        );
    }

    #[test]
    fn native_arch_placeholder_is_replaced() {
        let lib: Library = serde_json::from_str(
            r#"{"name":"org.lwjgl:lwjgl:3.3.1","natives":{"linux":"natives-linux","windows":"natives-windows-${arch}"}}"#,
        )
        .unwrap();
        let classifier = native_classifier(&lib);
        if cfg!(windows) {
            assert!(classifier.unwrap().starts_with("natives-windows-"));
        } else if cfg!(any(target_os = "linux", target_os = "android")) {
            assert_eq!(classifier.as_deref(), Some("natives-linux"));
        } else {
            // macOS has no entry in this fixture's `natives` map.
            assert!(classifier.is_none());
        }
        assert!(native_classifier(&serde_json::from_str::<Library>(
            r#"{"name":"a:b:1"}"#
        )
        .unwrap())
        .is_none());
    }
}
