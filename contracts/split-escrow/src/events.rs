use soroban_sdk::{contracttype, Address, Env, String, Symbol};

use crate::types::Split;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PartialDepositEvent {
    pub split_id: u64,
    pub participant: Address,
    pub deposited: i128,
    pub owed: i128,
    pub threshold_percent: u32,
}

pub fn emit_initialized(env: &Env, admin: &Address) {
    env.events().publish(("init", "admin"), admin.clone());
}

pub fn emit_contract_upgraded(env: &Env, old_version: String, new_version: String) {
    env.events().publish(
        ("upgraded", "old_version", "new_version"),
        (old_version, new_version),
    );
}

pub fn emit_split_created(env: &Env, split: &Split) {
    env.events().publish(
        ("created", "split_id", "creator"),
        (split.split_id, split.creator.clone()),
    );
}

pub fn emit_deposit(env: &Env, split_id: u64, participant: &Address, amount: i128) {
    env.events().publish(
        ("deposit", "split_id", "participant"),
        (split_id, participant.clone(), amount),
    );
}

pub fn emit_partial_threshold_reached(
    env: &Env,
    split_id: u64,
    participant: &Address,
    deposited: i128,
    owed: i128,
    threshold_percent: u32,
) {
    let event = PartialDepositEvent {
        split_id,
        participant: participant.clone(),
        deposited,
        owed,
        threshold_percent,
    };

    env.events()
        .publish(("PartialDepositEvent", "split_id", "participant"), event);
}

pub fn emit_released(env: &Env, split_id: u64, released_amount: i128) {
    env.events()
        .publish(("released", "split_id"), (split_id, released_amount));
}

/// Per-participant event emitted during `release_funds`, recording the share
/// of the net released amount attributed to `participant` and paid out to
/// the split's payee (or creator, in single-payee mode).
pub fn emit_funds_released_to_participant(
    env: &Env,
    split_id: u64,
    participant: &Address,
    amount: i128,
) {
    env.events().publish(
        ("released_participant", "split_id", "participant"),
        (split_id, participant.clone(), amount),
    );
}

pub fn emit_cancelled(env: &Env, split_id: u64) {
    env.events().publish(("cancelled", "split_id"), split_id);
}

pub fn emit_fees_collected(env: &Env, amount: i128, treasury: &Address) {
    env.events().publish(
        (Symbol::new(env, "FeesCollected"),),
        (amount, treasury.clone()),
    );
}

pub fn emit_note_updated(env: &Env, split_id: u64, note: &String) {
    env.events()
        .publish(("NoteUpdated", "split_id"), (split_id, note.clone()));
}