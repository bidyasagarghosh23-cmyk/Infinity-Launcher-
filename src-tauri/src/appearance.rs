//! Local appearance profiles. These are launcher-side cosmetics: they are not
//! injected into Minecraft or published to a server. A future engine/mod bridge
//! can consume the same profile format when the platform supports it.

use base64::Engine;

use crate::error::{Error, Result};
use crate::model::AppearanceProfile;
use crate::state::AppState;
use crate::store;

const MAX_TEXTURE_BYTES: usize = 1024 * 1024;

fn file(state: &AppState) -> std::path::PathBuf {
    state.paths().root.join("appearance.json")
}

pub fn list(state: &AppState) -> Vec<AppearanceProfile> {
    store::read_json(&file(state), Vec::new())
}

fn validate_texture(data_url: &Option<String>, label: &str) -> Result<()> {
    let Some(value) = data_url else { return Ok(()); };
    let Some(encoded) = value.strip_prefix("data:image/png;base64,") else {
        return Err(Error::Message(format!("{label} must be a PNG data URL")));
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|_| Error::Message(format!("{label} is not valid base64")))?;
    if bytes.len() > MAX_TEXTURE_BYTES {
        return Err(Error::Message(format!("{label} exceeds the 1 MiB texture limit")));
    }
    if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" {
        return Err(Error::Message(format!("{label} is not a PNG image")));
    }
    if label == "skin" {
        let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
        let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
        if !((width == 64 && height == 32) || (width == 64 && height == 64)) {
            return Err(Error::Message("skin must be a 64×32 or 64×64 PNG".into()));
        }
    }
    Ok(())
}

pub fn save(state: &AppState, mut profile: AppearanceProfile) -> Result<AppearanceProfile> {
    if profile.name.trim().is_empty() {
        return Err(Error::Message("appearance profile needs a name".into()));
    }
    if profile.id.trim().is_empty() {
        profile.id = uuid::Uuid::new_v4().to_string();
    }
    validate_texture(&profile.skin_data_url, "skin")?;
    validate_texture(&profile.cape_data_url, "cape")?;
    profile.updated_at = chrono::Utc::now().timestamp();
    let mut profiles = list(state);
    if let Some(existing) = profiles.iter_mut().find(|p| p.id == profile.id) {
        *existing = profile.clone();
    } else {
        profiles.push(profile.clone());
    }
    store::write_json(&file(state), &profiles)?;
    Ok(profile)
}

pub fn remove(state: &AppState, id: &str) -> Result<()> {
    let mut profiles = list(state);
    profiles.retain(|p| p.id != id);
    store::write_json(&file(state), &profiles)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_png_textures() {
        assert!(validate_texture(&Some("data:image/jpeg;base64,AAAA".into()), "skin").is_err());
        assert!(validate_texture(&None, "skin").is_ok());
    }
}
