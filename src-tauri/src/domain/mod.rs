//! Domain types for OpenAI-Compatible Connections.
//!
//! Terminology matches `CONTEXT.md`. These types are the contract crossing
//! the Tauri bridge — all fields are camelCase on the wire.

pub mod inference;
pub mod status;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use inference::{infer_test_model, InferenceOutcome};
pub use status::{transition_after_refresh, transition_after_test, RefreshOutcome, TestOutcome};

/// Compatibility Status as defined in `CONTEXT.md`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompatibilityStatus {
    Untested,
    DiscoveringModels,
    NeedsTestModel,
    Available,
    PartiallyCompatible,
    RefreshFailed,
    Unavailable,
}

/// A single Discovered Model entry in the Model Inventory.
///
/// Identity is the `id` field only, as specified in `CONTEXT.md`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredModel {
    pub id: String,
}

/// A Test Result records the most recent Availability Test or Model Discovery
/// attempt for a Saved Connection.
///
/// Test Results must never contain Authentication Material.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub timestamp: DateTime<Utc>,
    pub base_url: String,
    pub endpoint_path: String,
    pub test_model: Option<String>,
    pub status_outcome: CompatibilityStatus,
    pub sanitized_error: Option<String>,
    pub latency_ms: Option<u64>,
}

/// Non-secret persisted state for a Saved Connection.
///
/// Authentication Material is stored in the OS credential store keyed by
/// [`SavedConnection::id`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedConnection {
    pub id: Uuid,
    pub display_name: String,
    /// The Base URL that succeeded for chat completion (i.e. the prefix where
    /// appending `/chat/completions` yields the working endpoint).
    pub base_url: String,
    /// User-selected Test Model, if any. May be `None` even after Model
    /// Discovery, in which case the app may infer one.
    pub test_model: Option<String>,
    pub model_inventory: Vec<DiscoveredModel>,
    pub compatibility_status: CompatibilityStatus,
    pub latest_test_result: Option<TestResult>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Lightweight projection of a Saved Connection used by the list pane.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSummary {
    pub id: Uuid,
    pub display_name: String,
    pub base_url: String,
    pub compatibility_status: CompatibilityStatus,
}

impl From<&SavedConnection> for ConnectionSummary {
    fn from(c: &SavedConnection) -> Self {
        Self {
            id: c.id,
            display_name: c.display_name.clone(),
            base_url: c.base_url.clone(),
            compatibility_status: c.compatibility_status,
        }
    }
}

/// Detail projection returned to the right pane of the UI.
pub type ConnectionDetail = SavedConnection;

/// Payload accepted by `create_connection`.
///
/// `api_key` is consumed by the backend, written into the OS credential
/// store, and dropped — it never reaches `connections.json`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewConnectionInput {
    pub display_name: String,
    pub base_url: String,
    pub api_key: String,
    pub test_model: Option<String>,
}

/// Payload accepted by `update_connection`.
///
/// All fields are optional. Supply a new `api_key` only when rotating
/// Authentication Material.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConnectionInput {
    pub display_name: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub test_model: Option<Option<String>>,
}

/// Result of a Model Inventory Check, returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInventoryResult {
    pub connection: ConnectionDetail,
    pub added: Vec<String>,
    pub removed: Vec<String>,
}
