//! # Path Payment Contract
//!
//! Automatic currency conversion using path payments: find paths, get rates,
//! execute multi-hop conversions with slippage protection.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, Env, IntoVal, String, Symbol, Vec,
};

mod error_map;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use crate::types::{Asset, Error, PathIntent};

/// Maximum path length (number of hops + 1 = number of assets in path).
const MAX_PATH_LEN: u32 = 6;

/// Maximum allowed staleness for path intents (default 30 ledgers).
const MAX_PATH_STALENESS_LEDGERS: u32 = 30;

#[contract]
pub struct PathPaymentContract;

#[contractimpl]
impl PathPaymentContract {
    /// Initialize with an admin. Admin can register pairs and set swap router.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if storage::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        storage::set_initialized(&env);
        events::emit_initialized(&env, &admin);
        Ok(())
    }

    /// Register a directed pair (from_asset -> to_asset) for path finding.
    pub fn register_pair(env: Env, from_asset: Asset, to_asset: Asset) -> Result<(), Error> {
        storage::get_admin(&env).require_auth();
        if !storage::is_initialized(&env) {
            return Err(Error::NotInitialized);
        }
        let from = from_asset.address();
        let to = to_asset.address();
        storage::add_pair(&env, from, to);
        events::emit_pair_registered(&env, from, to);
        Ok(())
    }

    /// Set conversion rate: amount of to_asset per 1e7 units of from_asset.
    pub fn set_rate(env: Env, from_asset: Asset, to_asset: Asset, rate: i128) -> Result<(), Error> {
        storage::get_admin(&env).require_auth();
        if !storage::is_initialized(&env) {
            return Err(Error::NotInitialized);
        }
        storage::set_rate(&env, from_asset.address(), to_asset.address(), rate);
        Ok(())
    }

    /// Set the swap router contract. Router must implement: swap(from, to, amount_in) -> i128.
    pub fn set_swap_router(env: Env, router: Address) -> Result<(), Error> {
        storage::get_admin(&env).require_auth();
        if !storage::is_initialized(&env) {
            return Err(Error::NotInitialized);
        }
        storage::set_swap_router(&env, &router);
        Ok(())
    }

    /// Find a payment path from source_asset to dest_asset using registered pairs (BFS).
    /// Returns path as [source_asset, ..., dest_asset] or Error::PathNotFound.
    /// Also stores a path intent with discovery ledger for time-bound execution.
    pub fn find_payment_path(
        env: Env,
        source_asset: Asset,
        dest_asset: Asset,
        _amount: i128,
        split_id: String,
    ) -> Result<Vec<Asset>, Error> {
        if !storage::is_initialized(&env) {
            return Err(Error::NotInitialized);
        }
        let source = source_asset.address().clone();
        let dest = dest_asset.address().clone();
        if source == dest {
            let mut path = Vec::new(&env);
            path.push_back(source_asset.clone());
            let intent = PathIntent {
                path: path.clone(),
                discovered_ledger: env.ledger().sequence(),
                split_id: split_id.clone(),
            };
            storage::store_path_intent(&env, &split_id, &intent);
            return Ok(path);
        }
        let pairs = storage::get_pair_list(&env);
        let mut queue = Vec::new(&env);
        queue.push_back(source.clone());
        let mut visited = Vec::new(&env);
        visited.push_back(source.clone());
        let mut parent: Vec<(Address, Address)> = Vec::new(&env);

        let mut found = false;
        let mut front = 0u32;
        while front < queue.len() {
            let current = queue.get(front).unwrap();
            front += 1;
            if current == dest {
                found = true;
                break;
            }
            for i in 0..pairs.len() {
                let pair = pairs.get(i).unwrap();
                if pair.from == current {
                    let to = pair.to.clone();
                    if !Self::vec_contains_address(&visited, &to) {
                        visited.push_back(to.clone());
                        parent.push_back((to.clone(), current.clone()));
                        queue.push_back(to);
                    }
                }
            }
        }
        if !found {
            return Err(Error::PathNotFound);
        }
        // Reconstruct path from dest to source
        let mut path_rev = Vec::new(&env);
        path_rev.push_back(dest.clone());
        let mut cur = dest.clone();
        while cur != source {
            let p = Self::find_parent(&parent, &cur).ok_or(Error::PathNotFound)?;
            path_rev.push_back(p.clone());
            cur = p;
        }
        // Reverse to get source -> dest
        let mut path = Vec::new(&env);
        for i in (0..path_rev.len()).rev() {
            path.push_back(Asset(path_rev.get(i).unwrap()));
        }
        if path.len() > MAX_PATH_LEN {
            return Err(Error::InvalidPath);
        }
        // Store path intent for time-bound execution
        let intent = PathIntent {
            path: path.clone(),
            discovered_ledger: env.ledger().sequence(),
            split_id: split_id.clone(),
        };
        storage::store_path_intent(&env, &split_id, &intent);
        events::emit_path_found(&env, &source, &dest, &path);
        Ok(path)
    }

    /// Get conversion rate from from_asset to to_asset (amount of to per 1e7 of from).
    /// Returns 0 if same asset or rate not set.
    pub fn get_conversion_rate(env: Env, from_asset: Asset, to_asset: Asset) -> i128 {
        if !storage::is_initialized(&env) {
            return 0;
        }
        let from = from_asset.address();
        let to = to_asset.address();
        if from == to {
            return 10_000_000_i128; // 1:1 in 7 decimals
        }
        storage::get_rate(&env, from, to).unwrap_or(0)
    }

    /// Execute path payment: pull source amount from caller, convert along path, enforce max_slippage.
    /// Uses stored path intent to validate staleness and per-step rate deviation.
    /// split_id: identifier for the split (must match stored intent from find_payment_path).
    /// amount_in: amount of path[0] to pull from caller (caller must approve).
    /// max_slippage: basis points (e.g. 100 = 1%). Returns amount of dest_asset received.
    /// Caller must authorize and approve transfer of amount_in of path[0].
    pub fn execute_path_payment(
        env: Env,
        caller: Address,
        split_id: String,
        _path: Vec<Asset>,
        amount_in: i128,
        max_slippage: u32,
    ) -> Result<i128, Error> {
        Self::execute_path_payment_internal(env, caller, split_id, amount_in, max_slippage)
    }

    fn execute_path_payment_internal(
        env: Env,
        caller: Address,
        split_id: String,
        amount_in: i128,
        max_slippage: u32,
    ) -> Result<i128, Error> {
        caller.require_auth();
        if !storage::is_initialized(&env) {
            return Err(Error::NotInitialized);
        }

        // Retrieve and validate path intent
        let intent = storage::get_path_intent(&env, &split_id).ok_or(Error::PathNotFound)?;
        let path = &intent.path;

        // Check path staleness - fail if discovered more than MAX_PATH_STALENESS_LEDGERS ago
        let current_ledger = env.ledger().sequence();
        let staleness = current_ledger
            .checked_sub(intent.discovered_ledger)
            .unwrap_or(u32::MAX);
        if staleness > MAX_PATH_STALENESS_LEDGERS {
            return Err(Error::PathExpired);
        }

        if path.is_empty() {
            return Err(Error::InvalidPath);
        }
        if path.len() > MAX_PATH_LEN {
            return Err(Error::InvalidPath);
        }
        if amount_in <= 0 {
            return Err(Error::InvalidAmount);
        }
        let source = path.get(0).unwrap();
        let dest = path.get(path.len() - 1).unwrap();
        let source_addr = source.address().clone();
        let dest_addr = dest.address().clone();

        let expected_dest = Self::simulate_path_amount(&env, path, amount_in)?;
        if expected_dest <= 0 {
            return Err(Error::RateNotAvailable);
        }
        // min_dest with slippage: expected_dest * (10000 - max_slippage) / 10000
        let min_dest = (expected_dest * (10000i128 - max_slippage as i128)) / 10000;

        // Pull source from caller
        let token_client = token::Client::new(&env, &source_addr);
        token_client.transfer(&caller, &env.current_contract_address(), &amount_in);

        let mut current_amount = amount_in;
        let mut current_asset = source_addr.clone();

        if path.len() == 1 {
            // Same asset: no conversion, just pull and report
            events::emit_path_payment_executed(
                &env,
                &split_id,
                &source_addr,
                &dest_addr,
                current_amount,
                1,
            );
            return Ok(current_amount);
        }

        let router = match storage::get_swap_router(&env) {
            Some(r) => r,
            None => {
                let to_asset = path.get(1).unwrap();
                events::emit_swap_failed(
                    &env,
                    &source_addr,
                    &to_asset.address().clone(),
                    amount_in,
                    "no_router_set",
                );
                return Err(Error::MissingRouter);
            }
        };
        for i in 0..path.len() - 1 {
            let from_asset = path.get(i).unwrap();
            let to_asset = path.get(i + 1).unwrap();
            let to_addr = to_asset.address().clone();
            let amount_out =
                Self::invoke_swap(&env, &router, &current_asset, &to_addr, current_amount);

            match amount_out {
                Ok(out) if out > 0 => {
                    // Per-step rate deviation check
                    let expected_out = Self::simulate_step_amount(
                        &env,
                        &current_asset,
                        &to_addr,
                        current_amount,
                    )?;
                    Self::check_step_slippage(
                        &env,
                        &current_asset,
                        &to_addr,
                        current_amount,
                        out,
                        max_slippage,
                    )?;
                    current_amount = out;
                    current_asset = to_addr;
                }
                Ok(_out) => {
                    events::emit_swap_failed(
                        &env,
                        &current_asset,
                        &to_addr,
                        current_amount,
                        "zero_or_negative_output",
                    );
                    return Err(Error::SwapFailed);
                }
                Err(_) => {
                    events::emit_swap_failed(
                        &env,
                        &current_asset,
                        &to_addr,
                        current_amount,
                        "invoke_error",
                    );
                    return Err(Error::SwapFailed);
                }
            }
        }

        if current_amount < min_dest {
            return Err(Error::SlippageExceeded);
        }

        events::emit_path_payment_executed(
            &env,
            &split_id,
            &source_addr,
            &dest_addr,
            current_amount,
            path.len(),
        );
        Ok(current_amount)
    }

    pub fn get_admin(env: Env) -> Address {
        storage::get_admin(&env)
    }

    pub fn get_swap_router(env: Env) -> Option<Address> {
        storage::get_swap_router(&env)
    }
}

