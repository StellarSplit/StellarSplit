use crate::errors::Error;
use crate::types::{DataKey, Dispute};
use soroban_sdk::{Address, Env, String, Vec};

pub fn save_dispute(env: &Env, dispute: &Dispute) {
    env.storage()
        .persistent()
        .set(&DataKey::Dispute(dispute.dispute_id.clone()), dispute);
}

pub fn get_dispute(env: &Env, dispute_id: &String) -> Result<Dispute, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Dispute(dispute_id.clone()))
        .ok_or(Error::NotFound)
}

pub fn has_dispute(env: &Env, dispute_id: &String) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Dispute(dispute_id.clone()))
}

pub fn add_to_list(env: &Env, dispute_id: String) {
    let mut list: Vec<String> = env
        .storage()
        .persistent()
        .get(&DataKey::DisputeList)
        .unwrap_or(Vec::new(env));
    list.push_back(dispute_id);
    env.storage().persistent().set(&DataKey::DisputeList, &list);
}

pub fn get_list(env: &Env) -> Vec<String> {
    env.storage()
        .persistent()
        .get(&DataKey::DisputeList)
        .unwrap_or(Vec::new(env))
}

pub fn has_voted(env: &Env, dispute_id: &String, voter: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::VoterRecord(dispute_id.clone(), voter.clone()))
}

pub fn record_vote(env: &Env, dispute_id: &String, voter: &Address) {
    env.storage().persistent().set(
        &DataKey::VoterRecord(dispute_id.clone(), voter.clone()),
        &true,
    );
}

// --- Admin storage (new) ---

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("Admin not set")
}

pub fn has_admin(env: &Env) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::Admin)
}