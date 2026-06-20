use soroban_sdk::{symbol_short, Address, Env, String};

/// Emitted when a new dispute is raised against a split.
///
/// Topics : ("dispute", "raised")
/// Data   : (dispute_id, split_id, raiser)
pub fn emit_dispute_raised(env: &Env, dispute_id: &String, split_id: &String, raiser: &Address) {
    env.events().publish(
        (symbol_short!("dispute"), symbol_short!("raised")),
        (dispute_id.clone(), split_id.clone(), raiser.clone()),
    );
}

/// Emitted when a participant casts a vote on an open dispute.
///
/// Topics : ("dispute", "voted")
/// Data   : (dispute_id, voter, support)
pub fn emit_vote_cast(env: &Env, dispute_id: &String, voter: &Address, support: bool) {
    env.events().publish(
        (symbol_short!("dispute"), symbol_short!("voted")),
        (dispute_id.clone(), voter.clone(), support),
    );
}

/// Emitted when a dispute is resolved after the voting period ends.
///
/// Topics : ("dispute", "resolved")
/// Data   : (dispute_id, result_code)
///
/// result_code mirrors DisputeResult:
///   0 = UpheldForRaiser
///   1 = DismissedForRaiser
///   2 = Tied
pub fn emit_dispute_resolved(env: &Env, dispute_id: &String, result_code: u32) {
    env.events().publish(
        (symbol_short!("dispute"), symbol_short!("resolved")),
        (dispute_id.clone(), result_code),
    );
}
