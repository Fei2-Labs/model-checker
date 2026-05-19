//! Compatibility Status state machine.
//!
//! All transitions live here so the rules from `CONTEXT.md` exist in exactly
//! one place. In particular: a failed Model Inventory Check must never
//! overwrite a prior `Available` status.

use super::CompatibilityStatus;

/// Outcome of a Model Inventory Check.
pub enum RefreshOutcome {
    /// Models were discovered successfully and a unique Test Model could be
    /// inferred (or one was already configured).
    SuccessWithTestModel,
    /// Models were discovered, but no safe Test Model could be inferred and
    /// the user has not configured one.
    SuccessNeedsTestModel,
    /// The refresh itself failed (network, auth, parse, timeout).
    Failed,
}

/// Outcome of an Availability Test.
pub enum TestOutcome {
    /// The Test Model produced a parseable chat completion response.
    Success,
    /// The chat completion failed but we already had a successful Model
    /// Inventory on file for this connection.
    FailedWithPriorDiscovery,
    /// The chat completion failed and we never had a successful Model
    /// Inventory either.
    FailedHard,
    /// No Test Model is configured and inference is not safe — no request
    /// was attempted.
    NoSafeTestModel,
}

/// Compute the new Compatibility Status after a Model Inventory Check.
///
/// `current` is the status **before** the refresh started. A failed refresh
/// must not overwrite `Available`.
pub fn transition_after_refresh(
    current: CompatibilityStatus,
    outcome: RefreshOutcome,
) -> CompatibilityStatus {
    match outcome {
        RefreshOutcome::SuccessWithTestModel => match current {
            // Keep proven statuses; otherwise we're back to needing a real
            // Availability Test to decide.
            CompatibilityStatus::Available | CompatibilityStatus::PartiallyCompatible => current,
            _ => CompatibilityStatus::Untested,
        },
        RefreshOutcome::SuccessNeedsTestModel => CompatibilityStatus::NeedsTestModel,
        RefreshOutcome::Failed => match current {
            // CONTEXT.md: Refresh Failed must not overwrite a previously
            // Available status.
            CompatibilityStatus::Available => CompatibilityStatus::Available,
            _ => CompatibilityStatus::RefreshFailed,
        },
    }
}

/// Compute the new Compatibility Status after an Availability Test.
pub fn transition_after_test(outcome: TestOutcome) -> CompatibilityStatus {
    match outcome {
        TestOutcome::Success => CompatibilityStatus::Available,
        TestOutcome::FailedWithPriorDiscovery => CompatibilityStatus::PartiallyCompatible,
        TestOutcome::FailedHard => CompatibilityStatus::Unavailable,
        TestOutcome::NoSafeTestModel => CompatibilityStatus::NeedsTestModel,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Core rule from CONTEXT.md: Refresh Failed must not demote Available.
    #[test]
    fn refresh_failed_does_not_overwrite_available() {
        let next = transition_after_refresh(CompatibilityStatus::Available, RefreshOutcome::Failed);
        assert_eq!(next, CompatibilityStatus::Available);
    }

    #[test]
    fn refresh_failed_overrides_untested() {
        let next = transition_after_refresh(CompatibilityStatus::Untested, RefreshOutcome::Failed);
        assert_eq!(next, CompatibilityStatus::RefreshFailed);
    }

    #[test]
    fn refresh_success_without_test_model_yields_needs_test_model() {
        let next = transition_after_refresh(
            CompatibilityStatus::Untested,
            RefreshOutcome::SuccessNeedsTestModel,
        );
        assert_eq!(next, CompatibilityStatus::NeedsTestModel);
    }

    #[test]
    fn refresh_success_preserves_available() {
        let next = transition_after_refresh(
            CompatibilityStatus::Available,
            RefreshOutcome::SuccessWithTestModel,
        );
        assert_eq!(next, CompatibilityStatus::Available);
    }

    #[test]
    fn test_success_yields_available() {
        assert_eq!(
            transition_after_test(TestOutcome::Success),
            CompatibilityStatus::Available
        );
    }

    #[test]
    fn test_failure_with_prior_discovery_is_partially_compatible() {
        assert_eq!(
            transition_after_test(TestOutcome::FailedWithPriorDiscovery),
            CompatibilityStatus::PartiallyCompatible
        );
    }

    #[test]
    fn test_failure_hard_is_unavailable() {
        assert_eq!(
            transition_after_test(TestOutcome::FailedHard),
            CompatibilityStatus::Unavailable
        );
    }
}
