#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

#[test]
fn test_reminder_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReminderContract);
    let client = ReminderContractClient::new(&env, &contract_id);

    let split_id = String::from_str(&env, "split_123");
    let participant_1 = Address::generate(&env);
    let participant_2 = Address::generate(&env);

    let mut participants = Vec::new(&env);
    participants.push_back(EscrowParticipant {
        address: participant_1.clone(),
        amount_owed: 100,
        amount_paid: 0,
        paid_at: None,
        reminder_requested: false,
    });
    participants.push_back(EscrowParticipant {
        address: participant_2.clone(),
        amount_owed: 200,
        amount_paid: 200,
        paid_at: Some(env.ledger().timestamp()),
        reminder_requested: false,
    });

    client.create_reminder_escrow(&split_id, &participants);

    // Initial state check
    assert!(!client.get_reminder_requested(&split_id, &participant_1));
    assert!(!client.get_reminder_requested(&split_id, &participant_2));

    // Request reminder for participant_1 (unpaid)
    client.request_reminder(&split_id, &participant_1);
    assert!(client.get_reminder_requested(&split_id, &participant_1));

    // Cancel reminder for participant_1
    client.cancel_reminder(&split_id, &participant_1);
    assert!(!client.get_reminder_requested(&split_id, &participant_1));
}

#[test]
#[should_panic(expected = "Participant not found or already paid")]
fn test_request_reminder_already_paid_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ReminderContract);
    let client = ReminderContractClient::new(&env, &contract_id);

    let split_id = String::from_str(&env, "split_123");
    let participant = Address::generate(&env);

    let mut participants = Vec::new(&env);
    participants.push_back(EscrowParticipant {
        address: participant.clone(),
        amount_owed: 100,
        amount_paid: 100,
        paid_at: None,
        reminder_requested: false,
    });

    client.create_reminder_escrow(&split_id, &participants);
    client.request_reminder(&split_id, &participant);
}
