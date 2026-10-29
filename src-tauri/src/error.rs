//! A single error type that can cross the IPC boundary as a plain string.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Message(String),

    #[error("network error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("file error: {0}")]
    Io(#[from] std::io::Error),

    #[error("unexpected data: {0}")]
    Json(#[from] serde_json::Error),

    #[error("checksum mismatch for {path} (expected {expected}, got {actual})")]
    Checksum {
        path: String,
        expected: String,
        actual: String,
    },

    #[error("authentication failed: {0}")]
    Auth(String),

    #[error("no Java runtime found")]
    NoJava,
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<anyhow::Error> for Error {
    fn from(value: anyhow::Error) -> Self {
        Error::Message(value.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

/// Small helper so call sites read nicely: `bail!("...")`.
#[macro_export]
macro_rules! bail {
    ($($arg:tt)*) => {
        return Err($crate::error::Error::Message(format!($($arg)*)))
    };
}

/// Wrap an arbitrary error with context.
pub trait Context<T> {
    fn context(self, message: impl Into<String>) -> Result<T>;
}

impl<T, E: std::fmt::Display> Context<T> for std::result::Result<T, E> {
    fn context(self, message: impl Into<String>) -> Result<T> {
        self.map_err(|err| Error::Message(format!("{}: {}", message.into(), err)))
    }
}
