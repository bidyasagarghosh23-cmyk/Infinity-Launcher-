//! Builds the JVM command line and runs the game, streaming its log back to
//! the UI.

use serde_json::Value;
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::error::{Context, Error, Result};
use crate::install;
use crate::model::{Account, AccountKind, Instance, Settings};
use crate::mojang::ResolvedVersion;
use crate::paths::Paths;
use crate::rules::{self, Features};

pub struct LaunchPlan {
    pub program: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub game_dir: PathBuf,
    pub log_file: PathBuf,
}

/// Everything the JVM needs, resolved from the version JSON + instance.
#[allow(clippy::too_many_arguments)]
pub fn build_plan(
    paths: &Paths,
    instance: &Instance,
    settings: &Settings,
    account: &Account,
    java: &str,
    resolved: &ResolvedVersion,
    features: &Features,
) -> Result<LaunchPlan> {
    let game_dir = PathBuf::from(&instance.game_dir);
    let classpath = install::classpath(paths, resolved, features);
    if classpath.is_empty() {
        return Err(Error::Message(format!(
            "no libraries found for {} — reinstall this instance",
            instance.name
        )));
    }
    let classpath_str = classpath
        .iter()
        .map(|p| Paths::to_url_path(p))
        .collect::<Vec<_>>()
        .join(if cfg!(windows) { ";" } else { ":" });

    let natives = paths.natives().join(&resolved.id);
    let natives_arg = format!("-Djava.library.path={}", Paths::to_url_path(&natives));

    let mut vars = BTreeMap::new();
    vars.insert("auth_player_name".to_string(), account.username.clone());
    // Vanilla offline mode replaces ':' in the UUID.
    vars.insert("auth_uuid".to_string(), account.uuid.replace('-', ""));
    vars.insert(
        "auth_access_token".to_string(),
        account
            .access_token
            .clone()
            .unwrap_or_else(|| "0".to_string()),
    );
    vars.insert(
        "auth_session".to_string(),
        format!("token:{}:{}", account.access_token.clone().unwrap_or_default(), account.uuid),
    );
    vars.insert(
        "auth_xuid".to_string(),
        account.xuid.clone().unwrap_or_else(|| "0".to_string()),
    );
    vars.insert(
        "clientid".to_string(),
        std::env::var("INFINITY_MS_CLIENT_ID").unwrap_or_else(|_| "0".to_string()),
    );
    vars.insert("user_type".to_string(), match account.kind {
        AccountKind::Microsoft => "msa".to_string(),
        AccountKind::Demo => "legacy".to_string(),
        AccountKind::Offline => "legacy".to_string(),
    });
    vars.insert("version_name".to_string(), resolved.id.clone());
    vars.insert("version_type".to_string(), resolved.kind.clone());
    vars.insert(
        "game_directory".to_string(),
        Paths::to_url_path(&game_dir),
    );
    vars.insert("assets_root".to_string(), Paths::to_url_path(&paths.assets()));
    vars.insert(
        "assets_index_name".to_string(),
        resolved
            .asset_index
            .as_ref()
            .map(|i| i.id.clone())
            .or_else(|| resolved.assets.clone())
            .unwrap_or_else(|| "legacy".to_string()),
    );
    vars.insert("game_assets".to_string(), Paths::to_url_path(&paths.legacy_assets()));
    vars.insert(
        "resolution_width".to_string(),
        settings.window_width.to_string(),
    );
    vars.insert(
        "resolution_height".to_string(),
        settings.window_height.to_string(),
    );
    vars.insert("natives_directory".to_string(), Paths::to_url_path(&natives));
    vars.insert("launcher_name".to_string(), "InfinityLauncher".to_string());
    vars.insert("launcher_version".to_string(), env!("CARGO_PKG_VERSION").to_string());
    vars.insert("classpath".to_string(), classpath_str.clone());
    vars.insert("user_properties".to_string(), "{}".to_string());
    vars.insert("quickPlayPath".to_string(), String::new());
    vars.insert("quickPlaySingleplayer".to_string(), String::new());
    vars.insert("quickPlayMultiplayer".to_string(), String::new());
    vars.insert("quickPlayRealms".to_string(), String::new());
    vars.insert("library_directory".to_string(), Paths::to_url_path(&paths.libraries()));
    vars.insert(
        "classpath_separator".to_string(),
        if cfg!(windows) { ";" } else { ":" }.to_string(),
    );

    // ---- JVM arguments ---------------------------------------------------
    let mut jvm_args: Vec<String> = Vec::new();
    jvm_args.push(format!("-Xmx{}M", instance.ram_mb.unwrap_or(settings.ram_mb)));
    jvm_args.push(format!(
        "-Xms{}M",
        (instance.ram_mb.unwrap_or(settings.ram_mb) / 2).max(512)
    ));
    jvm_args.push(natives_arg);
    jvm_args.push("-Dminecraft.launcher.brand=InfinityLauncher".to_string());
    jvm_args.push(format!(
        "-Dminecraft.launcher.version={}",
        env!("CARGO_PKG_VERSION")
    ));
    if let Some(major) = resolved.java_major {
        if major >= 9 {
            // Java 9+ needs these for LWJGL 2 (pre-1.13) and some mods.
            jvm_args.push("--add-opens=java.base/java.lang=ALL-UNNAMED".to_string());
        }
        if major >= 24 {
            jvm_args.push("-Djava.security.manager=allow".to_string());
        }
    }

    if let Some(argument) = &resolved.logging_argument {
        if let Ok(id) = logging_client_id(resolved) {
            let log_path = paths
                .root
                .join("assets")
                .join("log_configs")
                .join(id);
            let mut map = BTreeMap::new();
            map.insert("path".to_string(), Paths::to_url_path(&log_path));
            jvm_args.push(rules::substitute(argument, &map));
        }
    }

    if !settings.jvm_args.trim().is_empty() {
        for token in split_args(&settings.jvm_args) {
            jvm_args.push(token);
        }
    }
    if let Some(extra) = &instance.jvm_args {
        for token in split_args(extra) {
            jvm_args.push(token);
        }
    }

    // Version-declared JVM arguments, rules applied.
    for entry in &resolved.arguments.jvm {
        match entry {
            Value::String(text) => jvm_args.push(rules::substitute(text, &vars)),
            Value::Object(map) => {
                if !argument_allowed(map, features) {
                    continue;
                }
                if let Some(values) = map.get("value") {
                    push_values(values, &vars, &mut jvm_args);
                }
            }
            _ => {}
        }
    }

    // ---- Game arguments --------------------------------------------------
    let mut game_args: Vec<String> = Vec::new();
    if let Some(legacy) = &resolved.minecraft_arguments {
        for token in split_args(legacy) {
            game_args.push(rules::substitute(&token, &vars));
        }
    }
    for entry in &resolved.arguments.game {
        match entry {
            Value::String(text) => game_args.push(rules::substitute(text, &vars)),
            Value::Object(map) => {
                if !argument_allowed(map, features) {
                    continue;
                }
                if let Some(values) = map.get("value") {
                    push_values(values, &vars, &mut game_args);
                }
            }
            _ => {}
        }
    }
    if !settings.game_args.trim().is_empty() {
        for token in split_args(&settings.game_args) {
            game_args.push(rules::substitute(&token, &vars));
        }
    }

    let mut args = jvm_args;
    args.push("-cp".to_string());
    args.push(classpath_str);
    args.push(resolved.main_class.clone());
    args.extend(game_args);

    // ---- Environment -----------------------------------------------------
    let mut env: Vec<(String, String)> = Vec::new();
    env.push(("APPDATA".to_string(), Paths::to_url_path(&paths.root)));
    if cfg!(target_os = "macos") {
        // Without this, the dock icon shows "java" instead of the app.
        env.push((
            "JAVA_TOOL_OPTIONS".to_string(),
            "-Xdock:name=Infinity Launcher".to_string(),
        ));
    }

    let log_file = paths.logs().join(format!("{}.log", instance.id));

    Ok(LaunchPlan {
        program: java.to_string(),
        args,
        env,
        game_dir,
        log_file,
    })
}

