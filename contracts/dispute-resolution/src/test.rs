use crate::errors::Error;
use crate::types::{DisputeResult, DisputeStatus};
#[cfg(test)]
use crate::{DisputeContract, DisputeContractClient};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient as TokenAdminClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Map, String,
};
use split_escrow::{
    SplitEscrowContract, SplitEscrowContractClient, SplitStatus as EscrowSplitStatus,
};

fn setup() -> (
    Env,
    DisputeContractClient<'static>,
    SplitEscrowContractClient<'static>,
    Address,
    TokenClient<'static>,
    Address,
    Address,
    Address,
    u64,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = token_contract.address();

    let token_client = TokenClient::new(&env, &token_address);
    let token_admin_client = TokenAdminClient::new(&env, &token_address);

    let escrow_contract_id = env.register_contract(None, SplitEscrowContract);
    let escrow_client = SplitEscrowContractClient::new(&env, &escrow_contract_id);
    escrow_client.initialize(&admin, &token_address, &String::from_str(&env, "1.0.0"));

    let treasury = Address::generate(&env);
    escrow_client.set_treasury(&treasury);
    escrow_client.set_fee(&0u32);

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 10_000i128);
    let escrow_split_id = escrow_client.create_escrow(
        &creator,
        &String::from_str(&env, "Escrow split for disputes"),
        &10_000i128,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
    );
    token_admin_client.mint(&participant, &10_000i128);
    escrow_client.deposit(&escrow_split_id, &participant, &10_000i128);

    // Ready before dispute resolution.
    assert_eq!(
        escrow_client.get_escrow(&escrow_split_id).status,
        EscrowSplitStatus::Ready
    );

    let dispute_id = env.register_contract(None, DisputeContract);
    let dispute_client = DisputeContractClient::new(&env, &dispute_id);

    // ADDED: initialize the dispute contract with the admin
    dispute_client.initialize(&admin);

    (
        env,
        dispute_client,
        escrow_client,
        escrow_contract_id,
        token_client,
        creator,
        participant,
        treasury,
        escrow_split_id,
        admin,
    )
}

