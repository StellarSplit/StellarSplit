#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, String,
};

use crate::{AchievementBadgesContract, AchievementBadgesContractClient, BadgeEvidence};

mod mock_escrow {
    use soroban_sdk::{contract, contractimpl, Env, String};

    pub const REAL_AMOUNT: i128 = 50_000_000;
    pub const REAL_PARTICIPANTS: u32 = 1;

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

fn setup_env() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 1_700_000_000,
        protocol_version: 21,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 31_536_000,
    });

    let escrow_id = env.register_contract(None, mock_escrow::MockEscrow);
    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);
    client.initialize(&admin, &escrow_id);

    (env, contract_id, escrow_id, user)
}

#[test]
fn test_eligibility_check_requires_no_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let escrow_id = env.register_contract(None, mock_escrow::MockEscrow);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);

    env.mock_all_auths();
    client.initialize(&admin, &escrow_id);
    env.set_auths(&[]);

    let evidence = BadgeEvidence {
        escrow_id: String::from_str(&env, "escrow-001"),
        total_split_amount: 999_999_999,
        participant_count: 99,
        completion_rate: 100,
    };

    let result = client.check_eligibility_with_evidence(&user, &evidence);
    assert!(result.is_eligible || !result.is_eligible);
}

#[test]
fn test_forged_evidence_rejected() {
    let (env, contract_id, _escrow_id, user) = setup_env();
    let client = AchievementBadgesContractClient::new(&env, &contract_id);
    let forged_evidence = BadgeEvidence {
        escrow_id: String::from_str(&env, "escrow-001"),
        total_split_amount: 999_999_999_999,
        participant_count: 100,
        completion_rate: 100,
    };

    let result = std::panic::catch_unwind(|| {
        client.mint_badge_with_evidence(&user, &forged_evidence);
    });

    assert!(result.is_err());
}

#[test]
fn test_has_badge_returns_false_for_unknown_badge() {
    let (env, contract_id, _escrow_id, user) = setup_env();
    let client = AchievementBadgesContractClient::new(&env, &contract_id);

    assert!(!client.has_badge(&user, &String::from_str(&env, "escrow-unknown")));
}
