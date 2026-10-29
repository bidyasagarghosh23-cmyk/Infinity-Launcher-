//! Catalog adapters. API keys stay in the native process and are never sent
//! to the WebView. Downloads are restricted to the catalogs' CDN hosts.

use serde_json::Value;

use crate::error::{Error, Result};
use crate::model::*;

const MODRINTH: &str = "https://api.modrinth.com/v2";
const CURSEFORGE: &str = "https://api.curseforge.com/v1";
pub const PAGE_SIZE: u32 = 20;

pub fn curseforge_key() -> Option<String> {
    std::env::var("CURSEFORGE_API_KEY")
        .ok()
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty())
}

pub fn status() -> CatalogStatus {
    CatalogStatus {
        modrinth: true,
        curseforge: curseforge_key().is_some(),
        curseforge_key_configured: curseforge_key().is_some(),
    }
}

fn kind_name(kind: ContentKind) -> &'static str {
    match kind {
        ContentKind::Mod => "mod",
        ContentKind::Resourcepack => "resourcepack",
        ContentKind::Shader => "shader",
        ContentKind::World => "world",
        ContentKind::Datapack => "datapack",
        ContentKind::Modpack => "modpack",
    }
}

fn curseforge_class(kind: ContentKind) -> Result<u32> {
    match kind {
        ContentKind::Mod => Ok(6),
        ContentKind::Resourcepack => Ok(12),
        ContentKind::World => Ok(17),
        ContentKind::Modpack => Ok(4471),
        ContentKind::Shader => Ok(6552),
        ContentKind::Datapack => Err(Error::Message(
            "CurseForge data packs are not exposed by this adapter yet; use Modrinth.".into(),
        )),
    }
}

pub async fn search(client: &reqwest::Client, query: &CatalogQuery) -> Result<CatalogPage> {
    let limit = PAGE_SIZE;
    let offset = query.offset.min(10_000);
    match query.source {
        CatalogSource::Modrinth => search_modrinth(client, query, offset, limit).await,
        CatalogSource::Curseforge => search_curseforge(client, query, offset, limit).await,
    }
}

