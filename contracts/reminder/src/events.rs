use soroban_sdk::{Address, Env, String, Symbol};

pub fn emit_reminder_requested(env: &Env, participant: Address, split_id: &String) {
    env.events().publish(
        (Symbol::new(env, "ReminderRequested"), participant),
        split_id.clone(),
    );
}

pub fn emit_reminder_cancelled(env: &Env, participant: Address, split_id: &String) {
    env.events().publish(
        (Symbol::new(env, "ReminderCancelled"), participant),
        split_id.clone(),
    );
}
