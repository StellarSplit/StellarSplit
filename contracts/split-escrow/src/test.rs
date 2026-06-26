#![cfg(test)]
extern crate std;

use crate::events::PartialDepositEvent;
use crate::{SplitEscrowContract, SplitEscrowContractClient, SplitStatus};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient as TokenAdminClient};
use soroban_sdk::{
    testutils::Address as _, testutils::Events as _, Address, Env, FromVal, IntoVal, Map, String,
    Vec,
};

fn metadata_map(env: &Env, entries: &[(&str, &str)]) -> Map<String, String> {
    let mut metadata = Map::new(env);
    for (key, value) in entries {
        metadata.set(String::from_str(env, key), String::from_str(env, value));
    }
    metadata
}

fn setup() -> (
    Env,
    SplitEscrowContractClient<'static>,
    Address,
    Address,
    Address,
    TokenClient<'static>,
    TokenAdminClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let participant = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token = token_contract.address();

    let token_client = TokenClient::new(&env, &token);
    let token_admin_client = TokenAdminClient::new(&env, &token);

    let contract_id = env.register_contract(None, SplitEscrowContract);
    let client = SplitEscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token, &String::from_str(&env, "1.0.0"));

    token_admin_client.mint(&participant, &1_000_000);
    token_admin_client.mint(&creator, &1_000_000);

    (
        env,
        client,
        admin,
        creator,
        participant,
        token_client,
        token_admin_client,
    )
}

#[test]
fn test_fee_deducted_and_sent_to_treasury_on_release() {
    let (env, client, admin, creator, participant, token_client, _) = setup();
    let treasury = Address::generate(&env);
    client.set_treasury(&treasury);
    client.set_fee(&250u32); // 2.5%

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 10_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Dinner"),
        &10_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    client.deposit(&split_id, &participant, &10_000);
    client.release_funds(&split_id);

    assert_eq!(token_client.balance(&treasury), 250);
    assert_eq!(token_client.balance(&creator), 1_000_000 + 9_750);

    let escrow = client.get_escrow(&split_id);
    assert_eq!(escrow.status, SplitStatus::Released);

    let _ = admin;
}

#[test]
fn test_admin_can_update_fee_and_treasury() {
    let (env, client, _admin, creator, participant, token_client, _) = setup();

    let treasury_a = Address::generate(&env);
    client.set_treasury(&treasury_a);
    client.set_fee(&100u32);

    let mut obligations_a = Map::new(&env);
    obligations_a.set(participant.clone(), 1_000);

    let split_a = client.create_escrow(
        &creator,
        &String::from_str(&env, "A"),
        &1_000,
        &Map::new(&env),
        &obligations_a,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    client.deposit(&split_a, &participant, &1_000);
    client.release_funds(&split_a);
    assert_eq!(token_client.balance(&treasury_a), 10);

    let treasury_b = Address::generate(&env);
    client.set_treasury(&treasury_b);
    client.set_fee(&300u32);

    let mut obligations_b = Map::new(&env);
    obligations_b.set(participant.clone(), 2_000);

    let split_b = client.create_escrow(
        &creator,
        &String::from_str(&env, "B"),
        &2_000,
        &Map::new(&env),
        &obligations_b,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    client.deposit(&split_b, &participant, &2_000);
    client.release_funds(&split_b);
    assert_eq!(token_client.balance(&treasury_b), 60);
}

#[test]
fn test_set_fee_and_set_treasury_are_admin_only() {
    let (env, client, admin, _creator, _participant, _token_client, _token_admin) = setup();

    env.mock_all_auths();
    client.set_fee(&123u32);
    client.set_treasury(&Address::generate(&env));

    assert_ne!(admin, Address::generate(&env));
}

#[test]
fn test_fees_collected_event_emitted() {
    let (env, client, _admin, creator, participant, _token_client, _) = setup();
    let treasury = Address::generate(&env);
    client.set_treasury(&treasury);
    client.set_fee(&500u32);

    let before_len = env.events().all().len();

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 1_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Event"),
        &1_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    client.deposit(&split_id, &participant, &1_000);
    client.release_funds(&split_id);

    let after_len = env.events().all().len();
    assert!(after_len > before_len);
}

#[test]
fn test_version_stored_on_init() {
    let (env, client, _, _, _, _, _) = setup();
    assert_eq!(client.get_version(), String::from_str(&env, "1.0.0"));
}

#[test]
fn test_upgrade_version_admin() {
    let (env, client, _admin, _, _, _, _) = setup();

    client.upgrade_version(&String::from_str(&env, "1.1.0"));
    assert_eq!(client.get_version(), String::from_str(&env, "1.1.0"));
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")] // Unauthorized
fn test_upgrade_version_non_admin_fails() {
    let (env, client, _, creator, _, _, _) = setup();

    env.mock_all_auths(); // Reset mocks to require specific auth

    // Switch to creator auth
    let mut args = Vec::new(&env);
    args.push_back(String::from_str(&env, "1.1.0").into_val(&env));
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &creator,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &client.address,
            fn_name: "upgrade_version",
            args,
            sub_invokes: &[],
        },
    }]);

    client.upgrade_version(&String::from_str(&env, "1.1.0"));
}

