#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, Env};

mod errors;
#[cfg(test)]
mod event_assertions;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod event_assertions;
#[cfg(test)]
mod test;

pub use crate::errors::*;
pub use crate::types::*;

#[contract]
pub struct StakingContract;

#[contractimpl]
impl StakingContract {
    /// Initialize the staking contract
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if storage::get_admin(&env).is_some() {
            return Err(Error::AlreadyInitialized);
        }
        storage::set_admin(&env, &admin);
        storage::set_token(&env, &token);
        storage::set_reward_index(&env, 0);
        storage::set_total_staked(&env, 0);

        events::emit_initialized(&env, &admin, &token);
        Ok(())
    }

    /// Stake tokens for voting power and rewards
    pub fn stake(env: Env, staker: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        staker.require_auth();

        let token_address = storage::get_token(&env).ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);

        // Update rewards before changing stake
        Self::update_staker_rewards(&env, &staker)?;

        // Transfer tokens to contract
        token_client.transfer(&staker, &env.current_contract_address(), &amount);

        // Update staker info
        let mut info = storage::get_staker_info(&env, &staker).unwrap_or(StakerInfo {
            amount: 0,
            pending_withdrawal: 0,
            unlock_time: 0,
            last_reward_index: storage::get_reward_index(&env),
            accumulated_rewards: 0,
            delegated_to: None,
        });

        info.amount += amount;
        storage::set_staker_info(&env, &staker, &info);

        // Update total staked
        let total_staked = storage::get_total_staked(&env);
        storage::set_total_staked(&env, total_staked + amount);

        // Update delegated amount for delegatee
        if let Some(delegatee) = &info.delegated_to {
            let delegated_amount = storage::get_delegated_amount(&env, delegatee);
            storage::set_delegated_amount(&env, delegatee, delegated_amount + amount);
        }

        events::emit_staked(&env, &staker, amount);
        Ok(())
    }

    /// Initiate unstaking with a cooldown period (e.g., 7 days)
    pub fn unstake(env: Env, staker: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        staker.require_auth();

        let mut info = storage::get_staker_info(&env, &staker).ok_or(Error::InsufficientStake)?;
        if info.amount < amount {
            return Err(Error::InsufficientStake);
        }

        // Update rewards before changing stake
        Self::update_staker_rewards(&env, &staker)?;

        // Move from staked to pending withdrawal
        info.amount -= amount;
        info.pending_withdrawal += amount;
        // Cooldown period: 7 days (60 * 60 * 24 * 7 = 604800 seconds)
        info.unlock_time = env.ledger().timestamp() + 604800;

        storage::set_staker_info(&env, &staker, &info);

        // Update total staked
        let total_staked = storage::get_total_staked(&env);
        storage::set_total_staked(&env, total_staked - amount);

        // Update delegated amount for delegatee
        if let Some(delegatee) = &info.delegated_to {
            let delegated_amount = storage::get_delegated_amount(&env, delegatee);
            storage::set_delegated_amount(&env, delegatee, delegated_amount - amount);
        }

        events::emit_unstaked(&env, &staker, amount, info.unlock_time);
        Ok(())
    }

    /// Claim accumulated rewards
    pub fn claim_staking_rewards(env: Env, staker: Address) -> Result<i128, Error> {
        staker.require_auth();

        Self::update_staker_rewards(&env, &staker)?;

        let mut info = storage::get_staker_info(&env, &staker).ok_or(Error::NoRewardsToClaim)?;
        let rewards = info.accumulated_rewards;

        if rewards <= 0 {
            return Err(Error::NoRewardsToClaim);
        }

        info.accumulated_rewards = 0;
        storage::set_staker_info(&env, &staker, &info);

        // Transfer rewards to staker
        let token_address = storage::get_token(&env).ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &staker, &rewards);

        events::emit_rewards_claimed(&env, &staker, rewards);
        Ok(rewards)
    }

    /// Delegate voting power to another address
    pub fn delegate_voting_power(
        env: Env,
        delegator: Address,
        delegatee: Option<Address>,
    ) -> Result<(), Error> {
        delegator.require_auth();

        let mut info =
            storage::get_staker_info(&env, &delegator).ok_or(Error::InsufficientStake)?;

        // Remove old delegation
        if let Some(old_delegatee) = &info.delegated_to {
            let delegated_amount = storage::get_delegated_amount(&env, old_delegatee);
            storage::set_delegated_amount(&env, old_delegatee, delegated_amount - info.amount);
        }

        // Add new delegation
        if let Some(new_delegatee) = &delegatee {
            let delegated_amount = storage::get_delegated_amount(&env, new_delegatee);
            storage::set_delegated_amount(&env, new_delegatee, delegated_amount + info.amount);
        }

        info.delegated_to = delegatee.clone();
        storage::set_staker_info(&env, &delegator, &info);

        events::emit_delegated(&env, &delegator, &delegatee);
        Ok(())
    }

    /// Finalize withdrawal after cooldown
    pub fn withdraw(env: Env, staker: Address) -> Result<(), Error> {
        staker.require_auth();

        let mut info = storage::get_staker_info(&env, &staker).ok_or(Error::InsufficientStake)?;

        if info.pending_withdrawal <= 0 {
            return Err(Error::InvalidAmount);
        }

        if env.ledger().timestamp() < info.unlock_time {
            return Err(Error::CooldownActive);
        }

        let amount = info.pending_withdrawal;
        info.pending_withdrawal = 0;
        info.unlock_time = 0;
        storage::set_staker_info(&env, &staker, &info);

        // Transfer tokens back to staker
        let token_address = storage::get_token(&env).ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &staker, &amount);

        events::emit_withdrawn(&env, &staker, amount);
        Ok(())
    }

    /// Admin function to add rewards to the pool
    pub fn deposit_rewards(env: Env, admin: Address, amount: i128) -> Result<(), Error> {
        admin.require_auth();
        let stored_admin = storage::get_admin(&env).ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let total_staked = storage::get_total_staked(&env);
        if total_staked == 0 {
            // If no stakers, rewards are just held or handled differently
            // For now, let's assume we can't deposit if no one is staking
            return Err(Error::InvalidAmount);
        }

        let token_address = storage::get_token(&env).ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&admin, &env.current_contract_address(), &amount);

        // Increase reward index: amount * scaling_factor / total_staked
        // Scaling factor to keep precision (e.g., 10^12)
        let scaling_factor = 1_000_000_000_000i128;
        let index_increase = (amount * scaling_factor) / total_staked;
        let current_index = storage::get_reward_index(&env);
        storage::set_reward_index(&env, current_index + index_increase);

        events::emit_reward_deposited(&env, &admin, amount);
        Ok(())
    }

    /// Get total voting power (staked + delegated)
    pub fn get_voting_power(env: Env, address: Address) -> i128 {
        let staked = storage::get_staker_info(&env, &address)
            .map(|i| i.amount)
            .unwrap_or(0);
        let delegated = storage::get_delegated_amount(&env, &address);
        staked + delegated
    }

    fn update_staker_rewards(env: &Env, staker: &Address) -> Result<(), Error> {
        let mut info = match storage::get_staker_info(env, staker) {
            Some(i) => i,
            None => return Ok(()),
        };

        let global_index = storage::get_reward_index(env);
        if info.last_reward_index < global_index {
            let scaling_factor = 1_000_000_000_000i128;
            let delta = global_index - info.last_reward_index;
            let earned = (info.amount * delta) / scaling_factor;

            info.accumulated_rewards += earned;
            info.last_reward_index = global_index;
            storage::set_staker_info(env, staker, &info);
        }
        Ok(())
    }
}