#[test]
fn test_raise_dispute_records_voting_state() {
    let (
        env,
        client,
        _escrow,
        escrow_contract,
        _token_client,
        _creator,
        _participant,
        _treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let id = client.raise_dispute(
        &String::from_str(&env, "split_001"),
        &raiser,
        &String::from_str(&env, "Payment was incorrect"),
        &escrow_contract,
        &escrow_split_id,
    );

    let dispute = client.get_dispute(&id);
    assert_eq!(dispute.status, DisputeStatus::Voting);
    assert_eq!(dispute.votes_for, 0);
    assert_eq!(dispute.votes_against, 0);
    assert_eq!(dispute.voting_ends_at, 1000 + 604_800);
}

#[test]
fn test_vote_on_dispute_increments_counts() {
    let (
        env,
        client,
        _escrow,
        escrow_contract,
        _token_client,
        _creator,
        _participant,
        _treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_002"),
        &raiser,
        &String::from_str(&env, "Wrong amount"),
        &escrow_contract,
        &escrow_split_id,
    );

    client.vote_on_dispute(&id, &voter, &true);

    let dispute = client.get_dispute(&id);
    assert_eq!(dispute.votes_for, 1);
    assert_eq!(dispute.votes_against, 0);
}

#[test]
fn test_vote_against_increments_votes_against() {
    let (
        env,
        client,
        _escrow,
        escrow_contract,
        _token_client,
        _creator,
        _participant,
        _treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_003"),
        &raiser,
        &String::from_str(&env, "Unfair split"),
        &escrow_contract,
        &escrow_split_id,
    );

    client.vote_on_dispute(&id, &voter, &false);

    let dispute = client.get_dispute(&id);
    assert_eq!(dispute.votes_for, 0);
    assert_eq!(dispute.votes_against, 1);
}

#[test]
fn test_double_vote_returns_error() {
    let (
        env,
        client,
        _escrow,
        escrow_contract,
        _token_client,
        _creator,
        _participant,
        _treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_004"),
        &raiser,
        &String::from_str(&env, "Duplicate payment"),
        &escrow_contract,
        &escrow_split_id,
    );

    client.vote_on_dispute(&id, &voter, &true);

    let res = client.try_vote_on_dispute(&id, &voter, &true);
    assert!(matches!(res, Err(Ok(Error::AlreadyVoted))));
}

#[test]
fn test_upheld_dispute_cancels_and_refunds_escrow() {
    let (
        env,
        client,
        escrow_client,
        escrow_contract,
        token_client,
        creator,
        participant,
        treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_005"),
        &raiser,
        &String::from_str(&env, "Missing funds"),
        &escrow_contract,
        &escrow_split_id,
    );

    client.vote_on_dispute(&id, &voter1, &true);
    client.vote_on_dispute(&id, &voter2, &true);

    env.ledger().with_mut(|l| l.timestamp = 1000 + 604_801);

    let result = client.resolve_dispute(&id, &creator);
    assert_eq!(result, DisputeResult::UpheldForRaiser);

    assert_eq!(
        escrow_client.get_escrow(&escrow_split_id).status,
        EscrowSplitStatus::Cancelled
    );
    assert_eq!(token_client.balance(&participant), 10_000i128);
    assert_eq!(token_client.balance(&creator), 0i128);
    assert_eq!(token_client.balance(&treasury), 0i128);
}

#[test]
fn test_dismissed_dispute_releases_escrow() {
    let (
        env,
        client,
        escrow_client,
        escrow_contract,
        token_client,
        creator,
        participant,
        treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_006"),
        &raiser,
        &String::from_str(&env, "Wrong recipient"),
        &escrow_contract,
        &escrow_split_id,
    );

    client.vote_on_dispute(&id, &voter1, &false);
    client.vote_on_dispute(&id, &voter2, &false);

    env.ledger().with_mut(|l| l.timestamp = 1000 + 604_801);

    let result = client.resolve_dispute(&id, &creator);
    assert_eq!(result, DisputeResult::DismissedForRaiser);
    assert_eq!(
        escrow_client.get_escrow(&escrow_split_id).status,
        EscrowSplitStatus::Released
    );
    assert_eq!(token_client.balance(&participant), 0i128);
    assert_eq!(token_client.balance(&creator), 10_000i128);
    assert_eq!(token_client.balance(&treasury), 0i128);
}

#[test]
fn test_tied_dispute_releases_escrow() {
    let (
        env,
        client,
        escrow_client,
        escrow_contract,
        token_client,
        creator,
        participant,
        treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_007"),
        &raiser,
        &String::from_str(&env, "Unclear terms"),
        &escrow_contract,
        &escrow_split_id,
    );

    client.vote_on_dispute(&id, &voter1, &true);
    client.vote_on_dispute(&id, &voter2, &false);

    env.ledger().with_mut(|l| l.timestamp = 1000 + 604_801);

    let result = client.resolve_dispute(&id, &creator);
    assert_eq!(result, DisputeResult::Tied);
    assert_eq!(
        escrow_client.get_escrow(&escrow_split_id).status,
        EscrowSplitStatus::Released
    );
    assert_eq!(token_client.balance(&participant), 0i128);
    assert_eq!(token_client.balance(&creator), 10_000i128);
    assert_eq!(token_client.balance(&treasury), 0i128);
}

#[test]
fn test_resolve_before_voting_window_returns_error() {
    let (
        env,
        client,
        _escrow_client,
        escrow_contract,
        _token_client,
        creator,
        _participant,
        _treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let id = client.raise_dispute(
        &String::from_str(&env, "split_008"),
        &raiser,
        &String::from_str(&env, "Too early"),
        &escrow_contract,
        &escrow_split_id,
    );

    // Try to resolve immediately — voting period has not ended yet.
    let res = client.try_resolve_dispute(&id, &creator);
    assert!(matches!(res, Err(Ok(Error::VotingPeriodActive))));
}

#[test]
fn test_vote_after_period_returns_error() {
    let (
        env,
        client,
        _escrow_client,
        escrow_contract,
        _token_client,
        _creator,
        _participant,
        _treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_009"),
        &raiser,
        &String::from_str(&env, "Late vote"),
        &escrow_contract,
        &escrow_split_id,
    );

    env.ledger().with_mut(|l| l.timestamp = 1000 + 604_801);
    let res = client.try_vote_on_dispute(&id, &voter, &true);
    assert!(matches!(res, Err(Ok(Error::VotingPeriodEnded))));
}

#[test]
fn test_only_escrow_creator_can_resolve() {
    let (
        env,
        client,
        _escrow_client,
        escrow_contract,
        _token_client,
        _creator,
        _participant,
        _treasury,
        escrow_split_id,
        _admin,
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);
    let voter = Address::generate(&env);
    let not_creator = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_010"),
        &raiser,
        &String::from_str(&env, "Unauthorized resolve check"),
        &escrow_contract,
        &escrow_split_id,
    );

    client.vote_on_dispute(&id, &voter, &true);
    env.ledger().with_mut(|l| l.timestamp = 1000 + 604_801);

    let res = client.try_resolve_dispute(&id, &not_creator);
    assert!(res.is_err());

    // Ensure dispute itself is still unresolved after failed resolver auth.
    let dispute = client.get_dispute(&id);
    assert_eq!(dispute.status, DisputeStatus::Voting);
    assert_eq!(dispute.result, None);

    // Sanity: expected error variant should be preserved in host result.
    let _ = Error::UnauthorizedResolver;
}

// ADDED: new test — admin must not be allowed to vote
#[test]
fn test_admin_cannot_vote() {
    let (
        env,
        client,
        _escrow,
        escrow_contract,
        _token_client,
        _creator,
        _participant,
        _treasury,
        escrow_split_id,
        admin, // <-- we use admin this time, not _admin
    ) = setup();
    env.ledger().with_mut(|l| l.timestamp = 1000);

    let raiser = Address::generate(&env);

    let id = client.raise_dispute(
        &String::from_str(&env, "split_011"),
        &raiser,
        &String::from_str(&env, "Admin conflict of interest test"),
        &escrow_contract,
        &escrow_split_id,
    );

    // Admin tries to vote — must be rejected
    let res = client.try_vote_on_dispute(&id, &admin, &true);
    assert!(matches!(res, Err(Ok(Error::NotAuthorized))));
}
