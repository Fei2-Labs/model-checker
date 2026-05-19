//! Persistence for non-secret Saved Connection state.
//!
//! State is serialized to a single `connections.json` file inside Tauri's
//! app-data directory. Writes are atomic: serialize to a sibling tmp file,
//! then rename over the target.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::SavedConnection;
use crate::error::{AppError, AppResult};

/// Current schema version. Bump when the on-disk shape changes.
const SCHEMA_VERSION: u32 = 1;
const FILE_NAME: &str = "connections.json";

/// Top-level on-disk shape. Versioned so future migrations can branch on
/// `version` without breaking older installs.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConnectionsFile {
    version: u32,
    connections: Vec<SavedConnection>,
}

/// In-memory cache of Saved Connections, backed by `connections.json`.
pub struct ConnectionStore {
    path: PathBuf,
    connections: Vec<SavedConnection>,
}

impl ConnectionStore {
    /// Load from disk, creating an empty file when none exists.
    pub fn load_or_init(app_data_dir: &Path) -> AppResult<Self> {
        let path = app_data_dir.join(FILE_NAME);
        let connections = if path.exists() {
            let raw = fs::read_to_string(&path)?;
            let parsed: ConnectionsFile = serde_json::from_str(&raw)?;
            // Future-proofing: tolerate unknown versions by refusing rather
            // than silently rewriting them.
            if parsed.version != SCHEMA_VERSION {
                return Err(AppError::Storage(format!(
                    "unsupported connections.json schema version: {}",
                    parsed.version
                )));
            }
            parsed.connections
        } else {
            let store = Self {
                path: path.clone(),
                connections: Vec::new(),
            };
            store.persist()?;
            return Ok(store);
        };

        Ok(Self { path, connections })
    }

    pub fn all(&self) -> &[SavedConnection] {
        &self.connections
    }

    pub fn get(&self, id: Uuid) -> AppResult<&SavedConnection> {
        self.connections
            .iter()
            .find(|c| c.id == id)
            .ok_or(AppError::NotFound(id))
    }

    pub fn upsert(&mut self, conn: SavedConnection) -> AppResult<SavedConnection> {
        if let Some(slot) = self.connections.iter_mut().find(|c| c.id == conn.id) {
            *slot = conn.clone();
        } else {
            self.connections.push(conn.clone());
        }
        self.persist()?;
        Ok(conn)
    }

    pub fn remove(&mut self, id: Uuid) -> AppResult<()> {
        let before = self.connections.len();
        self.connections.retain(|c| c.id != id);
        if self.connections.len() == before {
            return Err(AppError::NotFound(id));
        }
        self.persist()?;
        Ok(())
    }

    /// Serialize the current in-memory state to `connections.json` atomically.
    fn persist(&self) -> AppResult<()> {
        let payload = ConnectionsFile {
            version: SCHEMA_VERSION,
            connections: self.connections.clone(),
        };
        let bytes = serde_json::to_vec_pretty(&payload)?;

        // Write to a sibling tmp file, fsync, then rename.
        let tmp_path = self.path.with_extension("json.tmp");
        {
            let mut tmp = fs::File::create(&tmp_path)?;
            tmp.write_all(&bytes)?;
            tmp.sync_all()?;
        }
        fs::rename(&tmp_path, &self.path)?;
        Ok(())
    }
}
