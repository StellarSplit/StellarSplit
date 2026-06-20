//! # Name Index Module for Split Template Contract
//!
//! Tracks creator/name pairs to prevent duplicate template names per creator.
//! Provides fast lookup to check for existing templates with the same name.

use soroban_sdk::{contracttype, Address, Env, String};

// Storage key for creator + name mapping
#[contracttype]
#[derive(Clone)]
pub struct CreatorNameKey {
    pub creator: Address,
    pub name: String,
}

// Time-to-live for persistent storage (about 1 year)
const LEDGER_TTL_PERSISTENT: u32 = 31_536_000;

/// Check if a template with the given creator and name already exists.
pub fn has_template_with_name(env: &Env, creator: &Address, name: &String) -> bool {
    let key = CreatorNameKey {
        creator: creator.clone(),
        name: name.clone(),
    };
    env.storage().persistent().has(&key)
}

/// Store the mapping from creator + name to template ID.
pub fn store_name_mapping(env: &Env, creator: &Address, name: &String, template_id: String) {
    let key = CreatorNameKey {
        creator: creator.clone(),
        name: name.clone(),
    };
    env.storage().persistent().set(&key, &template_id);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_PERSISTENT, LEDGER_TTL_PERSISTENT);
}

/// Get the template ID for a given creator and name, if it exists.
pub fn get_template_id_by_name(env: &Env, creator: &Address, name: &String) -> Option<String> {
    let key = CreatorNameKey {
        creator: creator.clone(),
        name: name.clone(),
    };
    env.storage().persistent().get(&key)
}
