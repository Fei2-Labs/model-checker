//! Tauri commands exposed to the React frontend.
//!
//! Every command returns a `Result<T, AppError>` so the bridge can serialize
//! domain errors as plain strings. None of these commands log Authentication
//! Material.

use std::sync::Arc;

use chrono::Utc;
use tauri::State;
use uuid::Uuid;

use crate::availability::{run_availability, AvailabilityErr};
use crate::discovery::probe_and_discover;
use crate::domain::{
    infer_test_model, transition_after_refresh, transition_after_test, CompatibilityStatus,
    ConnectionDetail, ConnectionSummary, DiscoveredModel, InferenceOutcome, ModelInventoryResult,
    NewConnectionInput, RefreshOutcome, SavedConnection, TestOutcome, TestResult,
    UpdateConnectionInput,
};
use crate::error::{AppError, AppResult};
use crate::secrets;
use crate::AppState;

fn validate_non_empty(field: &str, value: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        Err(AppError::Validation(format!("{field} must not be empty")))
    } else {
        Ok(())
    }
}

fn diff_ids(prev: &[DiscoveredModel], next: &[DiscoveredModel]) -> (Vec<String>, Vec<String>) {
    let prev_ids: std::collections::HashSet<_> = prev.iter().map(|m| m.id.as_str()).collect();
    let next_ids: std::collections::HashSet<_> = next.iter().map(|m| m.id.as_str()).collect();
    let added: Vec<String> = next_ids
        .difference(&prev_ids)
        .map(|s| (*s).to_string())
        .collect();
    let removed: Vec<String> = prev_ids
        .difference(&next_ids)
        .map(|s| (*s).to_string())
        .collect();
    (added, removed)
}

async fn cache_api_key(state: &Arc<AppState>, id: Uuid, api_key: &str) {
    state
        .secret_cache
        .lock()
        .await
        .insert(id, api_key.to_string());
}

async fn load_api_key(state: &Arc<AppState>, id: Uuid) -> AppResult<String> {
    if let Some(api_key) = state.secret_cache.lock().await.get(&id).cloned() {
        return Ok(api_key);
    }

    let api_key = secrets::load_api_key(id)?;
    cache_api_key(state, id, &api_key).await;
    Ok(api_key)
}

#[tauri::command]
pub async fn list_connections(
    state: State<'_, Arc<AppState>>,
) -> AppResult<Vec<ConnectionSummary>> {
    let store = state.store.lock().await;
    Ok(store.all().iter().map(ConnectionSummary::from).collect())
}

#[tauri::command]
pub async fn get_connection(
    id: Uuid,
    state: State<'_, Arc<AppState>>,
) -> AppResult<ConnectionDetail> {
    let store = state.store.lock().await;
    store.get(id).cloned()
}

#[tauri::command]
pub async fn get_connection_api_key(
    id: Uuid,
    state: State<'_, Arc<AppState>>,
) -> AppResult<Option<String>> {
    // Return None when no Authentication Material is stored, rather than surfacing
    // a backend error for the detail bar's presence indicator.
    match load_api_key(&state, id).await {
        Ok(api_key) => Ok(Some(api_key)),
        Err(AppError::Secrets(_)) => Ok(None),
        Err(err) => Err(err),
    }
}

#[tauri::command]
pub async fn create_connection(
    input: NewConnectionInput,
    state: State<'_, Arc<AppState>>,
) -> AppResult<ConnectionDetail> {
    validate_non_empty("displayName", &input.display_name)?;
    validate_non_empty("baseUrl", &input.base_url)?;
    validate_non_empty("apiKey", &input.api_key)?;

    let id = Uuid::new_v4();

    // Write the API key first; if this fails we never persist the record.
    secrets::store_api_key(id, &input.api_key)?;
    cache_api_key(&state, id, &input.api_key).await;

    let now = Utc::now();
    let conn = SavedConnection {
        id,
        display_name: input.display_name.trim().to_string(),
        base_url: input.base_url.trim().trim_end_matches('/').to_string(),
        test_model: input.test_model.and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }),
        model_inventory: Vec::new(),
        compatibility_status: CompatibilityStatus::Untested,
        latest_test_result: None,
        created_at: now,
        updated_at: now,
    };

    let mut store = state.store.lock().await;
    let saved = store.upsert(conn)?;
    Ok(saved)
}

