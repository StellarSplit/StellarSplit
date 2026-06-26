//! Storage for path-payment contract: pairs, rates, admin, swap router.

use soroban_sdk::{contracttype, Address, Env, String, Vec};

use crate::types::{AssetPair, PathIntent};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Initialized,
    /// Optional swap router contract: swap(from, to, amount_in) -> amount_out
    SwapRouter,
    /// Registered pair (from_asset, to_asset) for path finding. Value unused.
    Pair(Address, Address),
    /// Conversion rate from_asset -> to_asset (amount_out per 1e7 amount_in)
    Rate(Address, Address),
    /// Path intent stored by split_id for time-bound execution.
    PathIntent(String),
}

const LEDGER_TTL_PERSISTENT: u32 = 31_536_000;
const LEDGER_TTL_THRESHOLD: u32 = 86_400;

#[allow(dead_code)]
pub fn has_admin(env: &Env) -> bool {
    env.storage().persistent().has(&DataKey::Admin)
}

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&DataKey::Admin)
        .expect("admin not set")
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().persistent().set(&DataKey::Admin, admin);
    env.storage().persistent().extend_ttl(
        &DataKey::Admin,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
}

pub fn set_initialized(env: &Env) {
    env.storage().persistent().set(&DataKey::Initialized, &true);
    env.storage().persistent().extend_ttl(
        &DataKey::Initialized,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().persistent().has(&DataKey::Initialized)
}

pub fn get_swap_router(env: &Env) -> Option<Address> {
    env.storage().persistent().get(&DataKey::SwapRouter)
}

pub fn set_swap_router(env: &Env, router: &Address) {
    env.storage().persistent().set(&DataKey::SwapRouter, router);
    env.storage().persistent().extend_ttl(
        &DataKey::SwapRouter,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
}

#[allow(dead_code)]
pub fn clear_swap_router(env: &Env) {
    env.storage().persistent().remove(&DataKey::SwapRouter);
}

/// Register a directed pair (from_asset -> to_asset) for path finding.
pub fn register_pair(env: &Env, from: &Address, to: &Address) {
    let key = DataKey::Pair(from.clone(), to.clone());
    env.storage().persistent().set(&key, &true);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

#[allow(dead_code)]
pub fn has_pair(env: &Env, from: &Address, to: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Pair(from.clone(), to.clone()))
}

/// Set conversion rate: amount of to_asset per 1e7 units of from_asset.
pub fn set_rate(env: &Env, from: &Address, to: &Address, rate: i128) {
    let key = DataKey::Rate(from.clone(), to.clone());
    env.storage().persistent().set(&key, &rate);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_TTL_THRESHOLD, LEDGER_TTL_PERSISTENT);
}

pub fn get_rate(env: &Env, from: &Address, to: &Address) -> Option<i128> {
    env.storage()
        .persistent()
        .get(&DataKey::Rate(from.clone(), to.clone()))
}

#[contracttype]
#[derive(Clone)]
pub enum PairListKey {
    List,
}

pub fn get_pair_list(env: &Env) -> Vec<AssetPair> {
    env.storage()
        .persistent()
        .get(&PairListKey::List)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn set_pair_list(env: &Env, pairs: &Vec<AssetPair>) {
    env.storage().persistent().set(&PairListKey::List, pairs);
    env.storage().persistent().extend_ttl(
        &PairListKey::List,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
}

/// Append a pair to the list and register it.
pub fn add_pair(env: &Env, from: &Address, to: &Address) {
    register_pair(env, from, to);
    let mut list = get_pair_list(env);
    list.push_back(AssetPair {
        from: from.clone(),
        to: to.clone(),
    });
    set_pair_list(env, &list);
}

/// Default maximum staleness for path intents (in ledgers).
pub const DEFAULT_MAX_PATH_STALENESS_LEDGERS: u32 = 30;

/// Store a path intent for time-bound execution.
pub fn store_path_intent(env: &Env, split_id: &String, intent: &PathIntent) {
    let key = DataKey::PathIntent(split_id.clone());
    env.storage().persistent().set(&key, intent);
    env.storage().persistent().extend_ttl(
        &key,
        LEDGER_TTL_THRESHOLD,
        LEDGER_TTL_PERSISTENT,
    );
}

/// Retrieve a stored path intent.
pub fn get_path_intent(env: &Env, split_id: &String) -> Option<PathIntent> {
    env.storage().persistent().get(&DataKey::PathIntent(split_id.clone()))
}

/// Check if a path intent exists.
pub fn has_path_intent(env: &Env, split_id: &String) -> bool {
    env.storage().persistent().has(&DataKey::PathIntent(split_id.clone()))
}
