//! Installs a playable version: vanilla metadata, client jar, libraries,
//! natives, the asset index + objects, and an optional mod loader profile.

use futures_util::stream::{self, StreamExt};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use crate::error::{Context, Error, Result};
use crate::model::{Loader, LoaderVersion, Progress};
use crate::mojang::{self, ResolvedVersion};
use crate::paths::Paths;
use crate::rules::{self, Features};

/// Anything that wants to receive install progress (the Tauri event bridge,
/// or a no-op in tests).
pub trait Reporter: Send + Sync {
    fn report(&self, progress: Progress);
}

impl<F> Reporter for F
where
    F: Fn(Progress) + Send + Sync,
{
    fn report(&self, progress: Progress) {
        (self)(progress)
    }
}

#[derive(Clone)]
pub struct Installer<'a> {
    pub client: &'a reqwest::Client,
    pub paths: &'a Paths,
    pub task_id: String,
    pub reporter: Arc<dyn Reporter>,
    pub concurrency: usize,
    pub java: Option<String>,
}

impl<'a> Installer<'a> {
    fn progress(&self, stage: &str, current: u64, total: u64, message: impl Into<String>) {
        self.reporter.report(Progress {
            task_id: self.task_id.clone(),
            stage: stage.to_string(),
            current,
            total,
            message: message.into(),
            bytes_per_second: None,
        });
    }

    /// Ensures the vanilla version JSON + client jar exist.
    pub async fn ensure_vanilla(&self, mc_version: &str) -> Result<()> {
        self.paths.ensure()?;
        let json_path = self.paths.version_json(mc_version);
        if !json_path.exists() {
            self.progress("metadata", 0, 1, format!("Fetching metadata for {mc_version}"));
            let manifest = mojang::fetch_manifest(self.client).await?;
            let entry = manifest
                .versions
                .iter()
                .find(|v| v.id == mc_version)
                .ok_or_else(|| Error::Message(format!("unknown Minecraft version {mc_version}")))?;
            mojang::download(self.client, &entry.url, &json_path, None).await?;
        }

        let version: mojang::VersionJson = mojang::read_version_json(self.paths, mc_version)?;
        if let Some(client) = version.downloads.as_ref().and_then(|d| d.client.clone()) {
            let jar = self.paths.version_jar(mc_version);
            self.progress("client", 0, 1, format!("Downloading {mc_version} client"));
            mojang::download(self.client, &client.url, &jar, client.sha1.as_deref()).await?;
        }
        self.progress("metadata", 1, 1, format!("{mc_version} metadata ready"));
        Ok(())
    }

