//! Data shapes shared with the TypeScript frontend. Keep these in sync with
//! `src/lib/types.ts` — the field names are serialised in camelCase.

use serde::{Deserialize, Serialize};

/// A Minecraft version as listed by Mojang's version manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionSummary {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub url: String,
    #[serde(default)]
    pub time: String,
    #[serde(default)]
    pub release_time: String,
    #[serde(default)]
    pub sha1: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Loader {
    Vanilla,
    Fabric,
    Quilt,
    Forge,
    NeoForge,
}

impl Default for Loader {
    fn default() -> Self {
        Loader::Vanilla
    }
}

impl Loader {
    /// Whether the loader needs an installer run after the vanilla files are
    /// in place (Forge/NeoForge ship their own installer jar).
    pub fn needs_installer(self) -> bool {
        matches!(self, Loader::Forge | Loader::NeoForge)
    }
}

/// An on-disk playable profile: a Minecraft version plus optional mod loader.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub mc_version: String,
    #[serde(default)]
    pub loader: Loader,
    #[serde(default)]
    pub loader_version: Option<String>,
    /// The concrete version folder under `versions/` that gets executed.
    pub version_id: String,
    pub game_dir: String,
    #[serde(default = "default_icon")]
    pub icon: String,
    #[serde(default)]
    pub ram_mb: Option<u32>,
    #[serde(default)]
    pub java_path: Option<String>,
    #[serde(default)]
    pub jvm_args: Option<String>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub last_played: Option<i64>,
    #[serde(default)]
    pub playtime_secs: u64,
    #[serde(default)]
    pub installed: bool,
}

fn default_icon() -> String {
    "grass".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub offline_username: String,
    pub ram_mb: u32,
    #[serde(default)]
    pub java_path: Option<String>,
    pub jvm_args: String,
    pub game_args: String,
    #[serde(default)]
    pub data_dir: Option<String>,
    pub fullscreen: bool,
    pub window_width: u32,
    pub window_height: u32,
    pub close_on_launch: bool,
    pub auto_update: bool,
    pub download_concurrency: u32,
    pub show_snapshots: bool,
    pub language: String,
    pub selected_instance: Option<String>,
    pub theme: String,
    #[serde(default = "default_performance_profile")]
    pub performance_profile: String,
    #[serde(default = "default_android_renderer")]
    pub android_renderer: String,
    #[serde(default = "default_touch_controls")]
    pub touch_controls: bool,
    #[serde(default)]
    pub reduce_effects: bool,
    #[serde(default)]
    pub favorite_instances: Vec<String>,
    #[serde(default = "default_show_news")]
    pub show_news: bool,
    #[serde(default)]
    pub compact_mode: bool,
}

fn default_performance_profile() -> String { "balanced".into() }
fn default_android_renderer() -> String { "gl4es".into() }
fn default_touch_controls() -> bool { true }
fn default_show_news() -> bool { true }

impl Default for Settings {
    fn default() -> Self {
        Settings {
            offline_username: "Steve".to_string(),
            ram_mb: 4096,
            java_path: None,
            jvm_args: "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200".to_string(),
            game_args: String::new(),
            data_dir: None,
            fullscreen: false,
            window_width: 1280,
            window_height: 720,
            close_on_launch: false,
            auto_update: true,
            download_concurrency: 8,
            show_snapshots: false,
            language: "en".to_string(),
            selected_instance: None,
            theme: "lunar".to_string(),
            performance_profile: "balanced".to_string(),
            android_renderer: "gl4es".to_string(),
            touch_controls: true,
            reduce_effects: false,
            favorite_instances: Vec::new(),
            show_news: true,
            compact_mode: false,
        }
    }
}

/// Signed-in account. Tokens are stored on disk; see `auth.rs` for the note on
/// how they are protected on each platform.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub username: String,
    pub uuid: String,
    #[serde(default)]
    pub kind: AccountKind,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub skin_url: Option<String>,
    #[serde(default)]
    pub cape_url: Option<String>,
    #[serde(default)]
    pub skin_variant: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub expires_at: Option<i64>,
    #[serde(default)]
    pub xuid: Option<String>,
    #[serde(default)]
    pub added_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AccountKind {
    Microsoft,
    Offline,
    Demo,
}

