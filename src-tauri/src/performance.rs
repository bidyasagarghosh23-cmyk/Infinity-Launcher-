//! Conservative, user-visible performance presets. Applying a preset edits the
//! instance's options.txt without touching unrelated settings.

use std::path::PathBuf;

use crate::error::{Error, Result};
use crate::model::PerformancePreset;
use crate::state::AppState;

pub fn presets() -> Vec<PerformancePreset> {
    vec![
        PerformancePreset { id: "battery".into(), name: "Battery saver".into(), render_distance: 6, simulation_distance: 4, max_fps: 45, particles: 2, clouds: 0, graphics_mode: 0 },
        PerformancePreset { id: "balanced".into(), name: "Balanced".into(), render_distance: 10, simulation_distance: 8, max_fps: 60, particles: 1, clouds: 1, graphics_mode: 1 },
        PerformancePreset { id: "quality".into(), name: "Quality".into(), render_distance: 16, simulation_distance: 12, max_fps: 120, particles: 0, clouds: 2, graphics_mode: 2 },
    ]
}

fn instance_dir(state: &AppState, id: &str) -> Result<PathBuf> {
    let instance = state.instances_snapshot().into_iter().find(|i| i.id == id)
        .ok_or_else(|| Error::Message(format!("instance {id} not found")))?;
    let path = PathBuf::from(&instance.game_dir);
    Ok(if path.is_absolute() { path } else { state.paths().root.join(path) })
}

pub fn apply(state: &AppState, instance_id: &str, preset_id: &str) -> Result<()> {
    let preset = presets().into_iter().find(|p| p.id == preset_id)
        .ok_or_else(|| Error::Message(format!("unknown performance preset: {preset_id}")))?;
    let dir = instance_dir(state, instance_id)?;
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("options.txt");
    let existing = std::fs::read_to_string(&path).unwrap_or_default();
    let updates = [
        ("renderDistance", preset.render_distance.to_string()),
        ("simulationDistance", preset.simulation_distance.to_string()),
        ("maxFps", preset.max_fps.to_string()),
        ("particles", preset.particles.to_string()),
        ("clouds", preset.clouds.to_string()),
        ("graphicsMode", preset.graphics_mode.to_string()),
        ("enableVsync", "false".to_string()),
    ];
    let mut lines: Vec<String> = existing.lines().map(str::to_string).collect();
    for (key, value) in updates {
        let replacement = format!("{key}:{value}");
        if let Some(line) = lines.iter_mut().find(|line| line.starts_with(&format!("{key}:"))) {
            *line = replacement;
        } else {
            lines.push(replacement);
        }
    }
    let tmp = dir.join("options.txt.tmp");
    std::fs::write(&tmp, lines.join("\n") + "\n")?;
    std::fs::rename(tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_are_ordered_by_cost() {
        let presets = presets();
        assert!(presets[0].render_distance < presets[1].render_distance);
        assert!(presets[1].render_distance < presets[2].render_distance);
    }
}