#[tauri::command]
pub async fn update_connection(
    id: Uuid,
    input: UpdateConnectionInput,
    state: State<'_, Arc<AppState>>,
) -> AppResult<ConnectionDetail> {
    let mut store = state.store.lock().await;
    let mut conn = store.get(id)?.clone();

    if let Some(name) = input.display_name {
        validate_non_empty("displayName", &name)?;
        conn.display_name = name.trim().to_string();
    }
    if let Some(base) = input.base_url {
        validate_non_empty("baseUrl", &base)?;
        conn.base_url = base.trim().trim_end_matches('/').to_string();
    }
    if let Some(test_model) = input.test_model {
        conn.test_model = test_model.and_then(|s| {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        });
    }
    if let Some(api_key) = input.api_key {
        validate_non_empty("apiKey", &api_key)?;
        secrets::store_api_key(id, &api_key)?;
        cache_api_key(&state, id, &api_key).await;
    }

    conn.updated_at = Utc::now();
    let saved = store.upsert(conn)?;
    Ok(saved)
}

#[tauri::command]
pub async fn delete_connection(id: Uuid, state: State<'_, Arc<AppState>>) -> AppResult<()> {
    let mut store = state.store.lock().await;
    store.remove(id)?;
    // Best effort: even if removing the secret fails we don't restore the
    // record, since `connections.json` is the source of truth for what the
    // user considers Saved.
    state.secret_cache.lock().await.remove(&id);
    let _ = secrets::delete_api_key(id);
    Ok(())
}

#[tauri::command]
pub async fn refresh_models(
    id: Uuid,
    state: State<'_, Arc<AppState>>,
) -> AppResult<ModelInventoryResult> {
    let (base_url, api_key, prev_inventory, prev_status, prev_test_model) = {
        let store = state.store.lock().await;
        let conn = store.get(id)?.clone();
        let key = load_api_key(&state, id).await?;
        (
            conn.base_url,
            key,
            conn.model_inventory,
            conn.compatibility_status,
            conn.test_model,
        )
    };

    let result = probe_and_discover(&state.http, &base_url, &api_key).await;

    let mut store = state.store.lock().await;
    let mut conn = store.get(id)?.clone();

    match result {
        Ok(ok) => {
            // Decide refresh outcome based on whether we have (or can infer)
            // a Test Model.
            let outcome = if prev_test_model
                .as_ref()
                .is_some_and(|sel| ok.models.iter().any(|m| &m.id == sel))
            {
                RefreshOutcome::SuccessWithTestModel
            } else {
                match infer_test_model(&ok.models) {
                    InferenceOutcome::Inferred(_) => RefreshOutcome::SuccessWithTestModel,
                    InferenceOutcome::NeedsTestModel => RefreshOutcome::SuccessNeedsTestModel,
                }
            };

            let (added, removed) = diff_ids(&prev_inventory, &ok.models);
            conn.base_url = ok.base_url.clone();
            conn.model_inventory = ok.models;
            conn.compatibility_status = transition_after_refresh(prev_status, outcome);
            conn.latest_test_result = Some(TestResult {
                timestamp: Utc::now(),
                base_url: ok.base_url,
                endpoint_path: ok.endpoint_path,
                test_model: None,
                status_outcome: conn.compatibility_status,
                sanitized_error: None,
                latency_ms: None,
            });
            conn.updated_at = Utc::now();
            let saved = store.upsert(conn)?;
            Ok(ModelInventoryResult {
                connection: saved,
                added,
                removed,
            })
        }
        Err(err) => {
            conn.compatibility_status =
                transition_after_refresh(prev_status, RefreshOutcome::Failed);
            conn.latest_test_result = Some(TestResult {
                timestamp: Utc::now(),
                base_url: conn.base_url.clone(),
                endpoint_path: "/models".to_string(),
                test_model: None,
                status_outcome: conn.compatibility_status,
                sanitized_error: Some(err.to_string()),
                latency_ms: None,
            });
            conn.updated_at = Utc::now();
            let saved = store.upsert(conn)?;
            Ok(ModelInventoryResult {
                connection: saved,
                added: Vec::new(),
                removed: Vec::new(),
            })
        }
    }
}

