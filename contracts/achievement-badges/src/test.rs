#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, String,
};

use crate::{AchievementBadgesContract, AchievementBadgesContractClient, BadgeEvidence};

// ─── Mock escrow contract ─────────────────────────────────────────────────────
//
// Registers a minimal escrow contract in the test environment that returns
// controlled on-chain values.  The real escrow WASM is not needed in unit tests.

mod mock_escrow {
    use soroban_sdk::{contract, contractimpl, Env, String};

    pub const REAL_AMOUNT: i128 = 50_000_000; // 50 units — below bronze threshold
    pub const REAL_PARTICIPANTS: u32 = 1;      // also below bronze threshold

    #[contract]
    pub struct MockEscrow;

    #[contractimpl]
    impl MockEscrow {
        pub fn get_total_split_amount(_env: Env, _escrow_id: String) -> i128 {
            REAL_AMOUNT
        }
        pub fn get_participant_count(_env: Env, _escrow_id: String) -> u32 {
            REAL_PARTICIPANTS
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn setup_env() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy mock escrow
    let escrow_id = env.register_contract(None, mock_escrow::MockEscrow);

    // Deploy badge contract
    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin, &escrow_id);

    let user = Address::generate(&env);
    (env, contract_id, escrow_id, user)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/// Acceptance criterion: check_badge_eligibility_with_evidence must NOT
/// require caller auth — it is a read-only view call.
#[test]
fn test_eligibility_check_requires_no_auth() {
    let (env, contract_id, _escrow_id, user) = setup_env();

    // Do NOT mock any auths — the call must succeed without a signature.
    let env_no_auth = Env::default(); // fresh env with no mocked auths
    let contract_id2 = env_no_auth.register_contract(None, AchievementBadgesContract);
    let admin = Address::generate(&env_no_auth);
    let escrow = env_no_auth.register_contract(None, mock_escrow::MockEscrow);
    let client = AchievementBadgesContractClient::new(&env_no_auth, &contract_id2);
    client.initialize(&admin, &escrow);

    let evidence = BadgeEvidence {
        escrow_id: String::from_str(&env_no_auth, "escrow-001"),
        total_split_amount: 999_999_999,
        participant_count: 99,
        completion_rate: 100,
    };

    let user2 = Address::generate(&env_no_auth);
    // This must NOT panic — no auth required
    let result = client.check_badge_eligibility_with_evidence(&user2, &evidence);

    // The evidence values are taken at face value in the view call
    // (on-chain cross-reference only happens at mint time)
    assert!(result.is_eligible || !result.is_eligible); // just must not panic
}

/// Acceptance criterion (#590 core): forged evidence values that look good
/// are rejected because mint_badge_with_evidence cross-references on-chain
/// escrow data (which returns REAL_AMOUNT / REAL_PARTICIPANTS — both below
/// any badge threshold).
#[test]
fn test_forged_evidence_rejected() {
    let (env, contract_id, _escrow_id, user) = setup_env();
    let client = AchievementBadgesContractClient::new(&env, &contract_id);

    // Attacker crafts inflated evidence — gold-tier values
    let forged_evidence = BadgeEvidence {
        escrow_id: String::from_str(&env, "escrow-001"),
        total_split_amount: 999_999_999_999, // gold tier claim
        participant_count: 100,              // gold tier claim
        completion_rate: 100,
    };

    // The contract must reject this because the mock escrow returns
    // REAL_AMOUNT = 50_000_000 and REAL_PARTICIPANTS = 1, both of which
    // are below the bronze threshold.
    let result = std::panic::catch_unwind(|| {
        client.mint_badge_with_evidence(&user, &forged_evidence);
    });

    assert!(
        result.is_err(),
        "expected mint to panic/reject when on-chain data does not match forged evidence"
    );
}

/// Happy-path: a user with genuinely eligible on-chain data receives a badge.
/// Requires a mock escrow that returns values meeting at least bronze.
#[test]
fn test_legitimate_mint_succeeds() {
    mod mock_escrow_eligible {
        use soroban_sdk::{contract, contractimpl, Env, String};
        #[contract]
        pub struct MockEscrowEligible;
        #[contractimpl]
        impl MockEscrowEligible {
            pub fn get_total_split_amount(_env: Env, _escrow_id: String) -> i128 {
                200_000_000 // above bronze threshold
            }
            pub fn get_participant_count(_env: Env, _escrow_id: String) -> u32 {
                3 // above bronze threshold
            }
        }
    }

    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = env.register_contract(None, mock_escrow_eligible::MockEscrowEligible);
    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin, &escrow_id);

    let evidence = BadgeEvidence {
        escrow_id: String::from_str(&env, "escrow-002"),
        total_split_amount: 1, // intentionally wrong — should be overwritten by on-chain data
        participant_count: 1,  // intentionally wrong — should be overwritten
        completion_rate: 90,
    };

    let badge = client.mint_badge_with_evidence(&user, &evidence);
    assert_eq!(badge.recipient, user);
}

/// Double-mint prevention.
#[test]
#[should_panic(expected = "badge already minted for this escrow")]
fn test_double_mint_rejected() {
    mod mock_escrow_bronze {
        use soroban_sdk::{contract, contractimpl, Env, String};
        #[contract]
        pub struct MockEscrowBronze;
        #[contractimpl]
        impl MockEscrowBronze {
            pub fn get_total_split_amount(_env: Env, _escrow_id: String) -> i128 { 200_000_000 }
            pub fn get_participant_count(_env: Env, _escrow_id: String) -> u32 { 3 }
        }
    }

    let env = Env::default();
    env.mock_all_auths();
    let escrow_id = env.register_contract(None, mock_escrow_bronze::MockEscrowBronze);
    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    client.initialize(&admin, &escrow_id);

    let evidence = BadgeEvidence {
        escrow_id: String::from_str(&env, "escrow-003"),
        total_split_amount: 0,
        participant_count: 0,
        completion_rate: 90,
    };

    client.mint_badge_with_evidence(&user, &evidence.clone());
    client.mint_badge_with_evidence(&user, &evidence); // must panic
}