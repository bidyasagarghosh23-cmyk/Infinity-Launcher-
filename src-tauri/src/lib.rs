//! Infinity Launcher — application entry point and Tauri wiring.

pub mod auth;
pub mod commands;
pub mod error;
pub mod install;
pub mod java;
pub mod launch;
pub mod model;
pub mod mojang;
pub mod paths;
pub mod rules;
pub mod state;
pub mod store;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // A shared, cookie-less HTTP client: the Mojang CDN is happy with
    // connection reuse and it keeps TLS sessions warm across downloads.
    let http = reqwest::Client::builder()
        .user_agent(concat!(
            "InfinityLauncher/",
            env!("CARGO_PKG_VERSION"),
            " (+https://github.com/bidyasagarghosh23-cmyk/Infinity-Launcher-)"
        ))
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(20))
        .build()
        .expect("failed to build HTTP client");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::system_info,
            commands::get_settings,
            commands::save_settings,
            commands::list_instances,
            commands::create_instance,
            commands::update_instance,
            commands::delete_instance,
            commands::open_instance_folder,
            commands::fetch_version_manifest,
            commands::fetch_loader_versions,
            commands::install_instance,
            commands::launch_instance,
            commands::kill_instance,
            commands::instance_status,
            commands::list_accounts,
            commands::add_offline_account,
            commands::remove_account,
            commands::set_active_account,
            commands::auth_device_code_begin,
            commands::auth_device_code_poll,
            commands::refresh_account,
            commands::detect_java_runtimes,
            commands::provision_java_runtime,
            commands::read_log,
            commands::console_lines,
            commands::clear_log,
            commands::open_data_dir
        ])
        .setup(|app| {
            // Android and iOS must write inside their own app sandbox, not a
            // relative directory under the process working directory.
            let platform_data_dir = app.path().app_data_dir()?;
            app.manage(AppState::new(http, Some(platform_data_dir)));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Infinity Launcher");
}
