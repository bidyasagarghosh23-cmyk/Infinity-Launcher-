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
        Self::resolve_from(override_dir, Self::default_root())
    }

    /// Mobile shells supply their sandboxed data directory through Tauri.
    /// Desktop callers can use `resolve` to keep the existing OS defaults.
    pub fn resolve_from(override_dir: Option<&str>, default_root: PathBuf) -> Paths {
        let root = Self::choose_root(
            override_dir,
            std::env::var_os("INFINITY_DATA_DIR"),
            default_root,
        );
        Paths { root }
    }

    fn choose_root(
        override_dir: Option<&str>,
        env_dir: Option<std::ffi::OsString>,
        default_root: PathBuf,
    ) -> PathBuf {
        env_dir
            .filter(|dir| !dir.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                override_dir
                    .filter(|dir| !dir.trim().is_empty())
                    .map(PathBuf::from)
            })
            .unwrap_or(default_root)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_the_mobile_sandbox_when_no_override_is_configured() {
        let sandbox = PathBuf::from("/data/user/0/app.infinitylauncher/files");
        assert_eq!(Paths::choose_root(None, None, sandbox.clone()), sandbox);
        assert_eq!(Paths::choose_root(Some("  "), None, sandbox.clone()), sandbox);
    }

    #[test]
    fn explicit_storage_override_still_works() {
        assert_eq!(
            Paths::choose_root(Some("/custom/library"), None, PathBuf::from("/default")),
            PathBuf::from("/custom/library")
        );
    }

    #[test]
    fn environment_override_has_highest_priority() {
        assert_eq!(
            Paths::choose_root(
                Some("/custom/library"),
                Some("/portable/library".into()),
                PathBuf::from("/default"),
            ),
            PathBuf::from("/portable/library")
        );
    }
}