#[tauri::command]
pub async fn run_availability_test(
    id: Uuid,
    state: State<'_, Arc<AppState>>,
) -> AppResult<TestResult> {
    let (base_url, api_key, selected_test_model, inventory) = {
        let store = state.store.lock().await;
        let conn = store.get(id)?.clone();
        let key = load_api_key(&state, id).await?;
        (conn.base_url, key, conn.test_model, conn.model_inventory)
    };

    // Decide which Test Model to use.
    let chosen_model: Option<String> = match selected_test_model.clone() {
        Some(m) => Some(m),
        None => match infer_test_model(&inventory) {
            InferenceOutcome::Inferred(m) => Some(m),
            InferenceOutcome::NeedsTestModel => None,
        },
    };

    let Some(model) = chosen_model else {
        // No safe Test Model: do not perform a network call.
        let new_status = transition_after_test(TestOutcome::NoSafeTestModel);
        let tr = TestResult {
            timestamp: Utc::now(),
            base_url: base_url.clone(),
            endpoint_path: "/chat/completions".to_string(),
            test_model: None,
            status_outcome: new_status,
            sanitized_error: Some(
                "No Test Model selected and no safe inference from Model Inventory".to_string(),
            ),
            latency_ms: None,
        };
        let mut store = state.store.lock().await;
        let mut conn = store.get(id)?.clone();
        conn.compatibility_status = new_status;
        conn.latest_test_result = Some(tr.clone());
        conn.updated_at = Utc::now();
        store.upsert(conn)?;
        return Ok(tr);
    };

    let had_prior_discovery = !inventory.is_empty();
    let outcome = run_availability(&state.http, &base_url, &api_key, &model).await;

    let (status_outcome, latency_ms, sanitized_error): (
        CompatibilityStatus,
        Option<u64>,
        Option<String>,
    ) = match outcome {
        Ok(ok) => (
            transition_after_test(TestOutcome::Success),
            Some(ok.latency_ms),
            None,
        ),
        Err(AvailabilityErr {
            sanitized_error,
            latency_ms,
        }) => {
            let test_outcome = if had_prior_discovery {
                TestOutcome::FailedWithPriorDiscovery
            } else {
                TestOutcome::FailedHard
            };
            (
                transition_after_test(test_outcome),
                Some(latency_ms),
                Some(sanitized_error),
            )
        }
    };

    let tr = TestResult {
        timestamp: Utc::now(),
        base_url: base_url.clone(),
        endpoint_path: "/chat/completions".to_string(),
        test_model: Some(model),
        status_outcome,
        sanitized_error,
        latency_ms,
    };

    let mut store = state.store.lock().await;
    let mut conn = store.get(id)?.clone();
    conn.compatibility_status = status_outcome;
    conn.latest_test_result = Some(tr.clone());
    // If we inferred a Test Model and the test succeeded, persist that
    // inference so the next Availability Test does not re-run inference.
    if selected_test_model.is_none() && status_outcome == CompatibilityStatus::Available {
        conn.test_model = tr.test_model.clone();
    }
    conn.updated_at = Utc::now();
    store.upsert(conn)?;
    Ok(tr)
}
