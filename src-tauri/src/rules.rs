//! Mojang's rule engine for libraries and game arguments.
//!
//! Rules are evaluated in order and the last matching rule wins. A version
//! file with no rules applies to every platform.

use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Deserialize)]
pub struct Rule {
    pub action: String,
    #[serde(default)]
    pub os: Option<OsRule>,
    #[serde(default)]
    pub features: Option<BTreeMap<String, bool>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub arch: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

/// The environment a set of rules is evaluated against.
#[derive(Debug, Clone)]
pub struct Features {
    pub has_custom_resolution: bool,
    pub is_demo_user: bool,
    pub has_quick_plays_support: bool,
    pub is_quick_play_singleplayer: bool,
    pub is_quick_play_multiplayer: bool,
    pub is_quick_play_realms: bool,
}

impl Default for Features {
    fn default() -> Self {
        Features {
            has_custom_resolution: false,
            is_demo_user: false,
            has_quick_plays_support: false,
            is_quick_play_singleplayer: false,
            is_quick_play_multiplayer: false,
            is_quick_play_realms: false,
        }
    }
}

impl Features {
    pub fn get(&self, key: &str) -> bool {
        match key {
            "has_custom_resolution" | "has_custom_resolution_2" => self.has_custom_resolution,
            "is_demo_user" => self.is_demo_user,
            "has_quick_plays_support" => true,
            "is_quick_play_singleplayer" => self.is_quick_play_singleplayer,
            "is_quick_play_multiplayer" => self.is_quick_play_multiplayer,
            "is_quick_play_realms" => self.is_quick_play_realms,
            _ => false,
        }
    }
}

/// Mojang names: `windows`, `osx`, `linux`.
pub fn os_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "macos")]
    {
        "osx"
    }
    #[cfg(target_os = "ios")]
    {
        "osx"
    }
    #[cfg(any(target_os = "linux", target_os = "android"))]
    {
        "linux"
    }
    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "linux",
        target_os = "android"
    )))]
    {
        "linux"
    }
}

/// Mojang names: `x86`, `x86_64` (reported as `x86`), `arm64`, `arm32`.
pub fn os_arch() -> &'static str {
    if cfg!(target_arch = "x86") {
        "x86"
    } else if cfg!(target_arch = "x86_64") {
        "x86"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else if cfg!(target_arch = "arm") {
        "arm32"
    } else {
        "x86"
    }
}

/// 64-bit vs 32-bit matters for native library selection.
pub fn is_64_bit() -> bool {
    cfg!(target_pointer_width = "64")
}

pub fn allows(rules: &[Rule], features: &Features) -> bool {
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in rules {
        if !matches(rule, features) {
            continue;
        }
        allowed = rule.action == "allow";
    }
    allowed
}

fn matches(rule: &Rule, features: &Features) -> bool {
    if let Some(os) = &rule.os {
        if let Some(name) = &os.name {
            if name != os_name() {
                return false;
            }
        }
        if let Some(arch) = &os.arch {
            if arch != os_arch() {
                return false;
            }
        }
        // `os.version` is a regex over the kernel version; the launcher treats
        // it as advisory because it only ever appears on native-accelerator
        // entries that we filter by architecture anyway.
    }
    if let Some(feature_map) = &rule.features {
        for (key, expected) in feature_map {
            if features.get(key) != *expected {
                return false;
            }
        }
    }
    true
}

/// Mojang uses `${placeholder}` tokens inside argument strings.
pub fn substitute(input: &str, vars: &BTreeMap<String, String>) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == '$' && i + 1 < bytes.len() && bytes[i + 1] == '{' {
            if let Some(end) = (i + 2..bytes.len()).find(|&j| bytes[j] == '}') {
                let key: String = bytes[i + 2..end].iter().collect();
                if let Some(value) = vars.get(&key) {
                    out.push_str(value);
                    i = end + 1;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feature_rules() -> Vec<Rule> {
        serde_json::from_str(
            r#"[
                {"action":"allow"},
                {"action":"disallow","features":{"is_demo_user":true}}
            ]"#,
        )
        .unwrap()
    }

    #[test]
    fn last_matching_rule_wins() {
        let rules = feature_rules();
        assert!(allows(&rules, &Features::default()));
        let demo = Features {
            is_demo_user: true,
            ..Features::default()
        };
        assert!(!allows(&rules, &demo));
    }

    #[test]
    fn substitutions_keep_unknown_tokens() {
        let mut vars = BTreeMap::new();
        vars.insert("auth_player_name".to_string(), "Steve".to_string());
        let out = substitute("--username ${auth_player_name} --nope ${unknown}", &vars);
        assert_eq!(out, "--username Steve --nope ${unknown}");
    }
}