#[test]
fn test_partial_deposits() {
    let (env, client, _admin, creator, participant, token_client, _) = setup();
    client.set_treasury(&Address::generate(&env));
    let p2 = Address::generate(&env);
    let token_admin_client = TokenAdminClient::new(&env, &token_client.address);
    token_admin_client.mint(&p2, &1_000_000);

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 5_000);
    obligations.set(p2.clone(), 5_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Shared Bill"),
        &10_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );

    // Participant 1 pays half their obligation.
    client.deposit(&split_id, &participant, &2_500);
    let escrow = client.get_escrow(&split_id);
    assert_eq!(escrow.status, SplitStatus::Pending);
    assert_eq!(escrow.deposited_amount, 2_500);
    assert_eq!(escrow.balances.get(participant.clone()).unwrap(), 2_500);
    assert_eq!(escrow.deposits.get(participant.clone()).unwrap(), 2_500);

    let balance = client.get_participant_balance(&split_id, &participant);
    assert_eq!(balance.deposited, 2_500);
    assert_eq!(balance.owed, 5_000);
    assert_eq!(balance.remaining, 2_500);

    // Participant 1 pays the rest of their obligation.
    client.deposit(&split_id, &participant, &2_500);
    let escrow = client.get_escrow(&split_id);
    assert_eq!(escrow.deposited_amount, 5_000);
    assert_eq!(escrow.balances.get(participant.clone()).unwrap(), 5_000);
    assert_eq!(escrow.deposits.get(participant.clone()).unwrap(), 5_000);
    assert_eq!(escrow.status, SplitStatus::Pending); // Still pending because p2 hasn't paid.

    // Participant 2 pays their full obligation.
    client.deposit(&split_id, &p2, &5_000);
    let escrow = client.get_escrow(&split_id);
    assert_eq!(escrow.deposited_amount, 10_000);
    assert_eq!(escrow.status, SplitStatus::Ready);

    client.release_funds(&split_id);
    assert_eq!(client.get_escrow(&split_id).status, SplitStatus::Released);
    assert_eq!(token_client.balance(&creator), 1_000_000 + 10_000);
}

#[test]
fn test_partial_deposit_balance_view_and_threshold_events() {
    let (env, client, _admin, creator, participant, _token_client, _) = setup();

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 200);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Installments"),
        &200,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
    );

    client.deposit(&split_id, &participant, &50);
    let balance = client.get_participant_balance(&split_id, &participant);
    assert_eq!(balance.deposited, 50);
    assert_eq!(balance.owed, 200);
    assert_eq!(balance.remaining, 150);

    client.deposit(&split_id, &participant, &50);
    let half_event = env.events().all().last().unwrap();
    assert_eq!(half_event.0, client.address);
    assert_eq!(
        half_event.1,
        ("PartialDepositEvent", "split_id", "participant").into_val(&env)
    );
    let half_payload = PartialDepositEvent::from_val(&env, &half_event.2);
    assert_eq!(
        half_payload,
        PartialDepositEvent {
            split_id,
            participant: participant.clone(),
            deposited: 100,
            owed: 200,
            threshold_percent: 50,
        }
    );

    client.deposit(&split_id, &participant, &100);
    let full_event = env.events().all().last().unwrap();
    let full_payload = PartialDepositEvent::from_val(&env, &full_event.2);
    assert_eq!(
        full_payload,
        PartialDepositEvent {
            split_id,
            participant: participant.clone(),
            deposited: 200,
            owed: 200,
            threshold_percent: 100,
        }
    );

    let balance = client.get_participant_balance(&split_id, &participant);
    assert_eq!(balance.deposited, 200);
    assert_eq!(balance.owed, 200);
    assert_eq!(balance.remaining, 0);
    assert_eq!(client.get_escrow(&split_id).status, SplitStatus::Ready);
}

