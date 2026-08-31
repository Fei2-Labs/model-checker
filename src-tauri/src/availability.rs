//! Availability Test: a minimal chat-completion probe against the selected
//! or inferred Test Model.
//!
//! The prompt and parameters are fixed by domain decision: a single user
//! message asking for the word `OK`, with `max_tokens: 5`. `temperature` is
//! intentionally omitted — newer models (e.g. Claude Sonnet 5) reject it with
//! HTTP 400 `temperature is deprecated for this model`, which would fail the
//! probe. Any 2xx response with a parseable `choices[0].message.content`
//! counts as success.

use std::time::Instant;

use serde::Deserialize;
use serde_json::json;

use crate::domain::AvailabilityProtocol;
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
    #[serde(default)]
    reasoning_content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicResp {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResponsesResp {
    output: Vec<ResponsesItem>,
    #[serde(default)]
    output_text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResponsesItem {
    #[serde(default)]
    content: Vec<ResponsesContent>,
}

#[derive(Debug, Deserialize)]
struct ResponsesContent {
    #[serde(default)]
    text: Option<String>,
}

/// POST `{base_url}/chat/completions` with the canonical Availability Test
/// payload.
pub async fn run_availability(
    http: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    test_model: &str,
    protocol: AvailabilityProtocol,
) -> Result<AvailabilityOk, AvailabilityErr> {
    let url = format!(
        "{}{}",
        base_url.trim_end_matches('/'),
        protocol.endpoint_path()
    );
    let body = request_body(protocol, test_model);

    let started = Instant::now();
    let mut request = http.post(&url).json(&body);
    if matches!(protocol, AvailabilityProtocol::AnthropicMessages) {
        request = request
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01");
    } else {
        request = request.bearer_auth(api_key);
    }
    let resp = request.send().await.map_err(|e| AvailabilityErr {
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

    let text = match protocol {
        AvailabilityProtocol::ChatCompletions => {
            let parsed: ChatResp =
                parse_json(resp, api_key, started.elapsed().as_millis() as u64).await?;
            let msg = parsed.choices.first().map(|c| &c.message);
            let content = msg.and_then(|m| m.content.as_deref()).unwrap_or("");
            let reasoning = msg
                .and_then(|m| m.reasoning_content.as_deref())
                .unwrap_or("");
            !content.trim().is_empty() || !reasoning.trim().is_empty()
        }
        AvailabilityProtocol::AnthropicMessages => {
            let parsed: AnthropicResp =
                parse_json(resp, api_key, started.elapsed().as_millis() as u64).await?;
            parsed
                .content
                .iter()
                .filter_map(|item| item.text.as_deref())
                .any(|text| !text.trim().is_empty())
        }
        AvailabilityProtocol::Responses => {
            let parsed: ResponsesResp =
                parse_json(resp, api_key, started.elapsed().as_millis() as u64).await?;
            parsed
                .output
                .iter()
                .flat_map(|item| item.content.iter())
                .filter_map(|item| item.text.as_deref())
                .any(|text| !text.trim().is_empty())
                || parsed
                    .output_text
                    .as_deref()
                    .is_some_and(|text| !text.trim().is_empty())
        }
    };

    let latency_ms = started.elapsed().as_millis() as u64;
    if !text {
        return Err(AvailabilityErr {
            sanitized_error: format!("{} returned no content", protocol.endpoint_path()),
            latency_ms,
        });
    }

    Ok(AvailabilityOk { latency_ms })
}

fn request_body(protocol: AvailabilityProtocol, test_model: &str) -> serde_json::Value {
    match protocol {
        AvailabilityProtocol::ChatCompletions => json!({
            "model": test_model,
            "messages": [{ "role": "user", "content": "Reply with the single word OK." }],
            "max_tokens": 5,
        }),
        AvailabilityProtocol::AnthropicMessages => json!({
            "model": test_model,
            "max_tokens": 5,
            "messages": [{ "role": "user", "content": "Reply with the single word OK." }],
        }),
        AvailabilityProtocol::Responses => json!({
            "model": test_model,
            "input": "Reply with the single word OK.",
            "max_output_tokens": 5,
        }),
    }
}

async fn parse_json<T: for<'de> Deserialize<'de>>(
    resp: reqwest::Response,
    api_key: &str,
    latency_ms: u64,
) -> Result<T, AvailabilityErr> {
    resp.json().await.map_err(|e| AvailabilityErr {
        sanitized_error: redact_api_key(e.to_string(), api_key),
        latency_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_shapes_are_protocol_specific() {
        let chat = request_body(AvailabilityProtocol::ChatCompletions, "model");
        assert!(chat.get("messages").is_some());
        assert!(chat.get("input").is_none());

        let anthropic = request_body(AvailabilityProtocol::AnthropicMessages, "model");
        assert_eq!(anthropic["max_tokens"], 5);
        assert!(anthropic.get("max_output_tokens").is_none());

        let responses = request_body(AvailabilityProtocol::Responses, "model");
        assert_eq!(responses["max_output_tokens"], 5);
        assert!(responses.get("messages").is_none());
    }

    #[test]
    fn response_parsers_require_usable_text() {
        let chat: ChatResp = serde_json::from_str(
            r#"{"choices":[{"message":{"content":" ","reasoning_content":"reason"}}]}"#,
        )
        .expect("chat response");
        assert!(chat.choices[0]
            .message
            .reasoning_content
            .as_deref()
            .is_some_and(|text| !text.trim().is_empty()));

        let anthropic: AnthropicResp =
            serde_json::from_str(r#"{"content":[{"type":"text","text":"OK"}]}"#)
                .expect("anthropic response");
        assert!(anthropic
            .content
            .iter()
            .any(|item| item.text.as_deref() == Some("OK")));

        let empty: ResponsesResp =
            serde_json::from_str(r#"{"output":[]}"#).expect("empty response");
        assert!(empty.output.is_empty());
        assert!(empty.output_text.is_none());
    }

    #[test]
    fn protocol_paths_are_stable() {
        assert_eq!(
            AvailabilityProtocol::ChatCompletions.endpoint_path(),
            "/chat/completions"
        );
        assert_eq!(
            AvailabilityProtocol::AnthropicMessages.endpoint_path(),
            "/messages"
        );
        assert_eq!(
            AvailabilityProtocol::Responses.endpoint_path(),
            "/responses"
        );
    }
}
