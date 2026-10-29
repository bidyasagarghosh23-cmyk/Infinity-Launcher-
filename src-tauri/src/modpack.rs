//! Modpack import for Modrinth `.mrpack` and CurseForge/standard `.zip` packs.
//! Creates an isolated instance, downloads client files, and applies overrides.

use std::io::Read;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::{Error, Result};
use crate::model::*;
use crate::state::AppState;

pub async fn import(state: &AppState, args: &ImportModpackArgs) -> Result<Instance> {
    let path = PathBuf::from(&args.path);
    let bytes = std::fs::read(&path)?;
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.as_slice()))
        .map_err(|e| Error::Message(format!("not a readable modpack zip: {e}")))?;
    if read_json_entry(&mut zip, "modrinth.index.json")?.is_some() {
        import_modrinth(state, args, &mut zip).await
    } else if read_json_entry(&mut zip, "manifest.json")?.is_some() {
        import_curseforge(state, args, &mut zip).await
    } else {
        Err(Error::Message("unsupported modpack: expected modrinth.index.json or manifest.json".into()))
    }
}

fn read_json_entry(zip: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>, name: &str) -> Result<Option<Value>> {
    let Ok(mut entry) = zip.by_name(name) else { return Ok(None); };
    let mut text = String::new();
    entry.read_to_string(&mut text)?;
    Ok(Some(serde_json::from_str(&text)?))
}

async fn create_instance(state: &AppState, name: String, mc_version: String, loader: Loader, loader_version: Option<String>) -> Result<Instance> {
    let id = uuid::Uuid::new_v4().to_string();
    let paths = state.paths();
    let game_dir = paths.instance_dir(&id);
    std::fs::create_dir_all(&game_dir)?;
    let version_id = match loader {
        Loader::Vanilla => mc_version.clone(),
        Loader::Fabric => format!("fabric-loader-{}-{mc_version}", loader_version.clone().unwrap_or_default()),
        Loader::Quilt => format!("quilt-loader-{}-{mc_version}", loader_version.clone().unwrap_or_default()),
        Loader::Forge => format!("{mc_version}-forge-{}", loader_version.clone().unwrap_or_default()),
        Loader::NeoForge => format!("neoforge-{}", loader_version.clone().unwrap_or_default()),
    };
    let instance = Instance {
        id: id.clone(), name, mc_version, loader, loader_version, version_id,
        game_dir: game_dir.to_string_lossy().to_string(), icon: "grass".into(),
        ram_mb: Some(state.settings_snapshot().ram_mb), java_path: None, jvm_args: None,
        created_at: chrono::Utc::now().timestamp(), last_played: None, playtime_secs: 0, installed: false,
    };
    state.instances.write().map_err(|_| Error::Message("instances lock poisoned".into()))?.push(instance.clone());
    state.save_instances()?;
    Ok(instance)
}

async fn import_modrinth(state: &AppState, args: &ImportModpackArgs, zip: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>) -> Result<Instance> {
    let index = read_json_entry(zip, "modrinth.index.json")?.ok_or_else(|| Error::Message("missing modrinth.index.json".into()))?;
    let name = args.name.clone().unwrap_or_else(|| index["name"].as_str().unwrap_or("Imported modpack").to_string());
    let deps = &index["dependencies"];
    let mc_version = deps["minecraft"].as_str().ok_or_else(|| Error::Message("modpack missing minecraft dependency".into()))?.to_string();
    let (loader, loader_version) = if let Some(v) = deps["fabric-loader"].as_str() { (Loader::Fabric, Some(v.to_string())) }
        else if let Some(v) = deps["quilt-loader"].as_str() { (Loader::Quilt, Some(v.to_string())) }
        else if let Some(v) = deps["neoforge"].as_str() { (Loader::NeoForge, Some(v.to_string())) }
        else if let Some(v) = deps["forge"].as_str() { (Loader::Forge, Some(v.to_string())) }
        else { (Loader::Vanilla, None) };
    let instance = create_instance(state, name, mc_version, loader, loader_version).await?;
    let dir = PathBuf::from(&instance.game_dir);
    if let Some(files) = index["files"].as_array() {
        for file in files {
            let env = file["env"]["client"].as_str().unwrap_or("required");
            if env == "unsupported" { continue; }
            let rel = file["path"].as_str().ok_or_else(|| Error::Message("modpack file missing path".into()))?;
            let url = file["downloads"][0].as_str().ok_or_else(|| Error::Message("modpack file missing download".into()))?;
            crate::catalog::validate_download_url(url)?;
            let dest = safe_join(&dir, rel)?;
            if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent)?; }
            let sha1 = file["hashes"]["sha1"].as_str();
            crate::mojang::download_forced(&state.http, url, &dest, sha1).await?;
        }
    }
    apply_overrides(zip, &dir, "overrides")?;
    apply_overrides(zip, &dir, "client-overrides")?;
    Ok(instance)
}