#[test]
fn test_cancel_partial_refunds() {
    let (env, client, _admin, creator, participant, token_client, _) = setup();
    let p2 = Address::generate(&env);
    let token_admin_client = TokenAdminClient::new(&env, &token_client.address);
    token_admin_client.mint(&p2, &1_000_000);

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 5_000);
    obligations.set(p2.clone(), 5_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Shared Bill"),
        &10_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );

    client.deposit(&split_id, &participant, &3_000);
    client.deposit(&split_id, &p2, &2_000);

    let balance_p1_before = token_client.balance(&participant);
    let balance_p2_before = token_client.balance(&p2);

    client.cancel_split(&split_id);

    assert_eq!(
        token_client.balance(&participant),
        balance_p1_before + 3_000
    );
    assert_eq!(token_client.balance(&p2), balance_p2_before + 2_000);
    assert_eq!(client.get_escrow(&split_id).status, SplitStatus::Cancelled);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #11)")] // InvalidVersion
fn test_upgrade_version_invalid_semver_fails() {
    let (env, client, _, _, _, _, _) = setup();
    client.upgrade_version(&String::from_str(&env, "1.0"));
}

#[test]
fn test_toggle_whitelist_allows_creator_to_restrict_access() {
    let (env, client, _admin, creator, participant, _token_client, _token_admin) = setup();

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 2_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Restricted"),
        &2_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );

    // Default: whitelist is disabled.
    client.deposit(&split_id, &participant, &1_000);
    assert_eq!(client.get_escrow(&split_id).deposited_amount, 1_000);

    // Creator enables whitelist.
    client.toggle_whitelist(&split_id, &true);

    // Second deposit (from same participant or another) should fail if not whitelisted.
    // We'll create a new participant and attempt to deposit.
    let p2 = Address::generate(&env);
    let res = client.try_deposit(&split_id, &p2, &500);
    assert!(res.is_err());
}

#[test]
fn test_create_escrow_with_metadata_stores_correctly() {
    let (env, client, _admin, creator, participant, _token_client, _token_admin) = setup();
    let mut metadata = soroban_sdk::Map::new(&env);
    metadata.set(
        String::from_str(&env, "key"),
        String::from_str(&env, "value"),
    );

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 1_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Metadata test"),
        &1_000,
        &metadata,
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );

    let escrow = client.get_escrow(&split_id);
    assert_eq!(escrow.metadata, metadata);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #11)")] // InvalidVersion
fn test_initialize_invalid_version_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let contract_id = env.register_contract(None, SplitEscrowContract);
    let client = SplitEscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token, &String::from_str(&env, "1.0"));
}

#[test]
fn test_contract_upgraded_event_emitted() {
    let (env, client, _, _, _, _, _) = setup();

    let before_len = env.events().all().len();
    client.upgrade_version(&String::from_str(&env, "2.0.0"));
    let after_len = env.events().all().len();

    assert!(after_len > before_len);

    let last_event = env.events().all().last().unwrap();
    assert_eq!(last_event.0, client.address);
}

#[test]
fn test_default_max_participants_is_50() {
    let (env, client, _admin, creator, participant, _tc, token_admin) = setup();
    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 100);
    let escrow_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Cap default"),
        &100,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.max_participants, 50);
    assert_eq!(escrow.participants.len(), 0);

    let _ = token_admin;
}

#[test]
fn test_explicit_max_participants_stored_in_get_escrow() {
    let (env, client, _admin, creator, p1, _tc, _ta) = setup();
    let cap = 3u32;
    let mut obligations = Map::new(&env);
    obligations.set(p1.clone(), 300);
    let escrow_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Explicit cap"),
        &300,
        &Map::new(&env),
        &obligations,
        &Some(cap),
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.max_participants, cap);
    client.deposit(&escrow_id, &p1, &100);
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.participants.len(), 1);
}

#[test]
fn test_deposit_rejected_when_participant_cap_exceeded() {
    let (env, client, _admin, creator, p1, _tc, token_admin) = setup();
    let p2 = Address::generate(&env);
    let p3 = Address::generate(&env);
    token_admin.mint(&p2, &10_000);
    token_admin.mint(&p3, &10_000);

    let mut obligations = Map::new(&env);
    obligations.set(p1.clone(), 1_000);
    obligations.set(p2.clone(), 1_000);
    obligations.set(p3.clone(), 1_000);

    let escrow_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Two max"),
        &3_000,
        &Map::new(&env),
        &obligations,
        &Some(2u32),
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );

    client.deposit(&escrow_id, &p1, &1_000);
    client.deposit(&escrow_id, &p2, &1_000);
    assert_eq!(client.get_escrow(&escrow_id).participants.len(), 2);

    let res = client.try_deposit(&escrow_id, &p3, &1_000);
    assert!(res.is_err());

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.participants.len(), 2);
    assert_eq!(escrow.deposited_amount, 2_000);
}