impl PathPaymentContract {
    fn vec_contains_address(v: &Vec<Address>, a: &Address) -> bool {
        for i in 0..v.len() {
            if v.get(i).unwrap() == *a {
                return true;
            }
        }
        false
    }

    fn find_parent(parent: &Vec<(Address, Address)>, node: &Address) -> Option<Address> {
        for i in 0..parent.len() {
            let (n, p) = parent.get(i).unwrap();
            if n == *node {
                return Some(p);
            }
        }
        None
    }

    /// Simulate conversion along path for a given input amount; returns expected output.
    fn simulate_path_amount(env: &Env, path: &Vec<Asset>, amount_in: i128) -> Result<i128, Error> {
        if path.is_empty() {
            return Err(Error::InvalidPath);
        }
        if path.len() == 1 {
            return Ok(amount_in);
        }
        let mut amount = amount_in;
        for i in 0..path.len() - 1 {
            let from_asset = path.get(i).unwrap();
            let to_asset = path.get(i + 1).unwrap();
            let from = from_asset.address().clone();
            let to = to_asset.address().clone();
            let rate = storage::get_rate(env, &from, &to).ok_or(Error::RateNotAvailable)?;
            amount = (amount * rate) / 10_000_000;
            if amount <= 0 {
                return Err(Error::RateNotAvailable);
            }
        }
        Ok(amount)
    }