    /// Full install of a version id, following `inheritsFrom` if needed.
    pub async fn install_version(&self, version_id: &str, features: &Features) -> Result<()> {
        let resolved = mojang::resolve_version(self.paths, version_id)?;
        let libraries = mojang::applicable_libraries(&resolved, features);

        // ---- assets index -------------------------------------------------
        self.ensure_assets_index(&resolved).await?;

        // ---- libraries ----------------------------------------------------
        let natives_dir = self.paths.natives().join(version_id);
        std::fs::create_dir_all(&natives_dir)?;

        let total_libs = libraries.len() as u64;
        let mut plan: Vec<(String, PathBuf, Option<String>, Option<PathBuf>)> = Vec::new();
        for lib in &libraries {
            let classifier = mojang::native_classifier(lib);
            if let Some(classifier) = &classifier {
                if let Some(download) = lib
                    .downloads
                    .as_ref()
                    .and_then(|d| d.classifiers.as_ref())
                    .and_then(|c| c.get(classifier))
                {
                    let Some(rel) = mojang::maven_path(&format!("{}:{classifier}", lib.name)) else {
                        continue;
                    };
                    let dest = self.paths.libraries().join(rel);
                    plan.push((
                        download.url.clone(),
                        dest,
                        download.sha1.clone(),
                        Some(natives_dir.clone()),
                    ));
                }
                continue;
            }

            if let Some(artifact) = lib.downloads.as_ref().and_then(|d| d.artifact.clone()) {
                let Some(rel) = mojang::maven_path(&lib.name) else {
                    continue;
                };
                plan.push((artifact.url, self.paths.libraries().join(rel), artifact.sha1, None));
            } else if let Some(base) = &lib.url {
                // Old-style libraries (`url` + maven coordinates).
                let Some(rel) = mojang::maven_path(&lib.name) else {
                    continue;
                };
                let relative = rel.to_string_lossy().replace('\\', "/");
                let url = format!("{}/{relative}", base.trim_end_matches('/'));
                plan.push((url, self.paths.libraries().join(rel), None, None));
            }
        }

        let counter = Arc::new(AtomicU64::new(0));
        let concurrency = self.concurrency.clamp(1, 32);
        let results: Vec<Result<()>> = stream::iter(plan.into_iter())
            .map(|(url, dest, sha1, extract_to)| {
                let counter = counter.clone();
                let total = total_libs;
                async move {
                    mojang::download(self.client, &url, &dest, sha1.as_deref()).await?;
                    if let Some(dir) = extract_to {
                        mojang::extract_natives(&dest, &dir, &[])?;
                    }
                    let done = counter.fetch_add(1, Ordering::Relaxed) + 1;
                    if done % 8 == 0 || done == total {
                        self.progress(
                            "libraries",
                            done,
                            total,
                            format!("Libraries {done}/{total}"),
                        );
                    }
                    Ok(())
                }
            })
            .buffer_unordered(concurrency)
            .collect()
            .await;

        for result in results {
            result?;
        }
        self.progress("libraries", total_libs, total_libs, "Libraries ready");

        // ---- assets -------------------------------------------------------
        self.install_assets(&resolved).await?;

        // ---- logging config ----------------------------------------------
        self.install_logging_config(&resolved).await?;

        self.progress("done", 1, 1, "Install complete");
        Ok(())
    }

    async fn ensure_assets_index(&self, version: &ResolvedVersion) -> Result<()> {
        if let Some(index) = &version.asset_index {
            if index.url.is_empty() {
                return Ok(());
            }
            let dest = self.paths.assets_indexes().join(format!("{}.json", index.id));
            self.progress("assets", 0, 1, "Fetching asset index");
            mojang::download(self.client, &index.url, &dest, index.sha1.as_deref()).await?;
        }
        Ok(())
    }

    async fn install_assets(&self, version: &ResolvedVersion) -> Result<()> {
        let Some(index) = &version.asset_index else {
            return Ok(());
        };
        let index_path = self.paths.assets_indexes().join(format!("{}.json", index.id));
        if !index_path.exists() {
            return Ok(());
        }
        let raw: serde_json::Value = serde_json::from_slice(&std::fs::read(&index_path)?)?;
        let virtual_assets = raw.get("virtual").and_then(|v| v.as_bool()).unwrap_or(false);
        let map_to_resources = raw
            .get("map_to_resources")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let empty = serde_json::Map::new();
        let objects = raw
            .get("objects")
            .and_then(|v| v.as_object())
            .unwrap_or(&empty)
            .clone();

        let total = objects.len() as u64;
        let counter = Arc::new(AtomicU64::new(0));
        // Asset blobs are tiny; a higher concurrency here is what makes the
        // 3000-file first install finish in seconds.
        let concurrency = (self.concurrency * 4).clamp(4, 64);

        let entries: Vec<(String, String, u64)> = objects
            .iter()
            .filter_map(|(name, value)| {
                let hash = value.get("hash")?.as_str()?.to_string();
                let size = value.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
                Some((name.clone(), hash, size))
            })
            .collect();

        let results: Vec<Result<()>> = stream::iter(entries.into_iter())
            .map(|(name, hash, _size)| {
                let counter = counter.clone();
                async move {
                    let prefix = &hash[0..2];
                    let dest = self.paths.assets_objects().join(prefix).join(&hash);
                    if !dest.exists() {
                        let url = format!("{}/{prefix}/{hash}", mojang::RESOURCES);
                        mojang::download(self.client, &url, &dest, Some(hash.as_str())).await?;
                    }
                    if virtual_assets || map_to_resources {
                        let target_root = if virtual_assets {
                            self.paths.assets().join("virtual").join(&index.id)
                        } else {
                            self.paths.assets().join(&index.id)
                        };
                        let target = target_root.join(&name);
                        if !target.exists() {
                            if let Some(parent) = target.parent() {
                                std::fs::create_dir_all(parent)?;
                            }
                            let _ = std::fs::copy(&dest, &target);
                        }
                    }
                    let done = counter.fetch_add(1, Ordering::Relaxed) + 1;
                    if done % 200 == 0 || done == total {
                        self.progress("assets", done, total, format!("Assets {done}/{total}"));
                    }
                    Ok(())
                }
            })
            .buffer_unordered(concurrency)
            .collect()
            .await;

        for result in results {
            result?;
        }
        self.progress("assets", total, total, "Assets ready");
        Ok(())
    }

