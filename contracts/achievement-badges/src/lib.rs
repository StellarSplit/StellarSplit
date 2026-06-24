#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec,
};

mod eligibility;
mod storage;

// Import the escrow contract client (generated from its interface)
mod escrow {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32-unknown-unknown/release/split_escrow.wasm"
    );
}

use eligibility::{evaluate_eligibility, EligibilityResult};
use storage::{
    get_admin, get_escrow_contract, has_badge, save_badge, set_admin,
    set_escrow_contract,
};

// ─── Data Types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct BadgeEvidence {
    pub escrow_id: String,
    pub total_split_amount: i128,
    pub participant_count: u32,
    pub completion_rate: u32, // 0–100
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Badge {
    pub id: Symbol,
    pub recipient: Address,
    pub tier: Symbol,
    pub evidence_escrow_id: String,
    pub minted_at: u64,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct AchievementBadgesContract;

#[contractimpl]
impl AchievementBadgesContract {
    /// Initialize contract with an admin and the trusted escrow contract address.
    pub fn initialize(env: Env, admin: Address, escrow_contract: Address) {
        admin.require_auth();
        set_admin(&env, &admin);
        set_escrow_contract(&env, &escrow_contract);
    }

    /// Read-only eligibility check — no auth required.
    ///
    /// This function evaluates real achievement evidence against badge criteria.
    /// It takes explicit contract inputs to back the eligibility decision.
    pub fn check_eligibility_with_evidence(
        env: Env,
        user: Address,           // kept for context / logging, no auth required
        evidence: BadgeEvidence,
    /// This function evaluates real achievement evidence against badge criteria.
    /// It takes explicit contract inputs to back the eligibility decision.
    pub fn check_badge_eligibility(
        _env: Env,
        user: Address,
        badge_type: BadgeType,
        evidence: AchievementEvidence,
    ) -> EligibilityResult {
        // No auth — this is a view call
        let _ = user; // suppress unused warning; address is available for logging
        evaluate_eligibility(&env, &evidence)
    }

    /// Mint a badge for the caller, verifying evidence against on-chain escrow
    /// data instead of trusting caller-supplied values.
    ///
    /// FIX (#590):
    ///  - Calls escrow contract to fetch verified split data.
    ///  - Passes on-chain values to `evaluate_eligibility`, ignoring
    ///    caller-supplied `total_split_amount` and `participant_count`.
    ///  - Rejects the transaction if on-chain data does not meet the threshold.
    pub fn mint_badge_with_evidence(
    /// This function mints a new badge NFT if:
    /// 1. The user hasn't already minted this badge type
    /// 2. The provided evidence meets the badge eligibility criteria
    pub fn mint_badge(
        env: Env,
        user: Address,
        evidence: BadgeEvidence, // escrow_id and completion_rate still used; amounts overwritten
    ) -> Badge {
        // Require the actual user to sign the mint (write operation)
        user.require_auth();

        // Prevent double-minting
        if has_badge(&env, &user, &evidence.escrow_id) {
            panic!("badge already minted for this escrow");
        }

        // ── On-chain verification ────────────────────────────────────────────
        // Load the trusted escrow contract address from storage (set at init).
        // This cannot be forged by the caller.
        let escrow_address = get_escrow_contract(&env);
        let escrow_client = escrow::Client::new(&env, &escrow_address);

        // Query verified totals directly from the escrow contract.
        let on_chain_total = escrow_client.get_total_split_amount(&evidence.escrow_id);
        let on_chain_participants = escrow_client.get_participant_count(&evidence.escrow_id);

        // Build a verified evidence struct using on-chain values only.
        // The caller's claimed amounts are discarded — only escrow_id and
        // completion_rate (validated separately below) survive.
        let verified_evidence = BadgeEvidence {
            escrow_id: evidence.escrow_id.clone(),
            total_split_amount: on_chain_total,   // ← on-chain, not caller-supplied
            participant_count: on_chain_participants, // ← on-chain, not caller-supplied
            completion_rate: evidence.completion_rate,
        };

        // Evaluate eligibility using only verified on-chain data
        let result = evaluate_eligibility(&env, &verified_evidence);
        if !result.is_eligible {
            panic!("eligibility check failed: on-chain data does not meet badge threshold");
        // Evaluate eligibility based on evidence
        let big_spender_threshold = 1_000_000_000; // Configurable threshold
        let eligibility_result =
            eligibility::evaluate_eligibility(&badge_type, &evidence, big_spender_threshold);

        match eligibility_result {
            EligibilityResult::Eligible => {
                // Generate token ID
                let token_id = storage::get_next_token_id(&env);

                // Create user badge record
                let badge = UserBadge {
                    badge_type: badge_type.clone(),
                    token_id: token_id,
                    minted_at: env.ledger().timestamp(),
                };

                // Store the badge
                storage::add_user_badge(&env, &user, &badge);
                storage::set_minted_badge(&env, &user, &badge_type);

                // Emit minting event
                events::emit_badge_minted(&env, &user, &badge_type, &token_id);

                Ok(token_id)
            }
            EligibilityResult::NotEligible => Err(BadgeError::NotEligible),
        }

        // Mint and persist
        let badge = Badge {
            id: Symbol::new(&env, "badge"),
            recipient: user.clone(),
            tier: result.tier,
            evidence_escrow_id: evidence.escrow_id.clone(),
            minted_at: env.ledger().timestamp(),
        };

        save_badge(&env, &user, &evidence.escrow_id, &badge);
        badge
    }

    /// Admin-only: revoke a previously minted badge.
    pub fn revoke_badge(env: Env, admin: Address, user: Address, escrow_id: String) {
        admin.require_auth();
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            panic!("unauthorized: caller is not admin");
    // ========================================================================
    // Stable API for Standardized Metadata & Ownership Information
    // ========================================================================

    /// Get standardized metadata for a badge type
    ///
    /// Returns consistent, well-formatted metadata through a stable API.
    /// This is the recommended way to retrieve badge metadata.
    pub fn badge_metadata_standard(env: Env, badge_type: BadgeType) -> BadgeMetadata {
        metadata::get_metadata_for_badge(&env, &badge_type)
    }

    /// Get complete ownership information for a specific badge
    ///
    /// Returns detailed ownership info including owner, token ID, badge type,
    /// mint timestamp, and standardized metadata.
    pub fn get_badge_ownership(
        env: Env,
        user: Address,
        badge_type: BadgeType,
    ) -> Option<BadgeOwnershipInfo> {
        // Get user's badges
        let user_badges = storage::get_user_badges(&env, &user);

        // Find the badge of the specified type
        for badge in &user_badges {
            if &badge.badge_type == &badge_type {
                return Some(BadgeOwnershipInfo::from_user_badge(&env, user, &badge));
            }
        }

        None
    }

    /// Get comprehensive badge collection information for a user
    ///
    /// Returns all badges owned by a user with standardized metadata
    /// and a summary of the collection.
    pub fn get_user_badge_collection(env: Env, user: Address) -> UserBadgeCollection {
        let user_badges = storage::get_user_badges(&env, &user);
        let badge_count = user_badges.len() as u32;

        let mut badges: Vec<BadgeOwnershipInfo> = Vec::new(&env);
        for user_badge in &user_badges {
            badges.push_back(BadgeOwnershipInfo::from_user_badge(
                &env,
                user.clone(),
                &user_badge,
            ));
        }

        UserBadgeCollection {
            owner: user,
            badge_count,
            badges,
        }
        storage::remove_badge(&env, &user, &escrow_id);
    }

    /// View: check whether a user holds a badge for a given escrow.
    pub fn has_badge(env: Env, user: Address, escrow_id: String) -> bool {
        has_badge(&env, &user, &escrow_id)
    }
}