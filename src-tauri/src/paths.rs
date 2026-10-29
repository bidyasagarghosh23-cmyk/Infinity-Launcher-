//! The on-disk layout. Mirrors the conventional `.minecraft` folder so worlds,
//! resource packs and mods stay portable between launchers.

use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct Paths {
    pub root: PathBuf,
}

impl Paths {
    /// `INFINITY_DATA_DIR` > settings override > per-platform default.
    pub fn resolve(override_dir: Option<&str>) -> Paths {
        if let Some(dir) = override_dir.filter(|d| !d.trim().is_empty()) {
            return Paths {
                root: PathBuf::from(dir),
            };
        }
        Paths {
            root: Self::default_root(),
        }
    }

    pub fn default_root() -> PathBuf {
        if let Ok(dir) = std::env::var("INFINITY_DATA_DIR") {
            if !dir.trim().is_empty() {
                return PathBuf::from(dir);
            }
        }
        if let Some(dir) = dirs::data_dir() {
            return dir.join("Infinity Launcher");
        }
        // Last resort (some sandboxed targets report no data dir).
        PathBuf::from(".infinity-launcher")
    }

    pub fn settings_file(&self) -> PathBuf {
        self.root.join("settings.json")
    }

    pub fn accounts_file(&self) -> PathBuf {
        self.root.join("accounts.json")
    }

    pub fn instances_file(&self) -> PathBuf {
        self.root.join("instances.json")
    }

    pub fn versions(&self) -> PathBuf {
        self.root.join("versions")
    }

    pub fn libraries(&self) -> PathBuf {
        self.root.join("libraries")
    }

    pub fn assets(&self) -> PathBuf {
        self.root.join("assets")
    }

    pub fn assets_indexes(&self) -> PathBuf {
        self.assets().join("indexes")
    }

    pub fn assets_objects(&self) -> PathBuf {
        self.assets().join("objects")
    }

    pub fn natives(&self) -> PathBuf {
        self.root.join("natives")
    }

    pub fn runtime(&self) -> PathBuf {
        self.root.join("runtime")
    }

    pub fn logs(&self) -> PathBuf {
        self.root.join("logs")
    }

    pub fn instances(&self) -> PathBuf {
        self.root.join("instances")
    }

    pub fn legacy_assets(&self) -> PathBuf {
        self.assets().join("virtual")
    }

    /// Version folder for a concrete version id (vanilla or loader profile).
    pub fn version_dir(&self, id: &str) -> PathBuf {
        self.versions().join(id)
    }

    pub fn version_json(&self, id: &str) -> PathBuf {
        self.version_dir(id).join(format!("{id}.json"))
    }

    pub fn version_jar(&self, id: &str) -> PathBuf {
        self.version_dir(id).join(format!("{id}.jar"))
    }

    pub fn instance_dir(&self, id: &str) -> PathBuf {
        self.instances().join(id)
    }

    /// Creates every directory the launcher writes to.
    pub fn ensure(&self) -> std::io::Result<()> {
        let dirs: [PathBuf; 9] = [
            self.root.clone(),
            self.versions(),
            self.libraries(),
            self.assets(),
            self.assets_indexes(),
            self.assets_objects(),
            self.natives(),
            self.logs(),
            self.instances(),
        ];
        for dir in dirs {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }

    /// Turn an absolute path into the `T:\`-style form the game expects.
    pub fn to_url_path(path: &Path) -> String {
        let text = path.to_string_lossy().replace('\\', "/");
        if cfg!(windows) {
            text.trim_start_matches('/').to_string()
        } else {
            text
        }
    }
}