    async fn install_logging_config(&self, version: &ResolvedVersion) -> Result<()> {
        let (Some(url), Some(file)) = (&version.logging_url, &version.logging_file) else {
            return Ok(());
        };
        let dest = self
            .paths
            .root
            .join("assets")
            .join("log_configs")
            .join(&file.id);
        let sha1 = file.file.as_ref().and_then(|download| download.sha1.as_deref());
        mojang::download(self.client, url, &dest, sha1).await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Mod loader profiles
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct FabricLoaderEntry {
    version: String,
    #[serde(default)]
    stable: bool,
}

/// Lists loader builds that are compatible with `mc_version`.
pub async fn loader_versions(
    client: &reqwest::Client,
    loader: Loader,
    mc_version: &str,
) -> Result<Vec<LoaderVersion>> {
    match loader {
        Loader::Vanilla => Ok(Vec::new()),
        Loader::Fabric => {
            let url = format!("{}/versions/loader/{mc_version}", mojang::FABRIC_META);
            let list: Vec<FabricLoaderEntry> =
                client.get(url).send().await?.error_for_status()?.json().await?;
            Ok(list
                .into_iter()
                .map(|entry| LoaderVersion {
                    version: entry.version,
                    stable: entry.stable,
                    mc_version: Some(mc_version.to_string()),
                })
                .collect())
        }
        Loader::Quilt => {
            let url = format!("{}/versions/loader/{mc_version}", mojang::QUILT_META);
            let list: Vec<FabricLoaderEntry> =
                client.get(url).send().await?.error_for_status()?.json().await?;
            Ok(list
                .into_iter()
                .map(|entry| LoaderVersion {
                    version: entry.version,
                    stable: entry.stable,
                    mc_version: Some(mc_version.to_string()),
                })
                .collect())
        }
        Loader::Forge | Loader::NeoForge => {
            let url = if loader == Loader::Forge {
                format!("{}/net/minecraftforge/forge/maven-metadata.xml", mojang::FORGE_MAVEN)
            } else {
                format!(
                    "{}/net/neoforged/neoforge/maven-metadata.xml",
                    mojang::NEOFORGE_MAVEN
                )
            };
            let xml = client.get(url).send().await?.error_for_status()?.text().await?;
            let prefix = forge_prefix(loader, mc_version);
            Ok(maven_versions(&xml, &prefix, mc_version))
        }
    }
}

/// Maven metadata is oldest first; the picker wants the newest 60 builds.
fn maven_versions(xml: &str, prefix: &str, mc_version: &str) -> Vec<LoaderVersion> {
    let mut versions: Vec<LoaderVersion> = xml
        .split("<version>")
        .skip(1)
        .filter_map(|chunk| chunk.split("</version>").next())
        .filter(|version| version.starts_with(prefix))
        .map(|version| LoaderVersion {
            version: version.to_string(),
            stable: !version.contains("beta") && !version.contains("-"),
            mc_version: Some(mc_version.to_string()),
        })
        .collect();
    versions.reverse();
    versions.truncate(60);
    versions
}

fn forge_prefix(loader: Loader, mc_version: &str) -> String {
    if loader == Loader::Forge {
        return format!("{mc_version}-");
    }
    // NeoForge versions drop the leading "1." (1.20.4 -> 20.4.)
    let mut parts = mc_version.split('.');
    let _major = parts.next();
    let minor = parts.next().unwrap_or("0");
    let patch = parts.next().unwrap_or("0");
    format!("{minor}.{patch}.")
}

/// Version id the launcher will execute for a loader+game combination.
pub fn loader_version_id(loader: Loader, loader_version: &str, mc_version: &str) -> String {
    match loader {
        Loader::Vanilla => mc_version.to_string(),
        Loader::Fabric => format!("fabric-loader-{loader_version}-{mc_version}"),
        Loader::Quilt => format!("quilt-loader-{loader_version}-{mc_version}"),
        Loader::Forge => format!("{mc_version}-forge-{loader_version}"),
        Loader::NeoForge => format!("neoforge-{loader_version}"),
    }
}

/// Writes the loader's version JSON (Fabric/Quilt) or runs the Forge installer.
pub async fn install_loader(
    client: &reqwest::Client,
    paths: &Paths,
    loader: Loader,
    loader_version: &str,
    mc_version: &str,
    reporter: &dyn Reporter,
    task_id: &str,
    java: Option<&str>,
) -> Result<String> {
    let id = loader_version_id(loader, loader_version, mc_version);
    match loader {
        Loader::Vanilla => Ok(mc_version.to_string()),
        Loader::Fabric => {
            fetch_profile(
                client,
                &format!(
                    "{}/versions/loader/{mc_version}/{loader_version}/profile/json",
                    mojang::FABRIC_META
                ),
                paths,
                &id,
            )
            .await
        }
        Loader::Quilt => {
            fetch_profile(
                client,
                &format!(
                    "{}/versions/loader/{mc_version}/{loader_version}/profile/json",
                    mojang::QUILT_META
                ),
                paths,
                &id,
            )
            .await
        }
        Loader::Forge | Loader::NeoForge => {
            let installer_version = if loader == Loader::Forge {
                format!("{mc_version}-{loader_version}")
            } else {
                loader_version.to_string()
            };
            let base = if loader == Loader::Forge {
                mojang::FORGE_MAVEN.to_string()
            } else {
                mojang::NEOFORGE_MAVEN.to_string()
            };
            let (group_path, artifact) = if loader == Loader::Forge {
                ("net/minecraftforge/forge", "forge")
            } else {
                ("net/neoforged/neoforge", "neoforge")
            };
            let url = format!(
                "{base}/{group_path}/{installer_version}/{artifact}-{installer_version}-installer.jar"
            );
            let installer = paths.root.join(format!("{artifact}-{installer_version}-installer.jar"));
            reporter.report(Progress {
                task_id: task_id.to_string(),
                stage: "loader".into(),
                current: 0,
                total: 1,
                message: format!("Downloading the {artifact} installer"),
                bytes_per_second: None,
            });
            mojang::download(client, &url, &installer, None).await?;

            let java = java.ok_or(crate::error::Error::NoJava)?;
            let before = list_version_dirs(paths);
            let status = std::process::Command::new(java)
                .arg("-jar")
                .arg(&installer)
                .arg("--installClient")
                .arg(&paths.root)
                .status()
                .context("running the Forge installer")?;
            std::fs::remove_file(&installer).ok();
            if !status.success() {
                return Err(Error::Message(format!(
                    "the {artifact} installer exited with {status}"
                )));
            }
            let after = list_version_dirs(paths);
            let created: Vec<String> = after
                .into_iter()
                .filter(|entry| !before.contains(entry))
                .collect();
            created
                .into_iter()
                .find(|entry| entry != mc_version)
                .or_else(|| {
                    if paths.version_json(&id).exists() {
                        Some(id.clone())
                    } else {
                        None
                    }
                })
                .ok_or_else(|| {
                    Error::Message(
                        "the Forge installer finished but produced no version profile".into(),
                    )
                })
        }
    }
}

fn list_version_dirs(paths: &Paths) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(paths.versions()) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect()
}

async fn fetch_profile(
    client: &reqwest::Client,
    url: &str,
    paths: &Paths,
    id: &str,
) -> Result<String> {
    let response = client.get(url).send().await?;
    if !response.status().is_success() {
        return Err(Error::Message(format!(
            "no loader profile at {url} ({})",
            response.status()
        )));
    }
    let value: serde_json::Value = response.json().await?;
    let dest = paths.version_json(id);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&dest, serde_json::to_vec_pretty(&value)?)?;
    Ok(id.to_string())
}

