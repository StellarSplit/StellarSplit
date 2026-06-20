//! # Storage Module for Multi-Signature Splits Contract

use crate::types::*;
use soroban_sdk::{symbol_short, Address, Env, String, Symbol, Vec};

/// Storage keys
const ADMIN: Symbol = symbol_short!("ADMIN");
const SIGNED: Symbol = symbol_short!("SIGNED");

fn signed_key(split_id: &String, signer: &Address) -> (Symbol, String, Address) {
    (SIGNED, split_id.clone(), signer.clone())
}

// ============================================================================
// Helper Routines for Safe Signer List Mutations
// ============================================================================

/// Find the index of a signer in the signer list without moving values.
/// Returns Option<u32> with the position if found, None otherwise.
fn find_signer_index(split: &MultisigSplit, signer: &Address) -> Option<u32> {
    for i in 0..split.signers.len() {
        if let Some(s) = split.signers.get(i) {
            if &s == signer {
                return Some(i as u32);
            }
        }
    }
    None
}

/// Add a signer to the split list if not already present.
/// Preserves signer ordering and maintains state consistency.
/// Returns Ok(true) if signer was added, Ok(false) if already exists, or an error.
fn signer_list_add(
    env: &Env,
    split: &mut MultisigSplit,
    signer: &Address,
) -> Result<bool, MultisigError> {
    // Check if signer already exists
    if find_signer_index(split, signer).is_some() {
        return Ok(false); // Already exists
    }

    // Add the new signer (preserves order - added at end)
    split.signers.push_back(signer.clone());
    Ok(true) // Successfully added
}

/// Remove a signer from the split list while maintaining state integrity.
/// Handles signature cleanup for the removed signer.
/// Preserves signer ordering by reconstructing the vector.
/// Returns Ok(true) if signer was removed, or an error.
fn signer_list_remove(
    env: &Env,
    split: &mut MultisigSplit,
    split_id: &String,
    signer: &Address,
) -> Result<bool, MultisigError> {
    // Find the index
    let idx = match find_signer_index(split, signer) {
        Some(i) => i,
        None => return Ok(false), // Not found
    };

    // Cannot remove the last signer
    if split.signers.len() == 1 {
        return Err(MultisigError::CannotRemoveLastSigner);
    }

    // If this signer had signed, clean up their signature record and decrement count
    if has_signed(env, split_id, signer) && split.current_signatures > 0 {
        split.current_signatures -= 1;
        env.storage()
            .persistent()
            .remove(&signed_key(split_id, signer));
    }

    // Rebuild the signer vector without the removed signer (preserves order)
    let mut new_signers = Vec::new(env);
    for i in 0..split.signers.len() {
        if let Some(s) = split.signers.get(i) {
            if &s != signer {
                new_signers.push_back(s);
            }
        }
    }

    split.signers = new_signers;

    // Adjust threshold if it now exceeds the number of signers
    if split.required_signatures > split.signers.len() as u32 {
        split.required_signatures = split.signers.len() as u32;
    }

    Ok(true) // Successfully removed
}

/// Set the admin address
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&ADMIN, admin);
}

/// Get the admin address
pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&ADMIN).unwrap()
}

/// Check if admin is set
pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&ADMIN)
}

/// Check if a multi-sig split exists
pub fn split_exists(env: &Env, split_id: &String) -> bool {
    env.storage().persistent().has(split_id)
}

/// Get a multi-sig split by ID
pub fn get_split(env: &Env, split_id: &String) -> MultisigSplit {
    env.storage().persistent().get(split_id).unwrap()
}

/// Save a multi-sig split
pub fn save_split(env: &Env, split: &MultisigSplit) {
    env.storage().persistent().set(&split.split_id, split);
}

/// Check if an address has signed a split
pub fn has_signed(env: &Env, split_id: &String, signer: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&signed_key(split_id, signer))
}

/// Check if an address is an authorized signer
pub fn is_signer(env: &Env, split_id: &String, signer: &Address) -> bool {
    let split = get_split(env, split_id);
    for i in 0..split.signers.len() {
        if &split.signers.get(i).unwrap() == signer {
            return true;
        }
    }
    false
}