fn logging_client_id(resolved: &ResolvedVersion) -> Result<String> {
    resolved
        .logging_file
        .as_ref()
        .map(|f| f.id.clone())
        .ok_or_else(|| Error::Message("no client logging config".into()))
}

fn argument_allowed(map: &serde_json::Map<String, Value>, features: &Features) -> bool {
    match map.get("rules") {
        None => true,
        Some(value) => {
            let parsed: Vec<rules::Rule> = serde_json::from_value(value.clone()).unwrap_or_default();
            rules::allows(&parsed, features)
        }
    }
}

fn push_values(value: &Value, vars: &BTreeMap<String, String>, out: &mut Vec<String>) {
    match value {
        Value::String(text) => out.push(rules::substitute(text, vars)),
        Value::Array(items) => {
            for item in items {
                if let Value::String(text) = item {
                    out.push(rules::substitute(text, vars));
                }
            }
        }
        _ => {}
    }
}

/// Splits a command line string, respecting double quotes.
pub fn split_args(input: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in input.chars() {
        match ch {
            '"' => in_quotes = !in_quotes,
            c if c.is_whitespace() && !in_quotes => {
                if !current.is_empty() {
                    out.push(std::mem::take(&mut current));
                }
            }
            c => current.push(c),
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

/// Spawns the game and returns the child's PID after wiring stdout/stderr to
/// the instance log file.
pub fn spawn(plan: &LaunchPlan) -> Result<std::process::Child> {
    std::fs::create_dir_all(&plan.game_dir).ok();
    if let Some(parent) = plan.log_file.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut command = Command::new(&plan.program);
    command
        .args(&plan.args)
        .current_dir(&plan.game_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (key, value) in &plan.env {
        command.env(key, value);
    }

    #[cfg(target_os = "windows")]
    {
        // Keeps the console window from flashing up on Windows.
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    command.spawn().map_err(|err| {
        if err.kind() == std::io::ErrorKind::NotFound {
            Error::Message(format!(
                "could not run the Java executable at {}",
                plan.program
            ))
        } else {
            Error::Io(err)
        }
    })
}

/// Copies a child's output into `<logs>/<id>.log` and streams each line to a
/// callback, which the Tauri layer forwards to the UI.
pub fn pump_logs<R: std::io::Read + Send + 'static>(
    reader: R,
    log_file: PathBuf,
    on_line: Box<dyn Fn(String) + Send + Sync + 'static>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        use std::io::Write;
        let mut sink = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)
            .ok();
        for line in BufReader::new(reader).lines().map_while(std::result::Result::ok) {
            if let Some(sink) = sink.as_mut() {
                let _ = writeln!(sink, "{line}");
            }
            on_line(line);
        }
    })
}

/// Simple helper used by the commands layer to read the tail of a log file.
pub fn tail(path: &Path, max_lines: usize) -> Vec<String> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.len().saturating_sub(max_lines);
    lines[start..].iter().map(|l| l.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_quoted_arguments() {
        assert_eq!(
            split_args("-Xmx2G -Dfoo=\"bar baz\" --x 1"),
            vec!["-Xmx2G", "-Dfoo=bar baz", "--x", "1"]
        );
        assert!(split_args("   ").is_empty());
    }

    #[test]
    fn substitutes_launch_variables() {
        let mut vars = BTreeMap::new();
        vars.insert("auth_player_name".to_string(), "Alex".to_string());
        vars.insert("auth_uuid".to_string(), "abc".to_string());
        assert_eq!(
            rules::substitute("--username ${auth_player_name} --uuid ${auth_uuid}", &vars),
            "--username Alex --uuid abc"
        );
    }
}
