//! # Events Module for Multi-Signature Splits Contract

use soroban_sdk::{Address, Env, String};

/// Emit initialization event
pub fn emit_initialized(env: &Env, admin: &Address) {
    env.events().publish(("init", "admin"), admin.clone());
}

/// Emit multi-sig split created event
pub fn emit_split_created(env: &Env, split_id: &String, required_sigs: u32, time_lock: u64) {
    env.events().publish(
        ("split_created", "split_id", "required_sigs", "time_lock"),
        (split_id.clone(), required_sigs, time_lock),
    );
}

/// Emit signature added event
pub fn emit_signature_added(env: &Env, split_id: &String, signer: &Address) {
    env.events().publish(
        ("signature_added", "split_id", "signer"),
        (split_id.clone(), signer.clone()),
    );
}

/// Emit split executed event
pub fn emit_split_executed(env: &Env, split_id: &String) {
    env.events()
        .publish(("split_executed", "split_id"), split_id.clone());
}

/// Emit split cancelled event
pub fn emit_split_cancelled(env: &Env, split_id: &String, reason: &String) {
    env.events().publish(
        ("split_cancelled", "split_id", "reason"),
        (split_id.clone(), reason.clone()),
    );
}

/// Emit emergency override event
pub fn emit_emergency_override(env: &Env, split_id: &String, admin: &Address) {
    env.events().publish(
        ("emergency_override", "split_id", "admin"),
        (split_id.clone(), admin.clone()),
    );
}

/// Emit signer added event
pub fn emit_signer_added(env: &Env, split_id: &String, signer: &Address) {
    env.events().publish(
        ("signer_added", "split_id", "signer"),
        (split_id.clone(), signer.clone()),
    );
}

/// Emit signer removed event
pub fn emit_signer_removed(env: &Env, split_id: &String, signer: &Address) {
    env.events().publish(
        ("signer_removed", "split_id", "signer"),
        (split_id.clone(), signer.clone()),
    );
}

/// Emit threshold updated event
pub fn emit_threshold_updated(
    env: &Env,
    split_id: &String,
    old_threshold: u32,
    new_threshold: u32,
) {
    env.events().publish(
        (
            "threshold_updated",
            "split_id",
            "old_threshold",
            "new_threshold",
        ),
        (split_id.clone(), old_threshold, new_threshold),
    );
}

/// Emit governance changed event (for any governance-related changes)
pub fn emit_governance_changed(
    env: &Env,
    split_id: &String,
    change_type: &String,
    actor: &Address,
) {
    env.events().publish(
        ("governance_changed", "split_id", "change_type", "actor"),
        (split_id.clone(), change_type.clone(), actor.clone()),
    );
}

/// Emit execution intent recorded event
pub fn emit_execution_intent_recorded(
    env: &Env,
    split_id: &String,
    action: &String,
    recorded_at: u64,
) {
    env.events().publish(
        (
            "execution_intent_recorded",
            "split_id",
            "action",
            "recorded_at",
        ),
        (split_id.clone(), action.clone(), recorded_at),
    );
}

/// Emit execution intent executed event
pub fn emit_execution_intent_executed(env: &Env, split_id: &String, executed_at: u64) {
    env.events().publish(
        ("execution_intent_executed", "split_id", "executed_at"),
        (split_id.clone(), executed_at),
    );
}