impl Default for AccountKind {
    fn default() -> Self {
        AccountKind::Offline
    }
}

/// Progress events emitted while installing / downloading.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub task_id: String,
    pub stage: String,
    pub current: u64,
    pub total: u64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_per_second: Option<u64>,
}

/// Runtime status of a running game process.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameStatus {
    pub instance_id: String,
    pub running: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<i64>,
}

/// Result of probing the host for runtimes and hardware.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub platform: String,
    pub total_memory_mb: u64,
    pub data_dir: String,
    pub java: Vec<JavaRuntime>,
    pub game_processes: Vec<GameStatus>,
    pub device_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaRuntime {
    pub path: String,
    pub version: String,
    pub major: u32,
    pub vendor: String,
    pub arch: String,
    pub managed: bool,
}

/// Device-code login handshake, as shown to the user.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoaderVersion {
    pub version: String,
    pub stable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mc_version: Option<String>,
}

// ---------------------------------------------------------------------------
// Client hub: catalogs, per-instance content, appearance and engine status
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentKind {
    Mod,
    Resourcepack,
    Shader,
    World,
    Datapack,
    Modpack,
}

impl ContentKind {
    pub fn folder(self) -> &'static str {
        match self {
            Self::Mod => "mods",
            Self::Resourcepack => "resourcepacks",
            Self::Shader => "shaderpacks",
            Self::World => "saves",
            Self::Datapack => "datapacks",
            Self::Modpack => "modpacks",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CatalogSource {
    Modrinth,
    Curseforge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogQuery {
    pub source: CatalogSource,
    pub kind: ContentKind,
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub mc_version: Option<String>,
    #[serde(default)]
    pub loader: Option<String>,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogProject {
    pub id: String,
    pub source: CatalogSource,
    pub kind: ContentKind,
    pub title: String,
    pub summary: String,
    pub author: String,
    pub icon_url: Option<String>,
    pub web_url: String,
    pub downloads: u64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogFile {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub version_number: String,
    pub file_name: String,
    pub url: String,
    pub size: u64,
    #[serde(default)]
    pub sha1: Option<String>,
    #[serde(default)]
    pub sha512: Option<String>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub release_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPage {
    pub projects: Vec<CatalogProject>,
    pub total: u64,
    pub offset: u32,
    pub limit: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogStatus {
    pub modrinth: bool,
    pub curseforge: bool,
    pub curseforge_key_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentItem {
    pub id: String,
    pub instance_id: String,
    pub kind: ContentKind,
    pub name: String,
    pub file_name: String,
    pub enabled: bool,
    pub size_bytes: u64,
    pub source: Option<CatalogSource>,
    pub project_id: Option<String>,
    pub version_id: Option<String>,
    pub installed_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldItem {
    pub id: String,
    pub instance_id: String,
    pub name: String,
    pub folder_name: String,
    pub size_bytes: u64,
    pub modified_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallContentArgs {
    pub instance_id: String,
    pub kind: ContentKind,
    pub project: CatalogProject,
    pub file: CatalogFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceProfile {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub skin_data_url: Option<String>,
    pub skin_variant: String,
    pub cape_data_url: Option<String>,
    pub cape_enabled: bool,
    pub cape_color: String,
    pub cape_pattern: String,
    pub wings: String,
    pub aura_color: String,
    pub aura_enabled: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub id: String,
    pub name: String,
    pub source_url: String,
    pub source_commit: String,
    pub license: String,
    pub integrated: bool,
    pub runtime_ready: bool,
    pub gameplay_verified: bool,
    pub renderers: Vec<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformancePreset {
    pub id: String,
    pub name: String,
    pub render_distance: u32,
    pub simulation_distance: u32,
    pub max_fps: u32,
    pub particles: u32,
    pub clouds: u32,
    pub graphics_mode: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentUpdate {
    pub item: ContentItem,
    pub latest: CatalogFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotItem {
    pub id: String,
    pub instance_id: String,
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupItem {
    pub id: String,
    pub instance_id: String,
    pub world_id: String,
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportModpackArgs {
    pub path: String,
    pub name: Option<String>,
}