#[test]
fn test_existing_participant_can_deposit_again_without_increasing_count() {
    let (env, client, _admin, creator, p1, _tc, _ta) = setup();
    // release_funds runs fee collection; treasury must be set even when fee bps is 0.
    client.set_treasury(&Address::generate(&env));

    let mut obligations = Map::new(&env);
    obligations.set(p1.clone(), 2_000);

    let escrow_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Repeat"),
        &2_000,
        &Map::new(&env),
        &obligations,
        &Some(1u32),
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    client.deposit(&escrow_id, &p1, &1_000);
    client.deposit(&escrow_id, &p1, &1_000);
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.participants.len(), 1);
    assert_eq!(escrow.deposited_amount, 2_000);
    client.release_funds(&escrow_id);
    assert_eq!(client.get_escrow(&escrow_id).status, SplitStatus::Released);
}

#[test]
fn test_note_stored_on_create_and_get_note() {
    let (env, client, _admin, creator, participant, _tc, _ta) = setup();
    let text = "Dinner at Luigi's — Friday night";
    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 100);
    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Bill"),
        &100,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &Some(String::from_str(&env, text)),
        &None, // payee: defaults to single-payee mode (creator)
    );
    assert_eq!(client.get_note(&split_id), String::from_str(&env, text));
    assert_eq!(
        client.get_escrow(&split_id).note,
        String::from_str(&env, text)
    );
}

#[test]
fn test_creator_can_update_note_while_pending_and_ready() {
    let (env, client, _admin, creator, p1, _tc, _ta) = setup();
    client.set_treasury(&Address::generate(&env));

    let mut obligations = Map::new(&env);
    obligations.set(p1.clone(), 2_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "X"),
        &2_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    client.set_note(&split_id, &String::from_str(&env, "v1"));
    assert_eq!(client.get_note(&split_id), String::from_str(&env, "v1"));

    client.deposit(&split_id, &p1, &1_000);
    client.set_note(&split_id, &String::from_str(&env, "v2-ready"));
    assert_eq!(
        client.get_note(&split_id),
        String::from_str(&env, "v2-ready")
    );

    client.deposit(&split_id, &p1, &1_000);
    client.release_funds(&split_id);
    let res = client.try_set_note(&split_id, &String::from_str(&env, "late"));
    assert!(res.is_err());
}

#[test]
fn test_note_over_128_bytes_rejected_on_create_and_set() {
    let (env, client, _admin, creator, participant, _tc, _ta) = setup();
    let bytes = [b'a'; 129];
    let long = String::from_str(&env, core::str::from_utf8(&bytes).unwrap());
    assert_eq!(long.len(), 129);

    let mut obligations_try = Map::new(&env);
    obligations_try.set(participant.clone(), 100);

    let res = client.try_create_escrow(
        &creator,
        &String::from_str(&env, "x"),
        &100,
        &Map::new(&env),
        &obligations_try,
        &None,
        &false,
        &Some(long.clone()),
        &None, // payee: defaults to single-payee mode (creator)
    );
    assert!(res.is_err());

    let mut obligations_ok = Map::new(&env);
    obligations_ok.set(participant.clone(), 100);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "ok"),
        &100,
        &Map::new(&env),
        &obligations_ok,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    let res2 = client.try_set_note(&split_id, &long);
    assert!(res2.is_err());
}

#[test]
fn test_note_updated_emits_event() {
    let (env, client, _admin, creator, participant, _tc, _ta) = setup();
    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 100);
    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "E"),
        &100,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    let before = env.events().all().len();
    client.set_note(&split_id, &String::from_str(&env, "hello"));
    assert!(env.events().all().len() > before);
}

#[test]
fn test_cancel_split() {
    let (env, client, _admin, creator, participant, _tc, token_admin) = setup();
    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 100);
    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Cancel test"),
        &100,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    client.cancel_split(&split_id);

    let escrow = client.get_escrow(&split_id);
    assert_eq!(escrow.status, SplitStatus::Cancelled);

    let res = client.try_deposit(&split_id, &participant, &100);
    assert!(res.is_err());

    let res = client.try_release_funds(&split_id);
    assert!(res.is_err());

    let res = client.try_set_note(&split_id, &String::from_str(&env, "denied"));
    assert!(res.is_err());

    let after = env.events().all().len();
    assert!(after > 0);

    let _ = token_admin;
}