async fn import_curseforge(state: &AppState, args: &ImportModpackArgs, zip: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>) -> Result<Instance> {
    let manifest = read_json_entry(zip, "manifest.json")?.ok_or_else(|| Error::Message("missing manifest.json".into()))?;
    let name = args.name.clone().unwrap_or_else(|| manifest["name"].as_str().unwrap_or("Imported modpack").to_string());
    let mc_version = manifest["minecraft"]["version"].as_str().ok_or_else(|| Error::Message("modpack missing minecraft version".into()))?.to_string();
    let mut loader = Loader::Vanilla; let mut loader_version = None;
    if let Some(mod_loaders) = manifest["minecraft"]["modLoaders"].as_array() {
        for entry in mod_loaders {
            let id = entry["id"].as_str().unwrap_or_default();
            if let Some(v) = id.strip_prefix("fabric-") { loader = Loader::Fabric; loader_version = Some(v.to_string()); }
            else if let Some(v) = id.strip_prefix("quilt-") { loader = Loader::Quilt; loader_version = Some(v.to_string()); }
            else if let Some(v) = id.strip_prefix("neoforge-") { loader = Loader::NeoForge; loader_version = Some(v.to_string()); }
            else if let Some(v) = id.strip_prefix("forge-") { loader = Loader::Forge; loader_version = Some(v.to_string()); }
        }
    }
    let instance = create_instance(state, name, mc_version, loader, loader_version).await?;
    let dir = PathBuf::from(&instance.game_dir);
    let key = crate::catalog::curseforge_key().ok_or_else(|| Error::Message("CurseForge modpack import requires CURSEFORGE_API_KEY".into()))?;
    if let Some(files) = manifest["files"].as_array() {
        for file in files {
            if file["required"].as_bool() == Some(false) { continue; }
            let project = file["projectID"].as_u64().ok_or_else(|| Error::Message("bad CurseForge projectID".into()))?;
            let file_id = file["fileID"].as_u64().ok_or_else(|| Error::Message("bad CurseForge fileID".into()))?;
            let meta: Value = state.http.get(format!("https://api.curseforge.com/v1/mods/{project}/files/{file_id}"))
                .header("x-api-key", &key).send().await?.error_for_status()?.json().await?;
            let data = &meta["data"];
            let file_name = data["fileName"].as_str().ok_or_else(|| Error::Message("CurseForge file missing fileName".into()))?;
            let mut url = data["downloadUrl"].as_str().unwrap_or_default().to_string();
            if url.is_empty() {
                let resolved: Value = state.http.get(format!("https://api.curseforge.com/v1/mods/{project}/files/{file_id}/download-url"))
                    .header("x-api-key", &key).send().await?.error_for_status()?.json().await?;
                url = resolved["data"].as_str().unwrap_or_default().to_string();
            }
            crate::catalog::validate_download_url(&url)?;
            let dest = safe_join(&dir, &format!("mods/{file_name}"))?;
            if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent)?; }
            let sha1 = data["hashes"].as_array().and_then(|h| h.iter().find(|x| x["algo"].as_u64() == Some(1))).and_then(|x| x["value"].as_str());
            crate::mojang::download_forced(&state.http, &url, &dest, sha1).await?;
        }
    }
    let overrides = manifest["overrides"].as_str().unwrap_or("overrides");
    apply_overrides(zip, &dir, overrides)?;
    Ok(instance)
}

fn safe_join(base: &Path, rel: &str) -> Result<PathBuf> {
    let path = Path::new(rel);
    if path.components().any(|c| !matches!(c, std::path::Component::Normal(_))) {
        return Err(Error::Message(format!("unsafe modpack path: {rel}")));
    }
    Ok(base.join(path))
}

fn apply_overrides(zip: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>, dir: &Path, prefix: &str) -> Result<()> {
    let prefix = format!("{prefix}/");
    let names: Vec<String> = (0..zip.len()).filter_map(|i| zip.by_index(i).ok().map(|e| e.name().to_string())).collect();
    for name in names {
        let Some(rel) = name.strip_prefix(&prefix) else { continue };
        if rel.is_empty() { continue; }
        let dest = safe_join(dir, rel)?;
        let mut entry = zip.by_name(&name).map_err(|e| Error::Message(e.to_string()))?;
        if entry.is_dir() { std::fs::create_dir_all(&dest)?; continue; }
        if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent)?; }
        let mut out = std::fs::File::create(&dest)?;
        std::io::copy(&mut entry, &mut out)?;
    }
    Ok(())
}
