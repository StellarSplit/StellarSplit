/// Test helpers for split-escrow deposit accounting scenarios.
///
/// Provides factory functions and assertion utilities used across deposit-related
/// test cases so each test stays focused on the behaviour under examination rather
/// than boilerplate setup.
#[cfg(test)]
use soroban_sdk::{Address, Env, Map, String};

#[cfg(test)]
use crate::types::{Split, SplitStatus};

/// Returns a minimal `Split` in `Pending` state with the given obligations.
///
/// `obligations` maps participant address → expected contribution.
/// `total_amount` is derived as the sum of all obligation values so the
/// invariant `sum(obligations) == total_amount` always holds for test fixtures.
#[cfg(test)]
pub fn make_split(
    env: &Env,
    split_id: u64,
    creator: Address,
    obligations: Map<Address, i128>,
) -> Split {
    let total_amount: i128 = {
        let keys = obligations.keys();
        let mut sum = 0i128;
        for i in 0..keys.len() {
            let k = keys.get(i).unwrap();
            sum += obligations.get(k).unwrap();
        }
        sum
    };

    let mut participants = soroban_sdk::Vec::new(env);
    let keys = obligations.keys();
    for i in 0..keys.len() {
        participants.push_back(keys.get(i).unwrap());
    }

    Split {
        split_id,
        creator,
        description: String::from_str(env, "test escrow"),
        metadata: Map::new(env),
        total_amount,
        deposited_amount: 0,
        status: SplitStatus::Pending,
        max_participants: 50,
        participants,
        balances: Map::new(env),
        deposits: Map::new(env),
        obligations,
        note: String::from_str(env, ""),
    }
}

/// Assert that the `deposited_amount` on a split equals `expected`.
#[cfg(test)]
pub fn assert_deposited(split: &Split, expected: i128) {
    assert_eq!(
        split.deposited_amount, expected,
        "deposited_amount mismatch: got {}, want {}",
        split.deposited_amount, expected,
    );
}

/// Assert that the per-participant balance for `participant` equals `expected`.
#[cfg(test)]
pub fn assert_balance(split: &Split, participant: &Address, expected: i128) {
    let actual = split.balances.get(participant.clone()).unwrap_or(0i128);
    assert_eq!(
        actual, expected,
        "balance mismatch for participant: got {}, want {}",
        actual, expected,
    );
}

/// Assert that the split status matches `expected`.
#[cfg(test)]
pub fn assert_status(split: &Split, expected: SplitStatus) {
    assert_eq!(
        split.status, expected,
        "status mismatch: got {:?}, want {:?}",
        split.status, expected,
    );
}

/// Simulate a deposit into a split without invoking token transfers.
///
/// Used in unit tests that focus purely on accounting logic so the tests do not
/// need a live token contract.  Updates `balances`, `deposited_amount`, and
/// transitions `status` to `Ready` when `deposited_amount == total_amount`.
#[cfg(test)]
pub fn simulate_deposit(split: &mut Split, participant: Address, amount: i128) {
    let previous = split.deposits.get(participant.clone()).unwrap_or(0i128);

    // First deposit: register participant.
    if previous == 0 {
        split.participants.push_back(participant.clone());
    }

    split.deposits.set(participant.clone(), previous + amount);
    split.balances.set(participant, previous + amount);
    split.deposited_amount += amount;

    if split.deposited_amount >= split.total_amount {
        split.status = SplitStatus::Ready;
    }
}