/// All the library paths (with natives) needed on the classpath for a version.
pub fn classpath(paths: &Paths, version: &ResolvedVersion, features: &Features) -> Vec<PathBuf> {
    let mut entries: Vec<PathBuf> = Vec::new();
    for lib in mojang::applicable_libraries(version, features) {
        if mojang::native_classifier(&lib).is_some() {
            continue;
        }
        if let Some(rel) = mojang::maven_path(&lib.name) {
            let candidate = paths.libraries().join(rel);
            if candidate.exists() {
                entries.push(candidate);
            }
        }
    }
    let client_jar = paths.version_jar(&version.jar_id);
    if client_jar.exists() {
        entries.push(client_jar);
    }
    entries
}

/// Extracts the natives for a version and returns the folder, if any.
pub fn extract_version_natives(paths: &Paths, version: &ResolvedVersion, features: &Features) -> Result<Option<PathBuf>> {
    let dir = paths.natives().join(&version.id);
    let mut found = false;
    for lib in mojang::applicable_libraries(version, features) {
        let Some(classifier) = mojang::native_classifier(&lib) else {
            continue;
        };
        let rel = mojang::maven_path(&format!("{}:{classifier}", lib.name));
        let Some(rel) = rel else { continue };
        let jar = paths.libraries().join(rel);
        if !jar.exists() {
            continue;
        }
        let exclude = lib.extract.as_ref().map(|e| e.exclude.clone()).unwrap_or_default();
        mojang::extract_natives(&jar, &dir, &exclude)?;
        found = true;
    }
    Ok(if found { Some(dir) } else { None })
}

