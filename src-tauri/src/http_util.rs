//! Shared helpers for HTTP-based subsystems (Model Discovery and Availability
//! Test).
//!
//! The single responsibility of this module is to ensure Authentication
//! Material never appears in any error string surfaced to the frontend.
//! Centralizing the redaction means every HTTP error path goes through the
//! same sanitizer instead of duplicating the substitution.

/// Redact an Authentication Material substring out of any error display.
///
/// Reqwest does not leak `Authorization` headers in its own `Display`
/// implementation, but defense in depth is cheap: if any caller ever
/// stringifies a payload that embeds the API key, this catches it.
pub fn redact_api_key(raw: impl Into<String>, api_key: &str) -> String {
    let raw = raw.into();
    if !api_key.is_empty() && raw.contains(api_key) {
        raw.replace(api_key, "[REDACTED]")
    } else {
        raw
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_when_key_appears_in_message() {
        let redacted = redact_api_key("auth failed for sk-secret-123 token", "sk-secret-123");
        assert_eq!(redacted, "auth failed for [REDACTED] token");
    }

    #[test]
    fn passes_through_when_key_absent() {
        let redacted = redact_api_key("HTTP 500 internal", "sk-secret-123");
        assert_eq!(redacted, "HTTP 500 internal");
    }

    #[test]
    fn empty_api_key_never_redacts() {
        // An empty needle would otherwise match everywhere — guard against it.
        let redacted = redact_api_key("anything goes here", "");
        assert_eq!(redacted, "anything goes here");
    }
}
