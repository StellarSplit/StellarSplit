//! # Tests for Achievement Badges Contract

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

    let contract_id = env.register_contract(None, AchievementBadgesContract);
    let client = AchievementBadgesContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    (env, admin, client)
}

#[test]
fn test_initialize() {
    let (_env, admin, client) = setup_test();

    client.initialize(&admin);

    // Verify admin is set (we'd need a getter for this)
    // For now, just ensure it doesn't panic
}

#[test]
fn test_check_badge_eligibility() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin);

    let evidence = qualifying_evidence();

    // Test eligibility for all badge types (qualifying evidence should pass)
    assert_eq!(
        client.check_badge_eligibility(&user, &BadgeType::FirstSplitCreator, &evidence),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_badge_eligibility(&user, &BadgeType::HundredSplitsParticipated, &evidence),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_badge_eligibility(&user, &BadgeType::BigSpender, &evidence),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_badge_eligibility(&user, &BadgeType::FrequentSettler, &evidence),
        EligibilityResult::Eligible
    );
    assert_eq!(
        client.check_badge_eligibility(&user, &BadgeType::GroupLeader, &evidence),
        EligibilityResult::Eligible
    );
}

#[test]
fn test_mint_badge() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Mint first badge
    let token_id = client.mint_badge(&user, &BadgeType::FirstSplitCreator, &qualifying_evidence());
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

    // Mint a badge
    client.mint_badge(&user, &BadgeType::FirstSplitCreator, &qualifying_evidence());

    // Try to mint the same badge again (should fail)
    let result =
        client.try_mint_badge(&user, &BadgeType::FirstSplitCreator, &qualifying_evidence());
    assert!(result.is_err());
}

#[test]
fn test_multiple_badges_for_user() {
    let (env, admin, client) = setup_test();
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Mint multiple different badges
    let evidence = qualifying_evidence();
    client.mint_badge(&user, &BadgeType::FirstSplitCreator, &evidence);
    client.mint_badge(&user, &BadgeType::HundredSplitsParticipated, &evidence);
    client.mint_badge(&user, &BadgeType::BigSpender, &evidence);

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

    // Both users mint the same badge type
    let evidence = qualifying_evidence();
    client.mint_badge(&user1, &BadgeType::FirstSplitCreator, &evidence);
    client.mint_badge(&user2, &BadgeType::FirstSplitCreator, &evidence);

    // Check that both users have their own badges
    let user1_badges = client.get_user_badges(&user1);
    let user2_badges = client.get_user_badges(&user2);

    assert_eq!(user1_badges.len(), 1);
    assert_eq!(user2_badges.len(), 1);

    assert_eq!(user1_badges.get(0).unwrap().token_id, 1u64);
    assert_eq!(user2_badges.get(0).unwrap().token_id, 2u64);
}
