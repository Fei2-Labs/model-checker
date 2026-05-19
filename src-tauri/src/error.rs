//! Error type shared by every Tauri command.
//!
//! Errors that cross the bridge are serialized as plain strings. They must
//! never contain Authentication Material.

use serde::Serialize;
use thiserror::Error;

/// Top-level error for backend operations.
#[derive(Debug, Error)]
pub enum AppError {
    /// A Saved Connection with the given identifier does not exist.
    #[error("Saved Connection not found: {0}")]
    NotFound(uuid::Uuid),

    /// The user supplied input that fails validation.
    #[error("Invalid input: {0}")]
    Validation(String),

    /// Persistent storage (the `connections.json` file) is unreadable or
    /// unwritable.
    #[error("Storage error: {0}")]
    Storage(String),

    /// The OS credential store rejected a read or write of Authentication
    /// Material.
    #[error("Secure storage error: {0}")]
    Secrets(String),

    /// Network or HTTP error during Model Discovery or Availability Test.
    /// Always sanitized; never contains Authentication Material.
    #[error("Network error: {0}")]
    Network(String),

    /// The remote endpoint returned a response we could not interpret.
    #[error("Protocol error: {0}")]
    Protocol(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Storage(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Storage(err.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
