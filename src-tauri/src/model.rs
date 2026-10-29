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
}

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
            theme: "infinity".to_string(),
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