/// Expand the `${...}` placeholders a version JSON uses in its arguments.
pub fn argument_vars(
    resolved: &ResolvedVersion,
    paths: &Paths,
    values: BTreeMap<String, String>,
) -> BTreeMap<String, String> {
    let mut vars = values;
    vars.insert(
        "game_directory".to_string(),
        Paths::to_url_path(&paths.root),
    );
    vars.insert(
        "assets_root".to_string(),
        Paths::to_url_path(&paths.assets()),
    );
    if let Some(index) = &resolved.asset_index {
        vars.insert("assets_index_name".to_string(), index.id.clone());
    }
    vars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loader_ids() {
        assert_eq!(
            loader_version_id(Loader::Fabric, "0.16.5", "1.21.1"),
            "fabric-loader-0.16.5-1.21.1"
        );
        assert_eq!(
            loader_version_id(Loader::Forge, "47.2.0", "1.20.1"),
            "1.20.1-forge-47.2.0"
        );
        assert_eq!(loader_version_id(Loader::Vanilla, "", "1.21.4"), "1.21.4");
    }

    #[test]
    fn maven_versions_are_newest_first_and_limited() {
        let entries: String = (1..=65)
            .map(|patch| format!("<version>21.1.{patch}</version>"))
            .collect();
        let xml = format!("<metadata><versioning><versions>{entries}<version>20.4.9</version></versions></versioning></metadata>");
        let versions = maven_versions(&xml, "21.1.", "1.21.1");
        assert_eq!(versions.len(), 60);
        assert_eq!(versions[0].version, "21.1.65");
        assert_eq!(versions[59].version, "21.1.6");
        assert!(versions.iter().all(|version| version.stable));
    }

    #[test]
    fn neoforge_prefix_drops_major() {
        assert_eq!(forge_prefix(Loader::NeoForge, "1.20.4"), "20.4.");
        assert_eq!(forge_prefix(Loader::NeoForge, "1.21.1"), "21.1.");
        assert_eq!(forge_prefix(Loader::Forge, "1.20.1"), "1.20.1-");
    }
}
