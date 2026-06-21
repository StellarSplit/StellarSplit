//! # Tests for Achievement Badges Contract

use crate::{
    AchievementBadgesContract, AchievementBadgesContractClient, AchievementEvidence, BadgeType,
    EligibilityResult,
};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

/// Helper to create a test environment and contract client
fn setup_test() -> (Env, Address, AchievementBadgesContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    (env, admin, client)
}

#[test]
fn test_initialize() {
    let (_env, admin, client) = setup_test();

    client.initialize(&admin);
}

#[test]
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

    // Check that user now has the badge
    let user_badges = client.get_user_badges(&user);
    assert_eq!(user_badges.len(), 1);
    assert_eq!(
        user_badges.get(0).unwrap().badge_type,
        BadgeType::FirstSplitCreator
    );
    assert_eq!(user_badges.get(0).unwrap().token_id, 1u64);
}

#[test]
fn test_no_duplicate_badges() {
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

    // Mint a badge
    client.mint_badge_with_evidence(&user, &BadgeType::FirstSplitCreator, &evidence);

    // Try to mint the same badge again (should fail)
    let result =
        client.try_mint_badge_with_evidence(&user, &BadgeType::FirstSplitCreator, &evidence);
    assert!(result.is_err());
}

#[test]
fn test_multiple_badges_for_user() {
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

#[test]
fn test_badge_metadata() {
    let (env, admin, client) = setup_test();

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

    assert_eq!(user1_badges.get(0).unwrap().token_id, 1u64);
    assert_eq!(user2_badges.get(0).unwrap().token_id, 2u64);
}
