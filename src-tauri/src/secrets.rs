//! Wrapper around the OS credential store for Authentication Material.
//!
//! Each Saved Connection's API key is stored under a single service name,
//! keyed by the connection's UUID. The plain `connections.json` file never
//! contains a key.

use keyring::Entry;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

/// Service identifier used inside the OS credential store. Must remain
/// stable across releases or stored secrets become orphaned.
const SERVICE: &str = "com.modelchecker.app";

fn entry(id: Uuid) -> AppResult<Entry> {
    Entry::new(SERVICE, &id.to_string()).map_err(|e| AppError::Secrets(e.to_string()))
}

/// Write or overwrite the API key for the given connection.
pub fn store_api_key(id: Uuid, api_key: &str) -> AppResult<()> {
    entry(id)?
        .set_password(api_key)
        .map_err(|e| AppError::Secrets(e.to_string()))
}

/// Read the API key for the given connection. Returns
/// [`AppError::Secrets`] when no entry exists.
pub fn load_api_key(id: Uuid) -> AppResult<String> {
    entry(id)?
        .get_password()
        .map_err(|e| AppError::Secrets(e.to_string()))
}

/// Best-effort deletion. A missing entry is **not** treated as an error so
/// that `delete_connection` is idempotent even when the credential store
/// fell out of sync.
pub fn delete_api_key(id: Uuid) -> AppResult<()> {
    match entry(id)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Secrets(e.to_string())),
    }
}