async fn search_modrinth(
    client: &reqwest::Client,
    query: &CatalogQuery,
    offset: u32,
    limit: u32,
) -> Result<CatalogPage> {
    // Modrinth exposes worlds through the resource-pack project type with a
    // world category; keep the UI's separate Worlds tab honest about that.
    let project_type = if query.kind == ContentKind::World { "resourcepack" } else { kind_name(query.kind) };
    let mut facets = vec![vec![format!("project_type:{project_type}")]];
    if query.kind == ContentKind::World {
        facets.push(vec!["categories:world".to_string()]);
    }
    if let Some(version) = query.mc_version.as_deref().filter(|v| !v.is_empty()) {
        facets.push(vec![format!("versions:{version}")]);
    }
    if query.kind == ContentKind::Mod {
        if let Some(loader) = query.loader.as_deref().filter(|l| !l.is_empty() && *l != "vanilla") {
            facets.push(vec![format!("categories:{loader}")]);
        }
    }
    let facets = serde_json::to_string(&facets)?;
    let limit_text = limit.to_string();
    let offset_text = offset.to_string();
    let value: Value = client
        .get(format!("{MODRINTH}/search"))
        .query(&[
            ("query", query.query.trim()),
            ("facets", facets.as_str()),
            ("index", "relevance"),
            ("limit", limit_text.as_str()),
            ("offset", offset_text.as_str()),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let projects = value["hits"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|hit| CatalogProject {
            id: hit["project_id"].as_str().unwrap_or_default().to_string(),
            source: CatalogSource::Modrinth,
            kind: query.kind,
            title: hit["title"].as_str().unwrap_or("Untitled").to_string(),
            summary: hit["description"].as_str().unwrap_or_default().to_string(),
            author: hit["author"].as_str().unwrap_or("Unknown").to_string(),
            icon_url: hit["icon_url"].as_str().map(str::to_string),
            web_url: format!("https://modrinth.com/{}/{}", kind_name(query.kind), hit["slug"].as_str().unwrap_or_default()),
            downloads: hit["downloads"].as_u64().unwrap_or_default(),
            updated_at: hit["date_modified"].as_str().unwrap_or_default().to_string(),
        })
        .collect();
    Ok(CatalogPage { projects, total: value["total_hits"].as_u64().unwrap_or_default(), offset, limit })
}

async fn search_curseforge(
    client: &reqwest::Client,
    query: &CatalogQuery,
    offset: u32,
    limit: u32,
) -> Result<CatalogPage> {
    let key = curseforge_key().ok_or_else(|| Error::Message(
        "CurseForge needs an API key. Set CURSEFORGE_API_KEY on the launcher process; Modrinth works without one.".into(),
    ))?;
    let class_id = curseforge_class(query.kind)?;
    let class_text = class_id.to_string();
    let limit_text = limit.to_string();
    let offset_text = offset.to_string();
    let mut request = client
        .get(format!("{CURSEFORGE}/mods/search"))
        .header("x-api-key", key)
        .query(&[
            ("gameId", "432"),
            ("classId", class_text.as_str()),
            ("pageSize", limit_text.as_str()),
            ("index", offset_text.as_str()),
            ("sortField", "2"),
            ("sortOrder", "desc"),
        ])
        .query(&[("searchFilter", query.query.trim())]);
    if let Some(version) = query.mc_version.as_deref().filter(|v| !v.is_empty()) {
        request = request.query(&[("gameVersion", version)]);
    }
    let value: Value = request.send().await?.error_for_status()?.json().await?;
    let projects = value["data"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|hit| CatalogProject {
            id: hit["id"].as_u64().unwrap_or_default().to_string(),
            source: CatalogSource::Curseforge,
            kind: query.kind,
            title: hit["name"].as_str().unwrap_or("Untitled").to_string(),
            summary: hit["summary"].as_str().unwrap_or_default().to_string(),
            author: hit["authors"][0]["name"].as_str().unwrap_or("Unknown").to_string(),
            icon_url: hit["logo"]["thumbnailUrl"].as_str().map(str::to_string),
            web_url: hit["links"]["websiteUrl"].as_str().unwrap_or("https://www.curseforge.com/minecraft").to_string(),
            downloads: hit["downloadCount"].as_u64().unwrap_or_default(),
            updated_at: hit["dateReleased"].as_str().unwrap_or_default().to_string(),
        })
        .collect();
    Ok(CatalogPage {
        projects,
        total: value["pagination"]["totalCount"].as_u64().unwrap_or_default(),
        offset,
        limit,
    })
}

pub async fn files(
    client: &reqwest::Client,
    source: CatalogSource,
    project_id: &str,
    kind: ContentKind,
    mc_version: Option<&str>,
    loader: Option<&str>,
) -> Result<Vec<CatalogFile>> {
    match source {
        CatalogSource::Modrinth => modrinth_files(client, project_id, kind, mc_version, loader).await,
        CatalogSource::Curseforge => curseforge_files(client, project_id, mc_version).await,
    }
}

async fn modrinth_files(
    client: &reqwest::Client,
    project_id: &str,
    kind: ContentKind,
    mc_version: Option<&str>,
    loader: Option<&str>,
) -> Result<Vec<CatalogFile>> {
    let mut request = client.get(format!("{MODRINTH}/project/{project_id}/version"));
    if let Some(version) = mc_version.filter(|v| !v.is_empty()) {
        let game_versions = serde_json::to_string(&[version])?;
        request = request.query(&[("game_versions", game_versions)]);
    }
    if kind == ContentKind::Mod {
        if let Some(loader) = loader.filter(|l| !l.is_empty() && *l != "vanilla") {
            let loaders = serde_json::to_string(&[loader])?;
            request = request.query(&[("loaders", loaders)]);
        }
    }
    let value: Value = request.send().await?.error_for_status()?.json().await?;
    let mut out = Vec::new();
    for version in value.as_array().cloned().unwrap_or_default() {
        let Some(file) = version["files"].as_array().and_then(|files| {
            files.iter().find(|file| file["primary"].as_bool().unwrap_or(false)).or_else(|| files.first())
        }) else { continue };
        out.push(CatalogFile {
            id: version["id"].as_str().unwrap_or_default().to_string(),
            project_id: project_id.to_string(),
            name: version["name"].as_str().unwrap_or("Version").to_string(),
            version_number: version["version_number"].as_str().unwrap_or_default().to_string(),
            file_name: file["filename"].as_str().unwrap_or("download.jar").to_string(),
            url: file["url"].as_str().unwrap_or_default().to_string(),
            size: file["size"].as_u64().unwrap_or_default(),
            sha1: file["hashes"]["sha1"].as_str().map(str::to_string),
            sha512: file["hashes"]["sha512"].as_str().map(str::to_string),
            game_versions: strings(&version["game_versions"]),
            loaders: strings(&version["loaders"]),
            release_type: version["version_type"].as_str().unwrap_or("release").to_string(),
        });
    }
    Ok(out)
}

async fn curseforge_files(
    client: &reqwest::Client,
    project_id: &str,
    mc_version: Option<&str>,
) -> Result<Vec<CatalogFile>> {
    let key = curseforge_key().ok_or_else(|| Error::Message("CurseForge API key is not configured.".into()))?;
    let mut request = client
        .get(format!("{CURSEFORGE}/mods/{project_id}/files"))
        .header("x-api-key", &key)
        .query(&[("pageSize", "50")]);
    if let Some(version) = mc_version.filter(|v| !v.is_empty()) {
        request = request.query(&[("gameVersion", version)]);
    }
    let value: Value = request.send().await?.error_for_status()?.json().await?;
    let mut out = Vec::new();
    for file in value["data"].as_array().cloned().unwrap_or_default() {
        let id = file["id"].as_u64().unwrap_or_default();
        let url = file["downloadUrl"].as_str().map(str::to_string).unwrap_or_default();
        let url = if url.is_empty() {
            let resolved: Value = client
                .get(format!("{CURSEFORGE}/mods/{project_id}/files/{id}/download-url"))
                .header("x-api-key", &key)
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?;
            resolved["data"].as_str().unwrap_or_default().to_string()
        } else { url };
        let sha1 = file["hashes"].as_array().and_then(|hashes| {
            hashes.iter().find(|hash| hash["algo"].as_u64() == Some(1))
                .and_then(|hash| hash["value"].as_str()).map(str::to_string)
        });
        out.push(CatalogFile {
            id: id.to_string(),
            project_id: project_id.to_string(),
            name: file["displayName"].as_str().unwrap_or("Version").to_string(),
            version_number: file["displayName"].as_str().unwrap_or_default().to_string(),
            file_name: file["fileName"].as_str().unwrap_or("download.jar").to_string(),
            url,
            size: file["fileLength"].as_u64().unwrap_or_default(),
            sha1,
            sha512: None,
            game_versions: strings(&file["gameVersions"]),
            loaders: Vec::new(),
            release_type: match file["releaseType"].as_u64() { Some(1) => "release", Some(2) => "beta", _ => "alpha" }.to_string(),
        });
    }
    Ok(out)
}

fn strings(value: &Value) -> Vec<String> {
    value.as_array().cloned().unwrap_or_default().into_iter()
        .filter_map(|item| item.as_str().map(str::to_string)).collect()
}

pub fn validate_download_url(url: &str) -> Result<()> {
    let parsed = reqwest::Url::parse(url).map_err(|err| Error::Message(format!("invalid download URL: {err}")))?;
    if parsed.scheme() != "https" {
        return Err(Error::Message("content downloads must use HTTPS".into()));
    }
    let host = parsed.host_str().unwrap_or_default();
    let allowed = host == "cdn.modrinth.com"
        || host == "edge.forgecdn.net"
        || host == "mediafilez.forgecdn.net"
        || host.ends_with(".forgecdn.net")
        || host.ends_with(".modrinth.com");
    if !allowed {
        return Err(Error::Message(format!("download host is not a catalog CDN: {host}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_hosts_are_allowlisted() {
        assert!(validate_download_url("https://cdn.modrinth.com/data/x/versions/y/mod.jar").is_ok());
        assert!(validate_download_url("https://edge.forgecdn.net/files/1/2/mod.jar").is_ok());
        assert!(validate_download_url("https://evil.example/mod.jar").is_err());
        assert!(validate_download_url("http://cdn.modrinth.com/mod.jar").is_err());
    }
}
