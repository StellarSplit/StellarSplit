use crate::types::ReminderEscrow;
use soroban_sdk::{contracttype, Env, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Reminder(String),
}

pub fn get_escrow(env: &Env, split_id: &String) -> Option<ReminderEscrow> {
    env.storage()
        .persistent()
        .get(&DataKey::Reminder(split_id.clone()))
}

pub fn set_escrow(env: &Env, split_id: &String, escrow: &ReminderEscrow) {
    let key = DataKey::Reminder(split_id.clone());
    env.storage().persistent().set(&key, escrow);
}
