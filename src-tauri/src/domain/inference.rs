//! Test Model inference for a Saved Connection.
//!
//! Strategy (from the task PRD): filter Discovered Model IDs (lowercased)
//! against a single denylist and accept the result only when exactly one
//! candidate remains. Anything else falls back to `Needs Test Model`.

use super::DiscoveredModel;

/// Single source of truth for non-chat-capable substrings.
///
/// Matching is substring + lowercased.
pub const CHAT_DENYLIST: &[&str] = &[
    "embed",
    "embedding",
    "tts",
    "whisper",
    "dall-e",
    "moderation",
    "rerank",
    "image",
    "audio",
];

/// Outcome of the Test Model inference routine.
#[derive(Debug, PartialEq, Eq)]
pub enum InferenceOutcome {
    /// Exactly one chat-capable candidate survived filtering.
    Inferred(String),
    /// Inference is not safe: zero or multiple candidates survived.
    NeedsTestModel,
}

/// Decide which Discovered Model should be used for an Availability Test.
///
/// Returns [`InferenceOutcome::Inferred`] only when exactly one model ID
/// remains after applying [`CHAT_DENYLIST`].
pub fn infer_test_model(models: &[DiscoveredModel]) -> InferenceOutcome {
    let candidates: Vec<&str> = models
        .iter()
        .map(|m| m.id.as_str())
        .filter(|id| {
            let lower = id.to_lowercase();
            !CHAT_DENYLIST.iter().any(|deny| lower.contains(deny))
        })
        .collect();

    match candidates.as_slice() {
        [only] => InferenceOutcome::Inferred((*only).to_string()),
        _ => InferenceOutcome::NeedsTestModel,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn m(id: &str) -> DiscoveredModel {
        DiscoveredModel { id: id.to_string() }
    }

    /// Good case: a clear unique match — exactly one non-denylisted model.
    #[test]
    fn good_unique_chat_candidate_is_inferred() {
        let inv = vec![
            m("text-embedding-ada-002"),
            m("whisper-1"),
            m("gpt-4o-mini"),
        ];
        assert_eq!(
            infer_test_model(&inv),
            InferenceOutcome::Inferred("gpt-4o-mini".into())
        );
    }

    /// Base case: every model is denylisted — must fall back to Needs Test
    /// Model rather than guessing.
    #[test]
    fn base_all_denylisted_needs_test_model() {
        let inv = vec![
            m("text-embedding-3-small"),
            m("whisper-1"),
            m("dall-e-3"),
            m("text-moderation-latest"),
        ];
        assert_eq!(infer_test_model(&inv), InferenceOutcome::NeedsTestModel);
    }

    /// Bad case: multiple chat-shaped survivors — must NOT guess; falls back.
    #[test]
    fn bad_multiple_candidates_needs_test_model() {
        let inv = vec![m("gpt-4o"), m("gpt-4o-mini"), m("text-embedding-3-small")];
        assert_eq!(infer_test_model(&inv), InferenceOutcome::NeedsTestModel);
    }

    /// Empty inventory should also be NeedsTestModel, never a panic.
    #[test]
    fn empty_inventory_needs_test_model() {
        assert_eq!(infer_test_model(&[]), InferenceOutcome::NeedsTestModel);
    }

    /// Denylist matching is substring + case-insensitive.
    #[test]
    fn denylist_is_case_insensitive_substring() {
        let inv = vec![m("Provider-Embedding-V2"), m("my-Whisper-XL"), m("chat-7b")];
        assert_eq!(
            infer_test_model(&inv),
            InferenceOutcome::Inferred("chat-7b".into())
        );
    }
}
