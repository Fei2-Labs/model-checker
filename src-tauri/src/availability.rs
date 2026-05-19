//! Availability Test: a minimal chat-completion probe against the selected
//! or inferred Test Model.
//!
//! The prompt and parameters are fixed by domain decision: a single user
//! message asking for the word `OK`, with `max_tokens: 5` and `temperature:
//! 0`. Any 2xx response with a parseable `choices[0].message.content` counts
//! as success.

use std::time::Instant;

use serde::Deserialize;
use serde_json::json;

use crate::http_util::redact_api_key;

/// Successful Availability Test outcome.
pub struct AvailabilityOk {
    pub latency_ms: u64,
}

/// Failed Availability Test outcome — already sanitized for display.
pub struct AvailabilityErr {
    pub sanitized_error: String,
    pub latency_ms: u64,
}

#[derive(Debug, Deserialize)]
struct ChatResp {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize)]
struct Message {
    #[serde(default)]
    content: Option<String>,
}

/// POST `{base_url}/chat/completions` with the canonical Availability Test
/// payload.
pub async fn run_availability(
    http: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    test_model: &str,
) -> Result<AvailabilityOk, AvailabilityErr> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let body = json!({
        "model": test_model,
        "messages": [
            { "role": "user", "content": "Reply with the single word OK." }
        ],
        "max_tokens": 5,
        "temperature": 0,
    });

    let started = Instant::now();
    let resp = http
        .post(&url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| AvailabilityErr {
            sanitized_error: redact_api_key(e.to_string(), api_key),
            latency_ms: started.elapsed().as_millis() as u64,
        })?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(AvailabilityErr {
            sanitized_error: redact_api_key(format!("HTTP {status}: {text}"), api_key),
            latency_ms: started.elapsed().as_millis() as u64,
        });
    }

    let parsed: ChatResp = resp.json().await.map_err(|e| AvailabilityErr {
        sanitized_error: redact_api_key(e.to_string(), api_key),
        latency_ms: started.elapsed().as_millis() as u64,
    })?;

    let content = parsed
        .choices
        .first()
        .and_then(|c| c.message.content.as_deref())
        .unwrap_or("")
        .trim();

    let latency_ms = started.elapsed().as_millis() as u64;
    if content.is_empty() {
        return Err(AvailabilityErr {
            sanitized_error: "chat completion returned no content".to_string(),
            latency_ms,
        });
    }

    Ok(AvailabilityOk { latency_ms })
}