/// Add a signature to a split
pub fn add_signature(env: &Env, split_id: &String, signer: &Address) {
    let mut split = get_split(env, split_id);
    split.current_signatures += 1;
    env.storage()
        .persistent()
        .set(&signed_key(split_id, signer), &true);
    save_split(env, &split);
}

/// Add a new signer to the split using safe mutation helper.
pub fn add_signer(env: &Env, split_id: &String, signer: &Address) -> Result<(), MultisigError> {
    let mut split = get_split(env, split_id);

    // Use helper routine for safe addition
    let was_added = signer_list_add(env, &mut split, signer)?;

    if !was_added {
        return Err(MultisigError::SignerAlreadyExists);
    }

    save_split(env, &split);
    Ok(())
}

/// Remove a signer from the split using safe mutation helper.
pub fn remove_signer(env: &Env, split_id: &String, signer: &Address) -> Result<(), MultisigError> {
    let mut split = get_split(env, split_id);

    // Use helper routine for safe removal
    let was_removed = signer_list_remove(env, &mut split, split_id, signer)?;

    if !was_removed {
        return Err(MultisigError::SignerNotFound);
    }

    save_split(env, &split);
    Ok(())
}

/// Update the signature threshold
pub fn update_threshold(
    env: &Env,
    split_id: &String,
    new_threshold: u32,
) -> Result<(), MultisigError> {
    let mut split = get_split(env, split_id);
    let num_signers = split.signers.len() as u32;

    // Validate threshold
    if new_threshold == 0 {
        return Err(MultisigError::ThresholdTooLow);
    }

    if new_threshold > num_signers {
        return Err(MultisigError::ThresholdTooHigh);
    }

    split.required_signatures = new_threshold;
    save_split(env, &split);
    Ok(())
}

/// Check if a split can be executed
pub fn can_execute(env: &Env, split: &MultisigSplit) -> bool {
    split.status == MultisigStatus::Active
        && split.current_signatures >= split.required_signatures
        && env.ledger().timestamp() >= split.created_at + split.time_lock
}

/// Check if a split has expired
pub fn is_expired(env: &Env, split: &MultisigSplit) -> bool {
    env.ledger().timestamp() > split.created_at + split.time_lock + 86400 // 24 hours grace period
}

/// Update split status
pub fn update_split_status(env: &Env, split_id: &String, status: &MultisigStatus) {
    let mut split = get_split(env, split_id);
    split.status = status.clone();
    if *status == MultisigStatus::Executed {
        split.executed_at = env.ledger().timestamp();
    }
    save_split(env, &split);
}

// ============================================================================
// Execution Intent Tracking
// ============================================================================

/// Storage key for execution intents
const INTENT: Symbol = symbol_short!("INTENT");

fn intent_key(split_id: &String) -> (Symbol, String) {
    (INTENT, split_id.clone())
}

/// Record an execution intent for a split.
/// Creates a new internal action record that tracks what action will be executed.
pub fn record_execution_intent(env: &Env, split_id: &String, action: &String) -> ExecutionIntent {
    let now = env.ledger().timestamp();
    let intent = ExecutionIntent {
        intent_id: split_id.clone(),
        split_id: split_id.clone(),
        action: action.clone(),
        recorded_at: now,
        executed_at: 0,
        is_executed: false,
    };

    env.storage()
        .persistent()
        .set(&intent_key(split_id), &intent);

    intent
}

/// Get an execution intent for a split if it exists.
pub fn get_execution_intent(env: &Env, split_id: &String) -> Option<ExecutionIntent> {
    env.storage().persistent().get(&intent_key(split_id))
}

/// Mark an execution intent as executed with the current timestamp.
pub fn mark_intent_executed(env: &Env, split_id: &String) {
    if let Some(mut intent) = get_execution_intent(env, split_id) {
        intent.executed_at = env.ledger().timestamp();
        intent.is_executed = true;
        env.storage()
            .persistent()
            .set(&intent_key(split_id), &intent);
    }
}
