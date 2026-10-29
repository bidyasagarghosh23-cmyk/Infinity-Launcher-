//! The IPC surface. Every function here is callable from the TypeScript
//! frontend via `invoke("<name>", { ...camelCaseArgs })`.

use std::path::PathBuf;
use std::sync::Arc;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::auth;
use crate::error::{Error, Result};
use crate::install::{self, Installer, Reporter};
use crate::java;
use crate::launch;
use crate::model::*;
use crate::mojang;
use crate::paths::Paths;
use crate::rules::Features;
use crate::state::{AppState, RunningGame};

pub const EVENT_PROGRESS: &str = "install://progress";
pub const EVENT_LOG: &str = "game://log";
pub const EVENT_STATE: &str = "game://state";

/// Bridges the installer's progress callbacks to a Tauri event.
struct EventReporter {
    app: AppHandle,
}

impl Reporter for EventReporter {
    fn report(&self, progress: Progress) {
        let _ = self.app.emit(EVENT_PROGRESS, progress);
    }
}

fn features_for(settings: &Settings) -> Features {
    Features {
        has_custom_resolution: settings.window_width > 0 && settings.window_height > 0,
        ..Features::default()
    }
}

// ---------------------------------------------------------------------------
// System / settings
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn system_info(state: State<'_, AppState>) -> Result<SystemInfo> {
    let paths = state.paths();
    let mut total_memory_mb = 0u64;
    {
        let mut system = sysinfo::System::new();
        system.refresh_memory();
        total_memory_mb = system.total_memory() / 1024 / 1024;
    }
    let running: Vec<GameStatus> = state
        .running
        .lock()
        .map(|map| {
            map.values()
                .map(|game| GameStatus {
                    instance_id: game.instance_id.clone(),
                    running: true,
                    pid: Some(game.pid),
                    started_at: Some(game.started_at),
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        platform: if cfg!(mobile) { "mobile" } else { "desktop" }.to_string(),
        total_memory_mb,
        data_dir: paths.root.to_string_lossy().to_string(),
        java: java::all(&paths),
        game_processes: running,
        device_name: sysinfo::System::host_name().unwrap_or_else(|| "This device".to_string()),
    })
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings> {
    Ok(state.settings_snapshot())
}

#[tauri::command]
pub async fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<Settings> {
    let previous_dir = state.settings_snapshot().data_dir;
    {
        let mut guard = state.settings.write().map_err(|_| Error::Message("lock".into()))?;
        *guard = settings.clone();
    }
    if previous_dir != settings.data_dir {
        let paths = Paths::resolve(settings.data_dir.as_deref());
        paths.ensure()?;
        state.set_paths(paths.clone());
        if let Ok(accounts) = std::fs::read(paths.accounts_file()) {
            if let Ok(parsed) = serde_json::from_slice::<Vec<Account>>(&accounts) {
                if let Ok(mut guard) = state.accounts.write() {
                    *guard = parsed;
                }
            }
        }
    }
    state.save_settings()?;
    Ok(settings)
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn fetch_version_manifest(state: State<'_, AppState>) -> Result<VersionManifest> {
    if let Ok(guard) = state.manifest.read() {
        if let Some(manifest) = guard.as_ref() {
            return Ok(manifest.clone());
        }
    }
    let manifest = mojang::fetch_manifest(&state.http).await?;
    if let Ok(mut guard) = state.manifest.write() {
        *guard = Some(manifest.clone());
    }
    Ok(manifest)
}

#[tauri::command]
pub async fn fetch_loader_versions(
    state: State<'_, AppState>,
    loader: Loader,
    mc_version: String,
) -> Result<Vec<LoaderVersion>> {
    install::loader_versions(&state.http, loader, &mc_version).await
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInstanceArgs {
    pub name: String,
    pub mc_version: String,
    #[serde(default)]
    pub loader: Loader,
    #[serde(default)]
    pub loader_version: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub ram_mb: Option<u32>,
}

#[tauri::command]
pub async fn list_instances(state: State<'_, AppState>) -> Result<Vec<Instance>> {
    let mut instances = state.instances_snapshot();
    instances.sort_by(|a, b| b.last_played.unwrap_or(0).cmp(&a.last_played.unwrap_or(0)));
    Ok(instances)
}

#[tauri::command]
pub async fn create_instance(
    state: State<'_, AppState>,
    args: CreateInstanceArgs,
) -> Result<Instance> {
    let paths = state.paths();
    let settings = state.settings_snapshot();
    let id = format!(
        "{}-{}",
        args.mc_version,
        uuid::Uuid::new_v4().simple().to_string()[..6].to_string()
    );
    let loader = args.loader;
    let version_id = match (&args.loader_version, loader) {
        (Some(loader_version), Loader::Fabric) | (Some(loader_version), Loader::Quilt)
        | (Some(loader_version), Loader::Forge) | (Some(loader_version), Loader::NeoForge) => {
            install::loader_version_id(loader, loader_version, &args.mc_version)
        }
        _ => args.mc_version.clone(),
    };
    let game_dir = paths.instance_dir(&id);
    std::fs::create_dir_all(&game_dir)?;

    let instance = Instance {
        id: id.clone(),
        name: args.name.trim().to_string(),
        mc_version: args.mc_version,
        loader,
        loader_version: args.loader_version,
        version_id,
        game_dir: game_dir.to_string_lossy().to_string(),
        icon: args.icon.unwrap_or_else(|| "grass".to_string()),
        ram_mb: args.ram_mb.or(Some(settings.ram_mb)),
        java_path: None,
        jvm_args: None,
        created_at: auth::now_secs(),
        last_played: None,
        playtime_secs: 0,
        installed: false,
    };

    {
        let mut guard = state
            .instances
            .write()
            .map_err(|_| Error::Message("instances lock poisoned".into()))?;
        guard.push(instance.clone());
    }
    state.save_instances()?;
    Ok(instance)
}

#[tauri::command]
pub async fn update_instance(state: State<'_, AppState>, instance: Instance) -> Result<Instance> {
    {
        let mut guard = state
            .instances
            .write()
            .map_err(|_| Error::Message("instances lock poisoned".into()))?;
        let Some(existing) = guard.iter_mut().find(|i| i.id == instance.id) else {
            return Err(Error::Message("no such instance".into()));
        };
        *existing = instance.clone();
    }
    state.save_instances()?;
    Ok(instance)
}

#[tauri::command]
pub async fn delete_instance(
    state: State<'_, AppState>,
    instance_id: String,
    delete_files: Option<bool>,
) -> Result<()> {
    let paths = state.paths();
    {
        let mut guard = state
            .instances
            .write()
            .map_err(|_| Error::Message("instances lock poisoned".into()))?;
        guard.retain(|i| i.id != instance_id);
    }
    if delete_files.unwrap_or(true) {
        let dir = paths.instance_dir(&instance_id);
        if dir.exists() {
            std::fs::remove_dir_all(dir).ok();
        }
    }
    state.save_instances()?;
    Ok(())
}

#[tauri::command]
pub async fn open_instance_folder(app: AppHandle, state: State<'_, AppState>, instance_id: String) -> Result<()> {
    use tauri_plugin_opener::OpenerExt;
    let paths = state.paths();
    let dir = paths.instance_dir(&instance_id);
    std::fs::create_dir_all(&dir)?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|err| Error::Message(err.to_string()))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Install / launch
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallArgs {
    pub instance_id: String,
    /// Drop mods/configs from a shared game dir before installing.
    #[serde(default)]
    pub fresh: bool,
}

#[tauri::command]
pub async fn install_instance(
    app: AppHandle,
    state: State<'_, AppState>,
    args: InstallArgs,
) -> Result<()> {
    let instance = state
        .instances_snapshot()
        .into_iter()
        .find(|i| i.id == args.instance_id)
        .ok_or_else(|| Error::Message("no such instance".into()))?;
    if args.fresh {
        let dir = PathBuf::from(&instance.game_dir);
        if dir.exists() {
            std::fs::remove_dir_all(&dir).ok();
        }
    }

    let paths = state.paths();
    let settings = state.settings_snapshot();
    let task_id = format!("install:{}", instance.id);
    let reporter: Arc<dyn Reporter> = Arc::new(EventReporter { app: app.clone() });
    let http = state.http.clone();
    let java_path = settings.java_path.clone().or(instance.java_path.clone());
    let instance_for_task = instance.clone();
    let task_id_for_task = task_id.clone();
    let app_for_task = app.clone();

    // Install in the background so the UI stays responsive; progress arrives
    // through `install://progress`.
    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();
        let Ok(runtime) = runtime else { return };
        runtime.block_on(async move {
            let installer = Installer {
                client: &http,
                paths: &paths,
                task_id: task_id_for_task.clone(),
                reporter: reporter.clone(),
                concurrency: settings.download_concurrency.max(1) as usize,
                java: java_path.clone(),
            };
            let features = features_for(&settings);
            let result = async {
                installer.ensure_vanilla(&instance_for_task.mc_version).await?;
                let mut resolved = mojang::resolve_version(&paths, &instance_for_task.mc_version)?;

                // Optional loader profile.
                if instance_for_task.loader != Loader::Vanilla {
                    if let Some(loader_version) = &instance_for_task.loader_version {
                        let id = install::install_loader(
                            &http,
                            &paths,
                            instance_for_task.loader,
                            loader_version,
                            &instance_for_task.mc_version,
                            reporter.as_ref(),
                            &task_id_for_task,
                            java_path.as_deref(),
                        )
                        .await?;
                        resolved = mojang::resolve_version(&paths, &id)?;
                    }
                }

                installer.install_version(&resolved.id, &features).await?;
                // Natives are extracted per concrete version folder.
                install::extract_version_natives(&paths, &resolved, &features)?;
                Ok::<(), Error>(())
            }
            .await;

            match result {
                Ok(()) => {
                    if let Ok(mut guard) = app_for_task.state::<AppState>().instances.write() {
                        if let Some(entry) = guard.iter_mut().find(|i| i.id == instance_for_task.id) {
                            entry.installed = true;
                        }
                    }
                    let _ = app_for_task
                        .state::<AppState>()
                        .save_instances();
                    let _ = app_for_task.emit(
                        EVENT_PROGRESS,
                        Progress {
                            task_id: task_id_for_task,
                            stage: "done".into(),
                            current: 1,
                            total: 1,
                            message: "Ready to play".into(),
                            bytes_per_second: None,
                        },
                    );
                }
                Err(err) => {
                    let _ = app_for_task.emit(
                        EVENT_PROGRESS,
                        Progress {
                            task_id: task_id_for_task,
                            stage: "error".into(),
                            current: 0,
                            total: 1,
                            message: err.to_string(),
                            bytes_per_second: None,
                        },
                    );
                }
            }
        });
    });

    Ok(())
}

#[tauri::command]
pub async fn launch_instance(
    app: AppHandle,
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<GameStatus> {
    let instance = state
        .instances_snapshot()
        .into_iter()
        .find(|i| i.id == instance_id)
        .ok_or_else(|| Error::Message("no such instance".into()))?;
    let settings = state.settings_snapshot();
    let paths = state.paths();

    if state
        .running
        .lock()
        .map(|map| map.values().any(|g| g.instance_id == instance_id))
        .unwrap_or(false)
    {
        return Err(Error::Message("This instance is already running.".into()));
    }

    let account = state
        .active_account()
        .ok_or_else(|| Error::Message("Sign in or add an offline account first.".into()))?;
    if !instance.installed {
        return Err(Error::Message(
            "This instance is not installed yet — run the install step first.".into(),
        ));
    }

    let resolved = mojang::resolve_version(&paths, &instance.version_id)?;
    let required = resolved.required_java();
    let runtimes = java::all(&paths);
    let explicit = instance
        .java_path
        .clone()
        .or(settings.java_path.clone())
        .filter(|p| !p.trim().is_empty());
    let chosen = match explicit {
        Some(path) => path,
        None => java::pick(&runtimes, required)
            .map(|runtime| runtime.path.clone())
            .ok_or_else(|| {
                Error::Message(format!(
                    "No Java {required}+ runtime found. Install a JRE or point the launcher at one in Settings."
                ))
            })?,
    };

    let features = Features {
        has_custom_resolution: settings.window_width > 0 && settings.window_height > 0,
        ..Features::default()
    };
    let plan = launch::build_plan(
        &paths,
        &instance,
        &settings,
        &account,
        &chosen,
        &resolved,
        &features,
    )?;
    let mut child = launch::spawn(&plan)?;
    let pid = child.id();
    let started_at = auth::now_secs();

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_for_logs = app.clone();
    let log_file = plan.log_file.clone();
    if let Some(stdout) = stdout {
        let app = app_for_logs.clone();
        let log_file = log_file.clone();
        launch::pump_logs(
            stdout,
            log_file.clone(),
            Box::new(move |line| {
                let state = app.state::<AppState>();
                state.push_console(line.clone());
                let _ = app.emit(EVENT_LOG, line);
            }),
        );
    }
    if let Some(stderr) = stderr {
        let app = app_for_logs;
        launch::pump_logs(
            stderr,
            log_file,
            Box::new(move |line| {
                let state = app.state::<AppState>();
                state.push_console(line.clone());
                let _ = app.emit(EVENT_LOG, line);
            }),
        );
    }

    if let Ok(mut map) = state.running.lock() {
        map.insert(
            instance.id.clone(),
            RunningGame {
                child,
                pid,
                started_at,
                instance_id: instance.id.clone(),
            },
        );
    }

    // Update the "last played" bookkeeping.
    if let Ok(mut guard) = state.instances.write() {
        if let Some(entry) = guard.iter_mut().find(|i| i.id == instance.id) {
            entry.last_played = Some(started_at);
        }
    }
    state.save_instances().ok();

    // Watch for exit in the background and tell the UI.
    let app_for_watch = app.clone();
    let instance_for_watch = instance.id.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let state = app_for_watch.state::<AppState>();
            let mut finished: Option<i32> = None;
            if let Ok(mut map) = state.running.lock() {
                if let Some(game) = map.get_mut(&instance_for_watch) {
                    match game.child.try_wait() {
                        Ok(Some(status)) => {
                            finished = Some(status.code().unwrap_or(-1));
                            map.remove(&instance_for_watch);
                        }
                        Ok(None) => {}
                        Err(_) => {
                            map.remove(&instance_for_watch);
                            finished = Some(-1);
                        }
                    }
                } else {
                    break;
                }
            }
            if let Some(code) = finished {
                let played = auth::now_secs() - started_at;
                if let Ok(mut guard) = state.instances.write() {
                    if let Some(entry) = guard.iter_mut().find(|i| i.id == instance_for_watch) {
                        entry.playtime_secs = entry.playtime_secs.saturating_add(played.max(0) as u64);
                    }
                }
                state.save_instances().ok();
                let _ = app_for_watch.emit(
                    EVENT_STATE,
                    GameStatus {
                        instance_id: instance_for_watch.clone(),
                        running: false,
                        pid: Some(pid),
                        started_at: Some(started_at),
                    },
                );
                let _ = code;
                break;
            }
        }
    });

    let _ = app.emit(
        EVENT_STATE,
        GameStatus {
            instance_id: instance.id.clone(),
            running: true,
            pid: Some(pid),
            started_at: Some(started_at),
        },
    );

    if settings.close_on_launch {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
    }

    Ok(GameStatus {
        instance_id: instance.id,
        running: true,
        pid: Some(pid),
        started_at: Some(started_at),
    })
}

#[tauri::command]
pub async fn kill_instance(state: State<'_, AppState>, instance_id: String) -> Result<()> {
    let mut map = state
        .running
        .lock()
        .map_err(|_| Error::Message("process lock poisoned".into()))?;
    if let Some(game) = map.get_mut(&instance_id) {
        game.child.kill().ok();
        map.remove(&instance_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn instance_status(state: State<'_, AppState>) -> Result<Vec<GameStatus>> {
    let mut statuses = Vec::new();
    if let Ok(mut map) = state.running.lock() {
        let ids: Vec<String> = map.keys().cloned().collect();
        for id in ids {
            let finished = match map.get_mut(&id) {
                Some(game) => match game.child.try_wait() {
                    Ok(Some(_)) => true,
                    _ => false,
                },
                None => true,
            };
            if finished {
                map.remove(&id);
                continue;
            }
            if let Some(game) = map.get(&id) {
                statuses.push(GameStatus {
                    instance_id: game.instance_id.clone(),
                    running: true,
                    pid: Some(game.pid),
                    started_at: Some(game.started_at),
                });
            }
        }
    }
    Ok(statuses)
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_accounts(state: State<'_, AppState>) -> Result<Vec<Account>> {
    Ok(state.accounts_snapshot())
}

#[tauri::command]
pub async fn remove_account(state: State<'_, AppState>, account_id: String) -> Result<()> {
    {
        let mut guard = state
            .accounts
            .write()
            .map_err(|_| Error::Message("accounts lock poisoned".into()))?;
        guard.retain(|a| a.id != account_id);
    }
    state.save_accounts()?;
    Ok(())
}

#[tauri::command]
pub async fn set_active_account(state: State<'_, AppState>, account_id: String) -> Result<()> {
    {
        let mut guard = state
            .accounts
            .write()
            .map_err(|_| Error::Message("accounts lock poisoned".into()))?;
        if let Some(index) = guard.iter().position(|a| a.id == account_id) {
            let account = guard.remove(index);
            guard.insert(0, account);
        } else {
            return Err(Error::Message("no such account".into()));
        }
    }
    state.save_accounts()?;
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineAccountArgs {
    pub username: String,
}

#[tauri::command]
pub async fn add_offline_account(
    state: State<'_, AppState>,
    args: OfflineAccountArgs,
) -> Result<Account> {
    let trimmed = args.username.trim();
    if trimmed.is_empty() {
        return Err(Error::Message("Enter a username.".into()));
    }
    if trimmed.len() > 16 {
        return Err(Error::Message(
            "Minecraft usernames are at most 16 characters.".into(),
        ));
    }
    let account = auth::offline_account(trimmed);
    {
        let mut guard = state
            .accounts
            .write()
            .map_err(|_| Error::Message("accounts lock poisoned".into()))?;
        guard.retain(|a| a.id != account.id);
        guard.insert(0, account.clone());
    }
    state.save_accounts()?;
    Ok(account)
}

#[tauri::command]
pub async fn auth_device_code_begin(state: State<'_, AppState>) -> Result<DeviceCode> {
    auth::begin_device_code(&state.http).await
}

#[tauri::command]
pub async fn auth_device_code_poll(
    state: State<'_, AppState>,
    device_code: String,
) -> Result<Account> {
    let account = auth::poll_device_code(&state.http, &device_code).await?;
    {
        let mut guard = state
            .accounts
            .write()
            .map_err(|_| Error::Message("accounts lock poisoned".into()))?;
        guard.retain(|a| a.id != account.id);
        guard.insert(0, account.clone());
    }
    state.save_accounts()?;
    Ok(account)
}

#[tauri::command]
pub async fn refresh_account(state: State<'_, AppState>, account_id: String) -> Result<Account> {
    let account = state
        .accounts_snapshot()
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| Error::Message("no such account".into()))?;
    if account.kind != AccountKind::Microsoft {
        return Ok(account);
    }
    let updated = auth::refresh(&state.http, &account).await?;
    {
        let mut guard = state
            .accounts
            .write()
            .map_err(|_| Error::Message("accounts lock poisoned".into()))?;
        if let Some(slot) = guard.iter_mut().find(|a| a.id == updated.id) {
            *slot = updated.clone();
        }
    }
    state.save_accounts()?;
    Ok(updated)
}

// ---------------------------------------------------------------------------
// Java / logs
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn detect_java_runtimes(state: State<'_, AppState>) -> Result<Vec<JavaRuntime>> {
    let paths = state.paths();
    Ok(java::all(&paths))
}

#[tauri::command]
pub async fn provision_java_runtime(
    app: AppHandle,
    state: State<'_, AppState>,
    major: u32,
) -> Result<JavaRuntime> {
    let paths = state.paths();
    let client = state.http.clone();
    let runtime = java::provision(&client, &paths, major, |current, total| {
        let _ = app.emit(
            EVENT_PROGRESS,
            Progress {
                task_id: format!("java:{major}"),
                stage: "java".into(),
                current,
                total,
                message: format!("Downloading Java {major}"),
                bytes_per_second: None,
            },
        );
    })
    .await?;
    Ok(runtime)
}

#[tauri::command]
pub async fn read_log(state: State<'_, AppState>, instance_id: String, lines: Option<usize>) -> Result<Vec<String>> {
    let paths = state.paths();
    let log = paths.logs().join(format!("{instance_id}.log"));
    Ok(launch::tail(&log, lines.unwrap_or(400)))
}

#[tauri::command]
pub async fn console_lines(state: State<'_, AppState>) -> Result<Vec<String>> {
    Ok(state.console_snapshot())
}

#[tauri::command]
pub async fn clear_log(state: State<'_, AppState>, instance_id: String) -> Result<()> {
    let paths = state.paths();
    std::fs::remove_file(paths.logs().join(format!("{instance_id}.log"))).ok();
    state.clear_console();
    Ok(())
}

#[tauri::command]
pub async fn open_data_dir(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    use tauri_plugin_opener::OpenerExt;
    let paths = state.paths();
    std::fs::create_dir_all(&paths.root)?;
    app.opener()
        .open_path(paths.root.to_string_lossy(), None::<&str>)
        .map_err(|err| Error::Message(err.to_string()))?;
    Ok(())
}
