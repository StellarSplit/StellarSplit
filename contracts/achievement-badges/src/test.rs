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

// ─── Helpers ──────────────────────────────────────────────────────────────────

use crate::{
    AchievementBadgesContract, AchievementBadgesContractClient, AchievementEvidence, BadgeType,
    EligibilityResult,
};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

/// Helper to build achievement evidence that satisfies every badge criterion.
fn qualifying_evidence() -> AchievementEvidence {
    AchievementEvidence {
        splits_created: 1,
        splits_participated: 100,
        total_amount_spent: 1_000_000_000,
        settlements_completed: 50,
        groups_managed: 1,
    }
}

/// Helper to create a test environment and contract client
fn setup_test() -> (Env, Address, AchievementBadgesContractClient<'static>) {
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
fn test_initialize() {
    let (_env, admin, client) = setup_test();

    client.initialize(&admin);
}

/// Acceptance criterion: check_badge_eligibility_with_evidence must NOT
/// require caller auth — it is a read-only view call.
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

    let user2 = Address::generate(&env);
    // This must NOT panic — no auth required
    let result = client.check_eligibility_with_evidence(&user2, &evidence);

    // The evidence values are taken at face value in the view call
    // (on-chain cross-reference only happens at mint time)
    assert!(result.is_eligible || !result.is_eligible); // just must not panic
}
fn test_check_badge_eligibility() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin);

    let evidence_creator = AchievementEvidence {
        splits_created: 1,
        splits_participated: 0,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 0,
    };
    let evidence_century = AchievementEvidence {
        splits_created: 0,
        splits_participated: 100,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 0,
    };
    let evidence_spender = AchievementEvidence {
        splits_created: 0,
        splits_participated: 0,
        total_amount_spent: 1_000_000_000,
        settlements_completed: 0,
        groups_managed: 0,
    };
    let evidence_settler = AchievementEvidence {
        splits_created: 0,
        splits_participated: 0,
        total_amount_spent: 0,
        settlements_completed: 50,
        groups_managed: 0,
    };
    let evidence_leader = AchievementEvidence {
        splits_created: 0,
        splits_participated: 0,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 1,
    };

    assert_eq!(
        client.check_eligibility_with_evidence(
            &user,
            &BadgeType::FirstSplitCreator,
            &evidence_creator
        ),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_eligibility_with_evidence(
            &user,
            &BadgeType::HundredSplitsParticipated,
            &evidence_century
        ),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_eligibility_with_evidence(&user, &BadgeType::BigSpender, &evidence_spender),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_eligibility_with_evidence(
            &user,
            &BadgeType::FrequentSettler,
            &evidence_settler
        ),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_eligibility_with_evidence(&user, &BadgeType::GroupLeader, &evidence_leader),
        EligibilityResult::Eligible
    );
}

#[test]
fn test_forged_evidence_rejected() {
    let (env, contract_id, _escrow_id, user) = setup_env();
    let client = AchievementBadgesContractClient::new(&env, &contract_id);
fn test_mint_badge() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin);

    let evidence = AchievementEvidence {
        splits_created: 1,
        splits_participated: 0,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 0,
    };

    // Mint first badge
    let token_id = client.mint_badge_with_evidence(&user, &BadgeType::FirstSplitCreator, &evidence);
    assert_eq!(token_id, 1u64);

    // Attacker crafts inflated evidence — gold-tier values
    let forged_evidence = BadgeEvidence {
        escrow_id: String::from_str(&env, "escrow-001"),
        total_split_amount: 999_999_999_999,
        participant_count: 100,
        completion_rate: 100,
    };

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

    let evidence = AchievementEvidence {
        splits_created: 1,
        splits_participated: 0,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 0,
    };

    // Mint a badge
    client.mint_badge_with_evidence(&user, &BadgeType::FirstSplitCreator, &evidence);

    // Try to mint the same badge again (should fail)
    let result =
        client.try_mint_badge_with_evidence(&user, &BadgeType::FirstSplitCreator, &evidence);
    assert!(result.is_err());
}

    let escrow_id = env.register_contract(None, mock_escrow_eligible::MockEscrowEligible);
    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin, &escrow_id);
    client.initialize(&admin);

    let evidence_creator = AchievementEvidence {
        splits_created: 1,
        splits_participated: 0,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 0,
    };
    let evidence_century = AchievementEvidence {
        splits_created: 0,
        splits_participated: 100,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 0,
    };
    let evidence_spender = AchievementEvidence {
        splits_created: 0,
        splits_participated: 0,
        total_amount_spent: 1_000_000_000,
        settlements_completed: 0,
        groups_managed: 0,
    };

    // Mint multiple different badges
    client.mint_badge_with_evidence(&user, &BadgeType::FirstSplitCreator, &evidence_creator);
    client.mint_badge_with_evidence(
        &user,
        &BadgeType::HundredSplitsParticipated,
        &evidence_century,
    );
    client.mint_badge_with_evidence(&user, &BadgeType::BigSpender, &evidence_spender);

    // Check that user has all three badges
    let user_badges = client.get_user_badges(&user);
    assert_eq!(user_badges.len(), 3);

    // Check token IDs are unique
    assert_eq!(user_badges.get(0).unwrap().token_id, 1u64);
    assert_eq!(user_badges.get(1).unwrap().token_id, 2u64);
    assert_eq!(user_badges.get(2).unwrap().token_id, 3u64);
}

