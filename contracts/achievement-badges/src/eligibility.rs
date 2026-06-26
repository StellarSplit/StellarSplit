use soroban_sdk::{contracttype, Env, Symbol};

use crate::BadgeEvidence;

// ─── Result type returned by evaluate_eligibility ────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EligibilityResult {
    pub is_eligible: bool,
    pub tier: Symbol,   // "none" | "bronze" | "silver" | "gold"
    pub reason: Symbol, // short machine-readable code
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

/// Minimum on-chain split amount (in stroops / base units) per tier.
const GOLD_MIN_AMOUNT: i128 = 10_000_000_000; // 10 000 XLM-equivalent
const SILVER_MIN_AMOUNT: i128 = 1_000_000_000; //  1 000 XLM-equivalent
const BRONZE_MIN_AMOUNT: i128 = 100_000_000; //    100 XLM-equivalent

/// Minimum participant count per tier.
const GOLD_MIN_PARTICIPANTS: u32 = 10;
const SILVER_MIN_PARTICIPANTS: u32 = 5;
const BRONZE_MIN_PARTICIPANTS: u32 = 2;

/// Minimum completion rate (0–100) required for any badge.
const MIN_COMPLETION_RATE: u32 = 80;

// ─── Core evaluation logic ───────────────────────────────────────────────────

/// Pure evaluation function — receives only already-verified evidence values.
///
/// Called both from `check_badge_eligibility_with_evidence` (raw caller
/// evidence, for preview) and from `mint_badge_with_evidence` (on-chain
/// verified evidence only).
pub fn evaluate_eligibility(env: &Env, evidence: &BadgeEvidence) -> EligibilityResult {
    // Gate on completion rate first
    if evidence.completion_rate < MIN_COMPLETION_RATE {
        return EligibilityResult {
            is_eligible: false,
            tier: Symbol::new(env, "none"),
            reason: Symbol::new(env, "low_completion"),
        };
    }

    // Gate on non-negative amount
    if evidence.total_split_amount <= 0 {
        return EligibilityResult {
            is_eligible: false,
            tier: Symbol::new(env, "none"),
            reason: Symbol::new(env, "invalid_amount"),
        };
    }

    // Determine tier (highest matching wins)
    if evidence.total_split_amount >= GOLD_MIN_AMOUNT
        && evidence.participant_count >= GOLD_MIN_PARTICIPANTS
    {
        return EligibilityResult {
            is_eligible: true,
            tier: Symbol::new(env, "gold"),
            reason: Symbol::new(env, "meets_gold"),
        };
    }

    if evidence.total_split_amount >= SILVER_MIN_AMOUNT
        && evidence.participant_count >= SILVER_MIN_PARTICIPANTS
    {
        return EligibilityResult {
            is_eligible: true,
            tier: Symbol::new(env, "silver"),
            reason: Symbol::new(env, "meets_silver"),
        };
    }

    if evidence.total_split_amount >= BRONZE_MIN_AMOUNT
        && evidence.participant_count >= BRONZE_MIN_PARTICIPANTS
    {
        return EligibilityResult {
            is_eligible: true,
            tier: Symbol::new(env, "bronze"),
            reason: Symbol::new(env, "meets_bronze"),
        };
    }

    EligibilityResult {
        is_eligible: false,
        tier: Symbol::new(env, "none"),
        reason: Symbol::new(env, "below_threshold"),
    }
}