    fn invoke_swap(
        env: &Env,
        router: &Address,
        from: &Address,
        to: &Address,
        amount: i128,
    ) -> Result<i128, Error> {
        let swap_sym: Symbol = symbol_short!("swap");
        let result: i128 = env.invoke_contract(
            router,
            &swap_sym,
            (from.clone(), to.clone(), amount).into_val(env),
        );
        Ok(result)
    }

    /// Simulate a single swap step: returns expected output amount.
    fn simulate_step_amount(
        env: &Env,
        from: &Address,
        to: &Address,
        amount_in: i128,
    ) -> Result<i128, Error> {
        let rate = storage::get_rate(env, from, to).ok_or(Error::RateNotAvailable)?;
        let amount_out = (amount_in * rate) / 10_000_000;
        if amount_out <= 0 {
            return Err(Error::RateNotAvailable);
        }
        Ok(amount_out)
    }

    /// Check per-step slippage: actual_out must be within tolerance of expected_out.
    fn check_step_slippage(
        _env: &Env,
        from: &Address,
        to: &Address,
        amount_in: i128,
        actual_out: i128,
        max_slippage_bps: u32,
    ) -> Result<(), Error> {
        let expected_out = match Self::simulate_step_amount(_env, from, to, amount_in) {
            Ok(out) => out,
            Err(_) => return Err(Error::RateNotAvailable),
        };
        // Calculate min acceptable output with slippage tolerance
        let min_step_out = (expected_out * (10000i128 - max_slippage_bps as i128)) / 10000;
        if actual_out < min_step_out {
            return Err(Error::SlippageExceeded);
        }
        Ok(())
    }
}
