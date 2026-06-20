//! # Eligibility Provider Module
//!
//! This module extracts badge eligibility evaluation into a dedicated provider
//! with real achievement evidence rather than mock assumptions.

use crate::types::*;
use soroban_sdk::contracttype;

/// Real achievement evidence for eligibility evaluation
#[contracttype]
#[derive(Clone, Debug)]
pub struct AchievementEvidence {
    /// Number of splits created by the user
    pub splits_created: u32,
    /// Number of splits the user has participated in
    pub splits_participated: u32,
    /// Total amount spent in splits (in the smallest unit)
    pub total_amount_spent: u128,
    /// Number of settlements completed
    pub settlements_completed: u32,
    /// Number of groups managed by user
    pub groups_managed: u32,
}

/// Eligibility evaluation result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EligibilityResult {
    Eligible,
    NotEligible, // Evidence does not meet badge criteria
}

// ============================================================================
// Eligibility Evaluators for Each Badge Type
// ============================================================================

/// Check eligibility for FirstSplitCreator badge
pub fn evaluate_first_split_creator(evidence: &AchievementEvidence) -> EligibilityResult {
    if evidence.splits_created >= 1 {
        EligibilityResult::Eligible
    } else {
        EligibilityResult::NotEligible
    }
}

/// Check eligibility for HundredSplitsParticipated badge
pub fn evaluate_hundred_splits_participated(evidence: &AchievementEvidence) -> EligibilityResult {
    if evidence.splits_participated >= 100 {
        EligibilityResult::Eligible
    } else {
        EligibilityResult::NotEligible
    }
}

/// Check eligibility for BigSpender badge
pub fn evaluate_big_spender(evidence: &AchievementEvidence, threshold: u128) -> EligibilityResult {
    if evidence.total_amount_spent >= threshold {
        EligibilityResult::Eligible
    } else {
        EligibilityResult::NotEligible
    }
}

/// Check eligibility for FrequentSettler badge
pub fn evaluate_frequent_settler(evidence: &AchievementEvidence) -> EligibilityResult {
    if evidence.settlements_completed >= 50 {
        EligibilityResult::Eligible
    } else {
        EligibilityResult::NotEligible
    }
}

/// Check eligibility for GroupLeader badge
pub fn evaluate_group_leader(evidence: &AchievementEvidence) -> EligibilityResult {
    if evidence.groups_managed >= 1 {
        EligibilityResult::Eligible
    } else {
        EligibilityResult::NotEligible
    }
}

// ============================================================================
// Main Eligibility Provider
// ============================================================================

/// Evaluate badge eligibility based on provided evidence
///
/// This is the main entry point for eligibility evaluation. It takes explicit
/// achievement evidence and evaluates whether the user meets the criteria for
/// a specific badge type.
///
/// The evaluation is deterministic and based purely on the evidence data,
/// not on mock assumptions. Real achievement evidence must be provided
/// to back the minting decision.
pub fn evaluate_eligibility(
    badge_type: &BadgeType,
    evidence: &AchievementEvidence,
    big_spender_threshold: u128,
) -> EligibilityResult {
    match badge_type {
        BadgeType::FirstSplitCreator => evaluate_first_split_creator(evidence),
        BadgeType::HundredSplitsParticipated => evaluate_hundred_splits_participated(evidence),
        BadgeType::BigSpender => evaluate_big_spender(evidence, big_spender_threshold),
        BadgeType::FrequentSettler => evaluate_frequent_settler(evidence),
        BadgeType::GroupLeader => evaluate_group_leader(evidence),
    }
}