/// Double-mint prevention.
#[test]
fn test_has_badge_returns_false_for_unknown_badge() {
    let (env, contract_id, _escrow_id, user) = setup_env();
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
    client.initialize(&admin);

    // Test metadata for each badge type
    let metadata = client.get_badge_metadata(&BadgeType::FirstSplitCreator);
    assert_eq!(metadata.name, String::from_str(&env, "First Split Creator"));
    assert_eq!(
        metadata.description,
        String::from_str(&env, "Awarded for creating your first split")
    );
    assert_eq!(metadata.badge_type, BadgeType::FirstSplitCreator);

    let metadata = client.get_badge_metadata(&BadgeType::HundredSplitsParticipated);
    assert_eq!(metadata.name, String::from_str(&env, "Century Club"));
    assert_eq!(
        metadata.description,
        String::from_str(&env, "Participated in 100 splits")
    );
    assert_eq!(metadata.badge_type, BadgeType::HundredSplitsParticipated);

    let metadata = client.get_badge_metadata(&BadgeType::BigSpender);
    assert_eq!(metadata.name, String::from_str(&env, "Big Spender"));
    assert_eq!(
        metadata.description,
        String::from_str(&env, "Spent a significant amount in splits")
    );
    assert_eq!(metadata.badge_type, BadgeType::BigSpender);

    let metadata = client.get_badge_metadata(&BadgeType::FrequentSettler);
    assert_eq!(metadata.name, String::from_str(&env, "Frequent Settler"));
    assert_eq!(
        metadata.description,
        String::from_str(&env, "Completed 50 split settlements")
    );
    assert_eq!(metadata.badge_type, BadgeType::FrequentSettler);

    let metadata = client.get_badge_metadata(&BadgeType::GroupLeader);
    assert_eq!(metadata.name, String::from_str(&env, "Group Leader"));
    assert_eq!(
        metadata.description,
        String::from_str(&env, "Managing group splits")
    );
    assert_eq!(metadata.badge_type, BadgeType::GroupLeader);
}

#[test]
fn test_different_users_can_mint_same_badge() {
    let (env, admin, client) = setup_test();
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.initialize(&admin);

    let evidence = AchievementEvidence {
        splits_created: 1,
        splits_participated: 0,
        total_amount_spent: 0,
        settlements_completed: 0,
        groups_managed: 0,
    };

    // Both users mint the same badge type
    client.mint_badge_with_evidence(&user1, &BadgeType::FirstSplitCreator, &evidence);
    client.mint_badge_with_evidence(&user2, &BadgeType::FirstSplitCreator, &evidence);

    // Check that both users have their own badges
    let user1_badges = client.get_user_badges(&user1);
    let user2_badges = client.get_user_badges(&user2);

    assert_eq!(user1_badges.len(), 1);
    assert_eq!(user2_badges.len(), 1);

    assert!(!client.has_badge(&user, &String::from_str(&env, "escrow-unknown")));
}
# [ t e s t ]  
 f n   t e s t _ t r a n s f e r _ a l w a y s _ r e j e c t e d ( )   {  
         l e t   e n v   =   E n v : : d e f a u l t ( ) ;  
         l e t   c o n t r a c t _ i d   =   e n v . r e g i s t e r _ c o n t r a c t ( N o n e ,   A c h i e v e m e n t B a d g e s C o n t r a c t ) ;  
         l e t   c l i e n t   =   A c h i e v e m e n t B a d g e s C o n t r a c t C l i e n t : : n e w ( & e n v ,   & c o n t r a c t _ i d ) ;  
         l e t   a d m i n   =   A d d r e s s : : g e n e r a t e ( & e n v ) ;  
         l e t   e s c r o w _ i d   =   e n v . r e g i s t e r _ c o n t r a c t ( N o n e ,   m o c k _ e s c r o w : : M o c k E s c r o w ) ;  
         c l i e n t . i n i t i a l i z e ( & a d m i n ,   & e s c r o w _ i d ) ;  
  
         l e t   f r o m   =   A d d r e s s : : g e n e r a t e ( & e n v ) ;  
         l e t   t o   =   A d d r e s s : : g e n e r a t e ( & e n v ) ;  
         l e t   b a d g e _ i d   =   1 u 6 4 ;  
  
         l e t   r e s u l t   =   c l i e n t . t r y _ t r a n s f e r ( & f r o m ,   & t o ,   & b a d g e _ i d ) ;  
         a s s e r t _ e q ! (  
                 r e s u l t . e r r ( ) . u n w r a p ( ) . u n w r a p ( ) ,  
                 c r a t e : : t y p e s : : B a d g e E r r o r : : T r a n s f e r N o t A l l o w e d  
         ) ;  
 }  
 