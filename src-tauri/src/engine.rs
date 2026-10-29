//! Android engine boundary. The pinned upstream revision is recorded in
//! `engine/amethyst.lock.json`; this module deliberately reports the engine as
//! not integrated until a device-tested runtime is actually packaged.

use crate::model::EngineStatus;

pub const SOURCE_URL: &str = "https://github.com/AngelAuraMC/Amethyst-Android";
pub const SOURCE_COMMIT: &str = "28d6e12d68121b7dd75f2e841058a6b7cdfe4a29";

pub fn status() -> EngineStatus {
    EngineStatus {
        id: "amethyst".into(),
        name: "Amethyst (Pojav successor)".into(),
        source_url: SOURCE_URL.into(),
        source_commit: SOURCE_COMMIT.into(),
        license: "LGPL-3.0".into(),
        integrated: false,
        runtime_ready: false,
        gameplay_verified: false,
        renderers: vec!["gl4es".into(), "mobileglues".into(), "angle".into(), "mesa".into()],
        message: "Amethyst is the selected Android Java engine, but this build does not yet bundle or launch it. Android Play remains disabled until runtime packaging, licensing notices and a physical-device gameplay test pass.".into(),
    }
}
