//! Model Discovery: probing Base URLs and performing a Model Inventory Check.
//!
//! Probing tries `GET {base}/models` first, then `GET {base}/v1/models`. The
//! first variant that returns a parseable OpenAI-shaped models list wins, and
//! its prefix becomes the stored Base URL (so appending `/chat/completions`
//! yields the working chat-completion endpoint).

use serde::Deserialize;

use crate::domain::DiscoveredModel;
use crate::error::{AppError, AppResult};
use crate::http_util::redact_api_key;

#[derive(Debug, Deserialize)]
struct ModelsEnvelope {
    data: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    id: String,
}

/// Result of a successful Model Inventory Check.
pub struct DiscoveryOk {
    /// The Base URL prefix that worked (no `/models` suffix).
    pub base_url: String,
    /// The endpoint path actually hit (e.g. `/models` or `/v1/models`).
    pub endpoint_path: String,
    /// Discovered Model IDs.
    pub models: Vec<DiscoveredModel>,
}

fn normalize_base(input: &str) -> String {
    input.trim().trim_end_matches('/').to_string()
}

/// Probe `{base}/models` and `{base}/v1/models` and return the first that
/// parses as an OpenAI-shaped models response.
///
/// `api_key` is sent as a Bearer token. The key never leaves this function
/// and never appears in returned errors.
pub async fn probe_and_discover(
    http: &reqwest::Client,
    raw_base_url: &str,
    api_key: &str,
) -> AppResult<DiscoveryOk> {
    let base = normalize_base(raw_base_url);

    // Order matters: try the URL as given first. Adding `/v1` is the
    // fallback so users who already include it are respected.
    let candidates: [(&str, String); 2] = [
        ("/models", format!("{base}/models")),
        ("/v1/models", format!("{base}/v1/models")),
    ];

    let mut last_err: Option<AppError> = None;
    for (suffix, url) in candidates {
        match try_discover(http, &url, api_key).await {
            Ok(models) => {
                // The stored Base URL is the prefix such that appending
                // `/chat/completions` works. For the `/v1/models` candidate
                // that's `{base}/v1`; for the bare candidate it's `{base}`.
                let stored_base = match suffix {
                    "/v1/models" => format!("{base}/v1"),
                    _ => base.clone(),
                };
                return Ok(DiscoveryOk {
                    base_url: stored_base,
                    endpoint_path: suffix.to_string(),
                    models,
                });
            }
            Err(e) => last_err = Some(e),
        }
    }

    Err(last_err.unwrap_or_else(|| AppError::Network("no models endpoint succeeded".to_string())))
}

async fn try_discover(
    http: &reqwest::Client,
    url: &str,
    api_key: &str,
) -> AppResult<Vec<DiscoveredModel>> {
    let resp = http
        .get(url)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| AppError::Network(redact_api_key(e.to_string(), api_key)))?;

    if !resp.status().is_success() {
        return Err(AppError::Network(format!("HTTP {}", resp.status())));
    }

    let envelope: ModelsEnvelope = resp
        .json()
        .await
        .map_err(|e| AppError::Protocol(redact_api_key(e.to_string(), api_key)))?;

    Ok(envelope
        .data
        .into_iter()
        .map(|m| DiscoveredModel { id: m.id })
        .collect())
}