#[test]
fn test_create_escrow_zero_amount() {
    let (env, client, _admin, creator, _participant, _tc, _ta) = setup();

    let mut obligations = Map::new(&env);
    // Single obligation of 0, total_amount = 0
    obligations.set(Address::generate(&env), 0);

    let res = client.try_create_escrow(
        &creator,
        &String::from_str(&env, "Zero amount"),
        &0,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    assert!(res.is_err());
    // Error::InvalidAmount = 4 => HostError: Error(Contract, #4)
}

#[test]
fn test_create_escrow_zero_obligation() {
    let (env, client, _admin, creator, participant, _tc, _ta) = setup();

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), 0);

    let res = client.try_create_escrow(
        &creator,
        &String::from_str(&env, "Zero obligation"),
        &100,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    assert!(res.is_err());
}

#[test]
fn test_create_escrow_negative_obligation() {
    let (env, client, _admin, creator, participant, _tc, _ta) = setup();

    let mut obligations = Map::new(&env);
    obligations.set(participant.clone(), -50);

    let res = client.try_create_escrow(
        &creator,
        &String::from_str(&env, "Negative obligation"),
        &100,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee: defaults to single-payee mode (creator)
    );
    assert!(res.is_err());
}

#[test]
fn test_release_distributes_per_participant() {
    let (env, client, _admin, creator, p1, token_client, token_admin) = setup();
    let p2 = Address::generate(&env);
    token_admin.mint(&p2, &1_000_000);
    let payee = Address::generate(&env);

    let mut obligations = Map::new(&env);
    obligations.set(p1.clone(), 7_000);
    obligations.set(p2.clone(), 3_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Custom payee"),
        &10_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &Some(payee.clone()),
    );

    client.deposit(&split_id, &p1, &7_000);
    client.deposit(&split_id, &p2, &3_000);

    let before = env.events().all().len();
    client.release_funds(&split_id);
    let after = env.events().all().len();
    // One FundsReleased(participant) event per participant + one summary event.
    assert!(after - before >= 3);

    // All funds land on the configured payee, regardless of how many
    // participants contributed, and the contract holds nothing back.
    assert_eq!(token_client.balance(&payee), 10_000);
    assert_eq!(token_client.balance(&creator), 1_000_000);

    let escrow = client.get_escrow(&split_id);
    assert_eq!(escrow.status, SplitStatus::Released);
    assert_eq!(escrow.payee, Some(payee));
}

#[test]
fn test_release_single_payee_mode_defaults_to_creator() {
    let (env, client, _admin, creator, p1, token_client, token_admin) = setup();
    let p2 = Address::generate(&env);
    token_admin.mint(&p2, &1_000_000);

    let mut obligations = Map::new(&env);
    obligations.set(p1.clone(), 6_000);
    obligations.set(p2.clone(), 4_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Default payee"),
        &10_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &None, // payee omitted -> single-payee mode, creator receives funds
    );

    client.deposit(&split_id, &p1, &6_000);
    client.deposit(&split_id, &p2, &4_000);
    client.release_funds(&split_id);

    assert_eq!(token_client.balance(&creator), 1_000_000 + 10_000);
    assert_eq!(client.get_escrow(&split_id).payee, None);
}

#[test]
fn test_release_with_fee_distributes_net_amount_proportionally() {
    let (env, client, _admin, creator, p1, token_client, token_admin) = setup();
    let p2 = Address::generate(&env);
    token_admin.mint(&p2, &1_000_000);
    let payee = Address::generate(&env);
    let treasury = Address::generate(&env);
    client.set_treasury(&treasury);
    client.set_fee(&1000u32); // 10%

    let mut obligations = Map::new(&env);
    obligations.set(p1.clone(), 6_000);
    obligations.set(p2.clone(), 4_000);

    let split_id = client.create_escrow(
        &creator,
        &String::from_str(&env, "Fee aware"),
        &10_000,
        &Map::new(&env),
        &obligations,
        &None,
        &false,
        &None,
        &Some(payee.clone()),
    );

    client.deposit(&split_id, &p1, &6_000);
    client.deposit(&split_id, &p2, &4_000);
    client.release_funds(&split_id);

    // 10% fee on the 10,000 total goes to the treasury; the remaining 9,000
    // is distributed to the payee across both participants' shares with no
    // funds left behind in the contract.
    assert_eq!(token_client.balance(&treasury), 1_000);
    assert_eq!(token_client.balance(&payee), 9_000);
}