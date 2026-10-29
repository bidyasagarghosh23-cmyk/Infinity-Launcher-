//! Tiny JSON document store. Every write is atomic (temp file + rename) so a
//! crash mid-save can never leave the launcher without settings.

use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::Path;

use crate::error::{Context, Result};

pub fn read_json<T: DeserializeOwned>(path: &Path, fallback: T) -> T {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or(fallback),
        Err(_) => fallback,
    }
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(format!("creating {}", parent.display()))?;
    }
    let data = serde_json::to_vec_pretty(value)?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, &data).with_context(format!("writing {}", tmp.display()))?;
    std::fs::rename(&tmp, path).with_context(format!("replacing {}", path.display()))?;
    Ok(())
}
