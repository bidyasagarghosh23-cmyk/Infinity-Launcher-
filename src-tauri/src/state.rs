//! In-memory state shared by every command: settings, accounts, instances,
//! running game processes and a rolling buffer of the game console.

use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::process::Child;
use std::sync::{Mutex, RwLock};

use crate::model::{Account, Instance, Settings, VersionManifest};
use crate::paths::Paths;
use crate::store;

pub const CONSOLE_LIMIT: usize = 4000;

pub struct AppState {
    pub http: reqwest::Client,
    paths: RwLock<Paths>,
    pub settings: RwLock<Settings>,
    pub accounts: RwLock<Vec<Account>>,
    pub instances: RwLock<Vec<Instance>>,
    pub running: Mutex<HashMap<String, RunningGame>>,
    pub console: Mutex<VecDeque<String>>,
    pub manifest: RwLock<Option<VersionManifest>>,
    /// Device codes currently being polled, keyed by the code itself.
    pub pending_logins: Mutex<HashMap<String, ()>>,
}

pub struct RunningGame {
    pub child: Child,
    pub pid: u32,
    pub started_at: i64,
    pub instance_id: String,
}

impl AppState {
    pub fn new(http: reqwest::Client, platform_data_dir: Option<PathBuf>) -> AppState {
        let paths = platform_data_dir
            .map(|root| Paths { root })
            .unwrap_or_else(|| Paths::resolve(None));
        let _ = paths.ensure();
        let settings: Settings = store::read_json(&paths.settings_file(), Settings::default());
        let effective = Paths::resolve_from(settings.data_dir.as_deref(), paths.root);
        let _ = effective.ensure();
        let accounts: Vec<Account> = store::read_json(&effective.accounts_file(), Vec::new());
        let instances: Vec<Instance> = store::read_json(&effective.instances_file(), Vec::new());
        AppState {
            http,
            paths: RwLock::new(effective),
            settings: RwLock::new(settings),
            accounts: RwLock::new(accounts),
            instances: RwLock::new(instances),
            running: Mutex::new(HashMap::new()),
            console: Mutex::new(VecDeque::with_capacity(CONSOLE_LIMIT)),
            manifest: RwLock::new(None),
            pending_logins: Mutex::new(HashMap::new()),
        }
    }

    pub fn paths(&self) -> Paths {
        self.paths.read().expect("paths lock poisoned").clone()
    }

    pub fn set_paths(&self, paths: Paths) {
        let mut guard = self.paths.write().expect("paths lock poisoned");
        *guard = paths;
    }

    pub fn settings_snapshot(&self) -> Settings {
        self.settings.read().expect("settings lock poisoned").clone()
    }

    pub fn instances_snapshot(&self) -> Vec<Instance> {
        self.instances.read().expect("instances lock poisoned").clone()
    }

    pub fn accounts_snapshot(&self) -> Vec<Account> {
        self.accounts.read().expect("accounts lock poisoned").clone()
    }

    pub fn save_settings(&self) -> crate::error::Result<()> {
        let settings = self.settings_snapshot();
        store::write_json(&self.paths().settings_file(), &settings)
    }

    pub fn save_accounts(&self) -> crate::error::Result<()> {
        let accounts = self.accounts_snapshot();
        store::write_json(&self.paths().accounts_file(), &accounts)
    }

    pub fn save_instances(&self) -> crate::error::Result<()> {
        let instances = self.instances_snapshot();
        store::write_json(&self.paths().instances_file(), &instances)
    }

    /// Accounts are ordered with the active one first (see `set_active_account`).
    pub fn active_account(&self) -> Option<Account> {
        self.accounts_snapshot().into_iter().next()
    }

    pub fn push_console(&self, line: String) {
        let mut console = self.console.lock().expect("console lock poisoned");
        if console.len() >= CONSOLE_LIMIT {
            console.pop_front();
        }
        console.push_back(line);
    }

    pub fn console_snapshot(&self) -> Vec<String> {
        self.console
            .lock()
            .expect("console lock poisoned")
            .iter()
            .cloned()
            .collect()
    }

    pub fn clear_console(&self) {
        self.console
            .lock()
            .expect("console lock poisoned")
            .clear();
    }
}
