//! Per-instance content management: verified catalog downloads, safe archive
//! extraction, enable/disable by rename, and world listing.

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha1::Digest;

use crate::catalog;
use crate::error::{Error, Result};
use crate::model::*;
use crate::state::AppState;
use crate::store;

const MANIFEST: &str = ".infinity-content.json";
const MAX_DOWNLOAD: u64 = 512 * 1024 * 1024;
const MAX_EXTRACTED: u64 = 2 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ContentManifest {
    items: HashMap<String, ContentRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContentRecord {
    name: String,
    source: CatalogSource,
    project_id: String,
    version_id: String,
    installed_at: i64,
}

fn instance_dir(state: &AppState, id: &str) -> Result<PathBuf> {
    let instance = state.instances_snapshot().into_iter().find(|i| i.id == id)
        .ok_or_else(|| Error::Message(format!("instance {id} not found")))?;
    let path = PathBuf::from(&instance.game_dir);
    Ok(if path.is_absolute() { path } else { state.paths().root.join(path) })
}

fn kind_dir(state: &AppState, id: &str, kind: ContentKind) -> Result<PathBuf> {
    Ok(instance_dir(state, id)?.join(kind.folder()))
}

fn safe_file_name(name: &str) -> Result<String> {
    let path = Path::new(name);
    let file = path.file_name().and_then(|v| v.to_str())
        .ok_or_else(|| Error::Message("invalid file name".into()))?;
    if file.is_empty() || file.starts_with('.') || path.components().count() != 1 {
        return Err(Error::Message(format!("unsafe file name: {name}")));
    }
    Ok(file.to_string())
}

fn manifest_path(dir: &Path) -> PathBuf { dir.join(MANIFEST) }

fn read_manifest(dir: &Path) -> ContentManifest {
    store::read_json(&manifest_path(dir), ContentManifest::default())
}

fn write_manifest(dir: &Path, manifest: &ContentManifest) -> Result<()> {
    store::write_json(&manifest_path(dir), manifest)
}

fn disabled_name(name: &str) -> String { format!("{name}.disabled") }
fn enabled_name(name: &str) -> Option<&str> { name.strip_suffix(".disabled") }

pub fn list(state: &AppState, instance_id: &str, kind: ContentKind) -> Result<Vec<ContentItem>> {
    let dir = kind_dir(state, instance_id, kind)?;
    let manifest = read_manifest(&dir);
    let mut out = Vec::new();
    if !dir.exists() { return Ok(out); }
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == MANIFEST { continue; }
        let metadata = entry.metadata()?;
        let (base, enabled) = if let Some(base) = enabled_name(&file_name) {
            (base.to_string(), false)
        } else { (file_name.clone(), true) };
        if kind == ContentKind::World && !metadata.is_dir() { continue; }
        if kind != ContentKind::World && !metadata.is_file() { continue; }
        let record = manifest.items.get(&base);
        let size = if metadata.is_dir() { dir_size(&entry.path()).unwrap_or(0) } else { metadata.len() };
        out.push(ContentItem {
            id: base.clone(),
            instance_id: instance_id.to_string(),
            kind,
            name: record.map(|r| r.name.clone()).unwrap_or_else(|| base.trim_end_matches(".jar").trim_end_matches(".zip").to_string()),
            file_name: base,
            enabled,
            size_bytes: size,
            source: record.map(|r| r.source),
            project_id: record.map(|r| r.project_id.clone()),
            version_id: record.map(|r| r.version_id.clone()),
            installed_at: record.map(|r| r.installed_at).unwrap_or_else(|| {
                metadata.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64).unwrap_or_default()
            }),
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

pub fn toggle(state: &AppState, instance_id: &str, kind: ContentKind, id: &str, enabled: bool) -> Result<ContentItem> {
    let dir = kind_dir(state, instance_id, kind)?;
    let base = safe_file_name(id)?;
    let current = dir.join(&base);
    let disabled = dir.join(disabled_name(&base));
    let (from, to) = if enabled { (disabled, current) } else { (current, disabled) };
    if to.exists() { return Err(Error::Message(format!("destination already exists: {}", to.display()))); }
    if !from.exists() { return Err(Error::Message(format!("content not found: {id}"))); }
    std::fs::rename(&from, &to)?;
    list(state, instance_id, kind)?.into_iter().find(|item| item.id == base)
        .ok_or_else(|| Error::Message("content disappeared after rename".into()))
}

pub fn remove(state: &AppState, instance_id: &str, kind: ContentKind, id: &str) -> Result<()> {
    let dir = kind_dir(state, instance_id, kind)?;
    let base = safe_file_name(id)?;
    let path = dir.join(&base);
    let disabled = dir.join(disabled_name(&base));
    if path.is_dir() { std::fs::remove_dir_all(path)?; }
    else if path.exists() { std::fs::remove_file(path)?; }
    if disabled.is_dir() { std::fs::remove_dir_all(disabled)?; }
    else if disabled.exists() { std::fs::remove_file(disabled)?; }
    let mut manifest = read_manifest(&dir);
    manifest.items.remove(&base);
    write_manifest(&dir, &manifest)
}

pub async fn install(state: &AppState, args: &InstallContentArgs) -> Result<ContentItem> {
    if args.file.size > MAX_DOWNLOAD {
        return Err(Error::Message("file exceeds the 512 MiB download limit".into()));
    }
    catalog::validate_download_url(&args.file.url)?;
    let file_name = safe_file_name(&args.file.file_name)?;
    let dir = kind_dir(state, &args.instance_id, args.kind)?;
    std::fs::create_dir_all(&dir)?;
    let dest = dir.join(&file_name);
    if dest.exists() || dir.join(disabled_name(&file_name)).exists() {
        return Err(Error::Message(format!("{file_name} is already installed; remove it first or pick another version")));
    }
    let tmp = dir.join(format!(".{file_name}.part"));
    let response = state.http.get(&args.file.url).send().await?.error_for_status()?;
    let bytes = response.bytes().await?;
    if bytes.len() as u64 > MAX_DOWNLOAD { return Err(Error::Message("download exceeded size limit".into())); }
    if let Some(expected) = &args.file.sha1 {
        let actual = hex::encode(sha1::Sha1::digest(&bytes));
        if !actual.eq_ignore_ascii_case(expected) {
            return Err(Error::Checksum { path: file_name, expected: expected.clone(), actual });
        }
    }
    if let Some(expected) = &args.file.sha512 {
        let actual = hex::encode(sha2::Sha512::digest(&bytes));
        if !actual.eq_ignore_ascii_case(expected) {
            return Err(Error::Checksum { path: file_name, expected: expected.clone(), actual });
        }
    }
    tokio::fs::write(&tmp, &bytes).await?;
    if args.kind == ContentKind::World {
        let target = dir.join(Path::new(&file_name).file_stem().and_then(|v| v.to_str()).unwrap_or("world"));
        if target.exists() { return Err(Error::Message(format!("world folder already exists: {}", target.display()))); }
        extract_zip(&tmp, &target)?;
        tokio::fs::remove_file(&tmp).await.ok();
    } else {
        // Modpacks are saved as archives in this stage; full modpack resolution
        // (loader + overrides + dependency graph) is tracked separately.
        tokio::fs::rename(&tmp, &dest).await?;
    }
    let mut manifest = read_manifest(&dir);
    let manifest_key = if args.kind == ContentKind::World {
        Path::new(&file_name).file_stem().and_then(|v| v.to_str()).unwrap_or("world").to_string()
    } else { file_name.clone() };
    manifest.items.insert(manifest_key, ContentRecord {
        name: args.project.title.clone(),
        source: args.project.source,
        project_id: args.project.id.clone(),
        version_id: args.file.id.clone(),
        installed_at: chrono::Utc::now().timestamp(),
    });
    write_manifest(&dir, &manifest)?;
    list(state, &args.instance_id, args.kind)?.into_iter().find(|item| item.id == manifest_key)
        .ok_or_else(|| Error::Message("installed content was not found".into()))
}

/// Extracts only regular files/directories, rejects traversal and absolute
/// paths, and caps total uncompressed size. Symlinks are never created.
pub fn extract_zip(archive: &Path, dest: &Path) -> Result<()> {
    let file = std::fs::File::open(archive)?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|err| Error::Message(format!("invalid zip archive: {err}")))?;
    let mut total = 0u64;
    let mut paths = Vec::new();
    for index in 0..zip.len() {
        let entry = zip.by_index(index)?;
        let name = entry.name().to_string();
        let path = Path::new(&name);
        if path.components().any(|c| !matches!(c, Component::Normal(_))) {
            return Err(Error::Message(format!("unsafe archive path: {name}")));
        }
        total = total.saturating_add(entry.size());
        if total > MAX_EXTRACTED { return Err(Error::Message("archive expands beyond the 2 GiB safety limit".into())); }
        paths.push((name, entry.is_dir()));
    }
    std::fs::create_dir_all(dest)?;
    for (name, is_dir) in paths {
        let out = dest.join(&name);
        if is_dir { std::fs::create_dir_all(&out)?; continue; }
        if let Some(parent) = out.parent() { std::fs::create_dir_all(parent)?; }
        let mut entry = zip.by_name(&name)?;
        let mut file = std::fs::File::create(&out)?;
        std::io::copy(&mut entry, &mut file)?;
    }
    Ok(())
}

pub fn worlds(state: &AppState, instance_id: &str) -> Result<Vec<WorldItem>> {
    let dir = kind_dir(state, instance_id, ContentKind::World)?;
    let mut out = Vec::new();
    if !dir.exists() { return Ok(out); }
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        if !entry.metadata()?.is_dir() { continue; }
        let folder = entry.file_name().to_string_lossy().to_string();
        if !entry.path().join("level.dat").exists() { continue; }
        let modified = entry.metadata()?.modified().ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64).unwrap_or_default();
        out.push(WorldItem {
            id: folder.clone(), instance_id: instance_id.to_string(),
            name: folder.replace('_', " "), folder_name: folder,
            size_bytes: dir_size(&entry.path()).unwrap_or(0), modified_at: modified,
        });
    }
    out.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(out)
}

fn dir_size(path: &Path) -> Result<u64> {
    let mut total = 0;
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if meta.is_dir() { total += dir_size(&entry.path())?; } else { total += meta.len(); }
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_cannot_escape_instance() {
        assert!(safe_file_name("mod.jar").is_ok());
        assert!(safe_file_name("../mod.jar").is_err());
        assert!(safe_file_name("/etc/passwd").is_err());
        assert!(safe_file_name(".hidden").is_err());
    }

    #[test]
    fn disabled_suffix_round_trips() {
        assert_eq!(disabled_name("sodium.jar"), "sodium.jar.disabled");
        assert_eq!(enabled_name("sodium.jar.disabled"), Some("sodium.jar"));
        assert_eq!(enabled_name("sodium.jar"), None);
    }
}
