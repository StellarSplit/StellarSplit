use soroban_sdk::{Address, Env, String, Symbol};

use crate::Badge;
use crate::metadata;
use crate::types::*;
use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_ADMIN: Symbol           = Symbol::short("ADMIN");
const KEY_ESCROW_CONTRACT: Symbol = Symbol::short("ESCROW");

fn badge_key(env: &Env, user: &Address, escrow_id: &String) -> soroban_sdk::Val {
    (Symbol::new(env, "BADGE"), user.clone(), escrow_id.clone()).into_val(env)
}

// ─── Admin ────────────────────────────────────────────────────────────────────

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&KEY_ADMIN, admin);
}

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&KEY_ADMIN)
        .expect("contract not initialized")
}

// ─── Escrow contract address ──────────────────────────────────────────────────

/// Store the trusted escrow contract address at initialization time.
/// This is the address `mint_badge_with_evidence` cross-references for
/// on-chain verification — callers cannot override it.
pub fn set_escrow_contract(env: &Env, escrow: &Address) {
    env.storage().instance().set(&KEY_ESCROW_CONTRACT, escrow);
}

pub fn get_escrow_contract(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&KEY_ESCROW_CONTRACT)
        .expect("escrow contract address not set — call initialize first")
}

// ─── Badges ───────────────────────────────────────────────────────────────────

pub fn save_badge(env: &Env, user: &Address, escrow_id: &String, badge: &Badge) {
    env.storage()
        .persistent()
        .set(&badge_key(env, user, escrow_id), badge);
}

pub fn has_badge(env: &Env, user: &Address, escrow_id: &String) -> bool {
    env.storage()
        .persistent()
        .has(&badge_key(env, user, escrow_id))
}

pub fn remove_badge(env: &Env, user: &Address, escrow_id: &String) {
    env.storage()
        .persistent()
        .remove(&badge_key(env, user, escrow_id));
}