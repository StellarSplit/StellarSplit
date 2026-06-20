#![no_std]

mod action_adapter;
mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use action_adapter::{adapt_outcome, execute_action};
use errors::Error;
use soroban_sdk::{contract, contractimpl, vec, Address, Bytes, Env, IntoVal, String, Symbol, Val};
use types::{Dispute, DisputeResult, DisputeStatus};

const VOTING_PERIOD: u64 = 604_800; // 7 days in seconds

const MAX_SPLIT_ID_BYTES: usize = 64;

fn generate_dispute_id(env: &Env, split_id: &String) -> String {
    let split_len = split_id.len() as usize;
    assert!(split_len <= MAX_SPLIT_ID_BYTES);

    let mut split_buf = [0u8; MAX_SPLIT_ID_BYTES];
    split_id.copy_into_slice(&mut split_buf[..split_len]);
    let split_bytes = Bytes::from_slice(env, &split_buf[..split_len]);

    let mut input = Bytes::new(env);
    input.append(&split_bytes);
    let seq = env.ledger().sequence().to_be_bytes();
    input.append(&Bytes::from_slice(env, &seq));
    let hash = env.crypto().sha256(&input);
    let hash_bytes = &hash.to_array()[..8];
    let mut id_bytes = Bytes::from_slice(env, b"dis_");
    id_bytes.append(&Bytes::from_slice(env, hash_bytes));

    let id_buf = id_bytes.to_buffer::<32>();
    String::from_bytes(env, id_buf.as_slice())
}

#[contract]
pub struct DisputeContract;

#[contractimpl]
impl DisputeContract {
    /// Set the contract admin. Must be called once after deployment.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if storage::has_admin(&env) {
            return Err(Error::AlreadyExists);
        }
        storage::set_admin(&env, &admin);
        Ok(())
    }

    /// Raise a new dispute against a split.
    pub fn raise_dispute(
        env: Env,
        split_id: String,
        raiser: Address,
        reason: String,
        escrow_contract: Address,
        escrow_split_id: u64,
    ) -> Result<String, Error> {
        raiser.require_auth();

        let now = env.ledger().timestamp();
        let dispute_id = generate_dispute_id(&env, &split_id);

        if storage::has_dispute(&env, &dispute_id) {
            return Err(Error::AlreadyExists);
        }

        let dispute = Dispute {
            dispute_id: dispute_id.clone(),
            split_id,
            raiser,
            reason,
            status: DisputeStatus::Voting,
            votes_for: 0,
            votes_against: 0,
            voters: soroban_sdk::Vec::new(&env),
            created_at: now,
            voting_ends_at: now + VOTING_PERIOD,
            result: None,
            escrow_contract,
            escrow_split_id,
        };

        storage::save_dispute(&env, &dispute);
        storage::add_to_list(&env, dispute_id.clone());

        events::emit_dispute_raised(&env, &dispute_id, &dispute.split_id, &dispute.raiser);

        Ok(dispute_id)
    }

    /// Cast a vote on an open dispute.
    pub fn vote_on_dispute(
        env: Env,
        dispute_id: String,
        voter: Address,
        support: bool, // true = support the dispute, false = dismiss it
    ) -> Result<(), Error> {
        voter.require_auth();

        // FIX 1: Admin must never vote — prevents conflict of interest
        let admin = storage::get_admin(&env);
        if voter == admin {
            return Err(Error::NotAuthorized);
        }

        let mut dispute = storage::get_dispute(&env, &dispute_id)?;

        // Must be in Voting status
        if dispute.status != DisputeStatus::Voting {
            return Err(Error::DisputeClosed);
        }

        let now = env.ledger().timestamp();

        // Voting window must still be open
        if now > dispute.voting_ends_at {
            return Err(Error::VotingPeriodEnded);
        }

        // Each address can only vote once
        if storage::has_voted(&env, &dispute_id, &voter) {
            return Err(Error::AlreadyVoted);
        }

        // FIX 2: Record voter BEFORE counting the vote (makes duplicate guard atomic)
        dispute.voters.push_back(voter.clone());
        storage::record_vote(&env, &dispute_id, &voter);

        // Now count the vote
        if support {
            dispute.votes_for += 1;
        } else {
            dispute.votes_against += 1;
        }

        storage::save_dispute(&env, &dispute);

        events::emit_vote_cast(&env, &dispute_id, &voter, support);

        Ok(())
    }

    /// Resolve a dispute after voting period ends.
    pub fn resolve_dispute(
        env: Env,
        dispute_id: String,
        resolver: Address,
    ) -> Result<DisputeResult, Error> {
        let mut dispute = storage::get_dispute(&env, &dispute_id)?;

        if dispute.status != DisputeStatus::Voting {
            return Err(Error::DisputeClosed);
        }

        let now = env.ledger().timestamp();

        // Voting period must have ended
        if now <= dispute.voting_ends_at {
            return Err(Error::VotingPeriodActive);
        }

        // Determine result based on votes
        let result = if dispute.votes_for > dispute.votes_against {
            DisputeResult::UpheldForRaiser
        } else if dispute.votes_against > dispute.votes_for {
            DisputeResult::DismissedForRaiser
        } else {
            DisputeResult::Tied
        };

        // Auth boundary: only the escrow creator (owner) is allowed to finalize the escrow action.
        resolver.require_auth();

        let get_creator_sym = Symbol::new(&env, "get_creator");
        let get_creator_args: soroban_sdk::Vec<Val> =
            vec![&env, dispute.escrow_split_id.into_val(&env)];
        let escrow_creator: Address =
            env.invoke_contract(&dispute.escrow_contract, &get_creator_sym, get_creator_args);

        if resolver != escrow_creator {
            return Err(Error::UnauthorizedResolver);
        }

        // Drive the next step in the payment lifecycle via the action adapter.
        let action = adapt_outcome(result)?;
        execute_action(
            &env,
            action,
            &dispute.escrow_contract,
            dispute.escrow_split_id,
        );

        let result_code = match result {
            DisputeResult::UpheldForRaiser => 0u32,
            DisputeResult::DismissedForRaiser => 1u32,
            DisputeResult::Tied => 2u32,
        };

        dispute.status = DisputeStatus::Resolved;
        dispute.result = Some(result_code);
        storage::save_dispute(&env, &dispute);

        events::emit_dispute_resolved(&env, &dispute_id, result_code);

        Ok(result)
    }

    /// Get a dispute record.
    pub fn get_dispute(env: Env, dispute_id: String) -> Result<Dispute, Error> {
        storage::get_dispute(&env, &dispute_id)
    }

    /// Get all dispute IDs.
    pub fn get_all_disputes(env: Env) -> soroban_sdk::Vec<String> {
        storage::get_list(&env)
    }
}
