//! Event assertion utilities for staking contract tests.

use soroban_sdk::{testutils::Events, Address, Env, IntoVal, Symbol, TryFromVal, Val, Vec};

/// Assert that an event was emitted with the expected topic and data.
pub fn assert_event_emitted(
    env: &Env,
    expected_topic: (Symbol, Symbol),
    expected_data: impl IntoVal<Env, Val>,
) {
    let events = env.events().all();
    let expected_data_val = expected_data.into_val(env);

    let found = events.iter().any(|event| {
        let (_contract_id, topics, data) = event;
        // Assuming events are from the staking contract
        if topics.len() >= 2 {
            let topic0 = topics.get(0).unwrap();
            let topic1 = topics.get(1).unwrap();
            if let (Ok(t0), Ok(t1)) = (
                Symbol::try_from_val(env, &topic0),
                Symbol::try_from_val(env, &topic1),
            ) {
                if t0 == expected_topic.0 && t1 == expected_topic.1 {
                    let d_vec = Vec::<Val>::try_from_val(env, &data);
                    let e_vec = Vec::<Val>::try_from_val(env, &expected_data_val);
                    if let (Ok(dv), Ok(ev)) = (d_vec, e_vec) {
                        return dv == ev;
                    }
                }
            }
        }
        false
    });

    assert!(
        found,
        "Expected event not found: topic={:?}, data={:?}",
        expected_topic, expected_data_val
    );
}

/// Assert that a staking event was emitted for the given action.
pub fn assert_staking_event(env: &Env, action: &str, staker: &Address, amount: i128) {
    let topic = (
        soroban_sdk::symbol_short!("staking"),
        soroban_sdk::Symbol::new(env, action),
    );
    assert_event_emitted(env, topic, (staker, amount));
}

/// Assert that a delegation event was emitted.
pub fn assert_delegation_event(env: &Env, delegator: &Address, delegatee: &Option<Address>) {
    let topic = (
        soroban_sdk::symbol_short!("staking"),
        soroban_sdk::symbol_short!("delegate"),
    );
    assert_event_emitted(env, topic, (delegator.clone(), delegatee.clone()));
}

/// Assert that an unstake event was emitted with unlock time.
pub fn assert_unstake_event(env: &Env, staker: &Address, amount: i128, unlock_time: u64) {
    let topic = (
        soroban_sdk::symbol_short!("staking"),
        soroban_sdk::symbol_short!("unstake"),
    );
    assert_event_emitted(env, topic, (staker, amount, unlock_time));
}

/// Assert that a reward deposit event was emitted.
pub fn assert_reward_deposit_event(env: &Env, admin: &Address, amount: i128) {
    let topic = (
        soroban_sdk::symbol_short!("staking"),
        soroban_sdk::symbol_short!("deposit"),
    );
    assert_event_emitted(env, topic, (admin, amount));
}
