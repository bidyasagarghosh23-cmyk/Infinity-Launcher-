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
    manifest.items.insert(manifest_key.clone(), ContentRecord {
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
        let entry = zip.by_index(index).map_err(|err| Error::Message(format!("bad zip entry: {err}")))?;
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
        let mut entry = zip.by_name(&name).map_err(|err| Error::Message(format!("bad zip entry {name}: {err}")))?;
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

pub async fn check_updates(state: &AppState, instance_id: &str, kind: ContentKind) -> Result<Vec<ContentUpdate>> {
    let items = list(state, instance_id, kind)?;
    let instance = state.instances_snapshot().into_iter().find(|i| i.id == instance_id)
        .ok_or_else(|| Error::Message("instance not found".into()))?;
    let mut updates = Vec::new();
    for item in items {
        let (Some(source), Some(project_id)) = (item.source, item.project_id.clone()) else { continue };
        let Ok(files) = crate::catalog::files(&state.http, source, &project_id, kind, Some(&instance.mc_version), Some(&instance.loader)).await else { continue };
        if let Some(latest) = files.into_iter().next() {
            if item.version_id.as_deref() != Some(latest.id.as_str()) {
                updates.push(ContentUpdate { item, latest });
            }
        }
    }
    Ok(updates)
}

pub fn screenshots(state: &AppState, instance_id: &str) -> Result<Vec<ScreenshotItem>> {
    let dir = instance_dir(state, instance_id)?.join("screenshots");
    let mut out = Vec::new();
    if !dir.exists() { return Ok(out); }
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if !meta.is_file() { continue; }
        let name = entry.file_name().to_string_lossy().to_string();
        let lower = name.to_lowercase();
        if !(lower.ends_with(".png") || lower.ends_with(".jpg") || lower.ends_with(".jpeg")) { continue; }
        out.push(ScreenshotItem {
            id: name.clone(), instance_id: instance_id.to_string(), file_name: name,
            path: entry.path().to_string_lossy().to_string(), size_bytes: meta.len(),
            modified_at: meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64).unwrap_or_default(),
        });
    }
    out.sort_by(|a,b| b.modified_at.cmp(&a.modified_at));
    Ok(out)
}

pub fn backup_world(state: &AppState, instance_id: &str, world_id: &str) -> Result<BackupItem> {
    let world_id = safe_file_name(world_id)?;
    let root = instance_dir(state, instance_id)?;
    let world = root.join("saves").join(&world_id);
    if !world.is_dir() { return Err(Error::Message("world not found".into())); }
    let backups = root.join("backups");
    std::fs::create_dir_all(&backups)?;
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let file_name = format!("{world_id}-{stamp}.zip");
    let path = backups.join(&file_name);
    zip_directory(&world, &path)?;
    let meta = std::fs::metadata(&path)?;
    Ok(BackupItem { id: file_name.clone(), instance_id: instance_id.to_string(), world_id, file_name, path: path.to_string_lossy().to_string(), size_bytes: meta.len(), created_at: chrono::Utc::now().timestamp() })
}

pub fn list_backups(state: &AppState, instance_id: &str) -> Result<Vec<BackupItem>> {
    let dir = instance_dir(state, instance_id)?.join("backups");
    let mut out = Vec::new();
    if !dir.exists() { return Ok(out); }
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if !meta.is_file() { continue; }
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".zip") { continue; }
        let world_id = name.rsplit_once('-').map(|(a,_)| a.to_string()).unwrap_or_else(|| name.trim_end_matches(".zip").to_string());
        out.push(BackupItem { id: name.clone(), instance_id: instance_id.to_string(), world_id, file_name: name, path: entry.path().to_string_lossy().to_string(), size_bytes: meta.len(), created_at: meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64).unwrap_or_default() });
    }
    out.sort_by(|a,b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

pub fn restore_backup(state: &AppState, instance_id: &str, backup_id: &str, target_name: Option<String>) -> Result<WorldItem> {
    let backup_id = safe_file_name(backup_id)?;
    let root = instance_dir(state, instance_id)?;
    let path = root.join("backups").join(&backup_id);
    if !path.is_file() { return Err(Error::Message("backup not found".into())); }
    let target = target_name.unwrap_or_else(|| backup_id.trim_end_matches(".zip").to_string());
    let target = safe_file_name(&target)?;
    let dest = root.join("saves").join(&target);
    if dest.exists() { return Err(Error::Message("target world already exists; choose a new name".into())); }
    extract_zip(&path, &dest)?;
    worlds(state, instance_id)?.into_iter().find(|w| w.folder_name == target).ok_or_else(|| Error::Message("restored world missing level.dat".into()))
}

pub fn zip_directory(src: &Path, dest: &Path) -> Result<()> {
    let file = std::fs::File::create(dest)?;
    let mut zip = zip::ZipWriter::new(file);
    let options: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    fn walk(base: &Path, dir: &Path, zip: &mut zip::ZipWriter<std::fs::File>, options: zip::write::SimpleFileOptions) -> Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let rel = path.strip_prefix(base).map_err(|e| Error::Message(e.to_string()))?.to_string_lossy().replace('\\', "/");
            if path.is_dir() {
                zip.add_directory(format!("{rel}/"), options).map_err(|e| Error::Message(e.to_string()))?;
                walk(base, &path, zip, options)?;
            } else {
                zip.start_file(rel, options).map_err(|e| Error::Message(e.to_string()))?;
                let mut f = std::fs::File::open(&path)?;
                std::io::copy(&mut f, zip)?;
            }
        }
        Ok(())
    }
    walk(src, src, &mut zip, options)?;
    zip.finish().map_err(|e| Error::Message(e.to_string()))?;
    Ok(())
}
