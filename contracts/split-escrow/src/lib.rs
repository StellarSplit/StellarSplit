#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, Env, Map, String, Vec};

mod errors;
mod events;
mod fees;
mod storage;
mod test;
mod types;

pub use crate::errors::Error;
pub use crate::types::{ParticipantBalance, Split, SplitStatus};

const DEFAULT_MAX_PARTICIPANTS: u32 = 50;
const MAX_NOTE_LEN: u32 = 128;
const MAX_METADATA_ENTRIES: u32 = 32;
const MAX_METADATA_STRING_LEN: u32 = 128;

fn validate_note_len(note: &String) -> Result<(), Error> {
    if note.len() > MAX_NOTE_LEN {
        return Err(Error::InvalidInput);
    }
    Ok(())
}

fn participant_known(participants: &Vec<Address>, addr: &Address) -> bool {
    let mut i = 0u32;
    while i < participants.len() {
        if participants.get(i).unwrap() == *addr {
            return true;
        }
        i += 1;
    }
    false
}

fn validate_metadata(metadata: &Map<String, String>) -> Result<(), Error> {
    if metadata.len() > MAX_METADATA_ENTRIES {
        return Err(Error::InvalidMetadata);
    }

    let keys = metadata.keys();
    let mut i = 0u32;
    while i < keys.len() {
        let key = keys.get(i).unwrap();
        let value = metadata.get(key.clone()).unwrap();
        if key.len() > MAX_METADATA_STRING_LEN || value.len() > MAX_METADATA_STRING_LEN {
            return Err(Error::InvalidMetadata);
        }
        i += 1;
    }

    Ok(())
}

fn is_active(status: &SplitStatus) -> bool {
    *status != SplitStatus::Released && *status != SplitStatus::Cancelled
}

#[contract]
pub struct SplitEscrowContract;

#[contractimpl]
impl SplitEscrowContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        token_address: Address,
        version: String,
    ) -> Result<(), Error> {
        if storage::has_admin(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();

        validate_version(&version)?;

        storage::set_admin(&env, &admin);
        storage::set_token(&env, &token_address);
        storage::set_fee_bps(&env, 0u32);
        storage::set_version(&env, &version);
        events::emit_initialized(&env, &admin);
        Ok(())
    }

    pub fn get_version(env: Env) -> String {
        storage::get_version(&env)
    }

    pub fn upgrade_version(env: Env, new_version: String) -> Result<(), Error> {
        let admin = storage::get_admin(&env);
        admin.require_auth();

        validate_version(&new_version)?;

        let old_version = storage::get_version(&env);
        storage::set_version(&env, &new_version);
        events::emit_contract_upgraded(&env, old_version, new_version);
        Ok(())
    }

    /// Create an escrow split. If `max_participants` is `None`, the cap defaults to 50.
    /// `metadata` must satisfy map size and string length limits. If `note` is `None`, note is empty.
    pub fn create_escrow(
        env: Env,
        creator: Address,
        description: String,
        total_amount: i128,
        metadata: Map<String, String>,
        obligations: Map<Address, i128>,
        max_participants: Option<u32>,
        whitelist_enabled: bool,
        note: Option<String>,
    ) -> Result<u64, Error> {
        if !storage::has_admin(&env) {
            return Err(Error::NotInitialized);
        }
        creator.require_auth();
        if total_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Validate that total_amount matches sum of obligations.
        let mut sum_obligations = 0i128;
        let keys = obligations.keys();
        for i in 0..keys.len() {
            let key = keys.get(i).unwrap();
            let val = obligations.get(key).unwrap();
            if val <= 0 {
                return Err(Error::InvalidAmount);
            }
            sum_obligations += val;
        }
        if sum_obligations != total_amount {
            return Err(Error::TotalAmountMismatch);
        }

        let cap = max_participants.unwrap_or(DEFAULT_MAX_PARTICIPANTS);

        validate_metadata(&metadata)?;

        let note_stored = match note {
            Some(n) => {
                validate_note_len(&n)?;
                n
            }
            None => String::from_str(&env, ""),
        };

        let split_id = storage::get_next_split_id(&env);
        storage::bump_next_split_id(&env);

        let participants = Vec::new(&env);

        let split = Split {
            split_id,
            creator,
            description,
            metadata,
            total_amount,
            deposited_amount: 0,
            status: SplitStatus::Pending,
            max_participants: cap,
            participants,
            balances: Map::new(&env),
            deposits: Map::new(&env),
            obligations,
            note: note_stored,
        };
        storage::set_split(&env, &split);
        storage::set_whitelist_enabled(&env, split_id, whitelist_enabled);
        events::emit_split_created(&env, &split);
        Ok(split_id)
    }

    /// Creator-only: update the on-chain note while the escrow is active (Pending or Ready).
    pub fn set_note(env: Env, split_id: u64, note: String) -> Result<(), Error> {
        validate_note_len(&note)?;
        let mut split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        split.creator.require_auth();
        if !is_active(&split.status) {
            return Err(Error::SplitNotActive);
        }
        if split.note == note {
            return Ok(());
        }
        split.note = note.clone();
        storage::set_split(&env, &split);
        events::emit_note_updated(&env, split_id, &note);
        Ok(())
    }

    /// Cancel a split and refund all deposited participant balances.
    /// Used when a dispute is upheld (raiser wins).
    pub fn cancel_split(env: Env, split_id: u64) -> Result<(), Error> {
        let mut split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        // Only the split creator can cancel/refund.
        split.creator.require_auth();

        if split.status == SplitStatus::Released || split.status == SplitStatus::Cancelled {
            return Err(Error::SplitNotActive);
        }

        let token_address = storage::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);

        // Refund all distinct participants.
        let participants_len = split.participants.len();
        let mut i = 0u32;
        while i < participants_len {
            let participant = split.participants.get(i).unwrap();
            let amount = split.balances.get(participant.clone()).unwrap_or(0i128);
            if amount > 0 {
                token_client.transfer(&env.current_contract_address(), &participant, &amount);
                split.balances.set(participant.clone(), 0i128);
                split.deposits.set(participant, 0i128);
            }
            i += 1;
        }

        // Clear participants list; split is now cancelled and cannot be released.
        split.participants = Vec::new(&env);
        split.deposited_amount = 0;
        split.status = SplitStatus::Cancelled;
        storage::set_split(&env, &split);
        events::emit_cancelled(&env, split_id);
        Ok(())
    }

    /// Public read of the escrow note (empty string if none was set).
    pub fn get_note(env: Env, split_id: u64) -> Result<String, Error> {
        let split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        Ok(split.note.clone())
    }

    pub fn deposit(
        env: Env,
        split_id: u64,
        participant: Address,
        amount: i128,
    ) -> Result<(), Error> {
        participant.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        if split.status != SplitStatus::Pending {
            return Err(Error::SplitNotPending);
        }

        if storage::is_whitelist_enabled(&env, split_id)
            && !storage::is_whitelisted(&env, split_id, &participant)
        {
            return Err(Error::Unauthorized);
        }

        let obligation = split
            .obligations
            .get(participant.clone())
            .ok_or(Error::ParticipantNotOwed)?;
        if obligation <= 0 {
            return Err(Error::InvalidAmount);
        }

        let updated_total_deposit = split
            .deposited_amount
            .checked_add(amount)
            .ok_or(Error::InvalidAmount)?;
        if updated_total_deposit > split.total_amount {
            return Err(Error::InvalidAmount);
        }

        let previous_deposit = split.deposits.get(participant.clone()).unwrap_or(0i128);
        let updated_deposit = previous_deposit
            .checked_add(amount)
            .ok_or(Error::InvalidAmount)?;
        if updated_deposit > obligation {
            return Err(Error::InvalidAmount);
        }

        if !participant_known(&split.participants, &participant) {
            if split.participants.len() >= split.max_participants {
                return Err(Error::ParticipantCapExceeded);
            }
            split.participants.push_back(participant.clone());
        }

        split.deposits.set(participant.clone(), updated_deposit);
        split.balances.set(participant.clone(), updated_deposit);

        let token_address = storage::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&participant, &env.current_contract_address(), &amount);

        split.deposited_amount = updated_total_deposit;
        if split.deposited_amount >= split.total_amount {
            split.status = SplitStatus::Ready;
        }

        storage::set_split(&env, &split);
        events::emit_deposit(&env, split_id, &participant, amount);
        emit_deposit_thresholds(
            &env,
            split_id,
            &participant,
            previous_deposit,
            updated_deposit,
            obligation,
        );
        Ok(())
    }

    pub fn get_participant_balance(
        env: Env,
        split_id: u64,
        participant: Address,
    ) -> Result<ParticipantBalance, Error> {
        let split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        let owed = split
            .obligations
            .get(participant.clone())
            .ok_or(Error::ParticipantNotOwed)?;
        let deposited = split.deposits.get(participant).unwrap_or(0i128);
        let remaining = if deposited >= owed {
            0i128
        } else {
            owed - deposited
        };

        Ok(ParticipantBalance {
            deposited,
            owed,
            remaining,
        })
    }

    pub fn add_to_whitelist(env: Env, split_id: u64, address: Address) -> Result<(), Error> {
        let split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        split.creator.require_auth();
        storage::add_to_whitelist(&env, split_id, &address);
        Ok(())
    }

    pub fn remove_from_whitelist(env: Env, split_id: u64, address: Address) -> Result<(), Error> {
        let split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        split.creator.require_auth();
        storage::remove_from_whitelist(&env, split_id, &address);
        Ok(())
    }

    pub fn toggle_whitelist(env: Env, split_id: u64, enabled: bool) -> Result<(), Error> {
        let split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        split.creator.require_auth();
        storage::set_whitelist_enabled(&env, split_id, enabled);
        Ok(())
    }

    pub fn release_funds(env: Env, split_id: u64) -> Result<(), Error> {
        let mut split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        // Only the split creator can finalize settlement.
        split.creator.require_auth();
        if split.status != SplitStatus::Ready {
            return Err(Error::SplitNotReady);
        }

        let total = split.deposited_amount;
        let fee_amount = fees::collect_fee(&env, total)?;
        let creator_amount = total - fee_amount;

        let token_address = storage::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &split.creator,
            &creator_amount,
        );

        split.status = SplitStatus::Released;
        storage::set_split(&env, &split);
        events::emit_released(&env, split_id, creator_amount);
        Ok(())
    }

    /// Alias for cancellation that matches the dispute contract's "reverse_split" concept.
    pub fn reverse_split(env: Env, split_id: u64) -> Result<(), Error> {
        Self::cancel_split(env, split_id)
    }

    pub fn set_fee(env: Env, fee_bps: u32) -> Result<(), Error> {
        fees::set_fee(&env, fee_bps)
    }

    pub fn set_treasury(env: Env, address: Address) -> Result<(), Error> {
        fees::set_treasury(&env, &address)
    }

    /// Returns escrow state including `max_participants` and `participants` (count =
    /// `participants.len()`).
    pub fn get_escrow(env: Env, split_id: u64) -> Result<Split, Error> {
        storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)
    }

    /// View helper for dispute-resolution auth checks.
    pub fn get_creator(env: Env, split_id: u64) -> Result<Address, Error> {
        let split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        Ok(split.creator)
    }

    pub fn get_metadata(env: Env, split_id: u64) -> Result<Map<String, String>, Error> {
        let split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        Ok(split.metadata)
    }

    pub fn update_metadata(
        env: Env,
        split_id: u64,
        metadata: Map<String, String>,
    ) -> Result<(), Error> {
        validate_metadata(&metadata)?;

        let mut split = storage::get_split(&env, split_id).ok_or(Error::SplitNotFound)?;
        split.creator.require_auth();
        if !is_active(&split.status) {
            return Err(Error::SplitNotActive);
        }

        split.metadata = metadata;
        storage::set_split(&env, &split);
        Ok(())
    }
}

fn emit_deposit_thresholds(
    env: &Env,
    split_id: u64,
    participant: &Address,
    previous_deposit: i128,
    updated_deposit: i128,
    obligation: i128,
) {
    let half_obligation = obligation / 2;
    if previous_deposit < half_obligation && updated_deposit >= half_obligation {
        events::emit_partial_threshold_reached(
            env,
            split_id,
            participant,
            updated_deposit,
            obligation,
            50u32,
        );
    }

    if previous_deposit < obligation && updated_deposit >= obligation {
        events::emit_partial_threshold_reached(
            env,
            split_id,
            participant,
            updated_deposit,
            obligation,
            100u32,
        );
    }
}

fn validate_version(version: &String) -> Result<(), Error> {
    let len = version.len() as usize;
    if len == 0 || len > 32 {
        return Err(Error::InvalidVersion);
    }

    let mut buf = [0u8; 32];
    version.copy_into_slice(&mut buf[..len]);

    let mut dot_count = 0;
    let mut part_len = 0;

    for i in 0..len {
        let b = buf[i];
        if b == b'.' {
            if part_len == 0 {
                return Err(Error::InvalidVersion);
            }
            dot_count += 1;
            part_len = 0;
        } else if b >= b'0' && b <= b'9' {
            part_len += 1;
        } else {
            return Err(Error::InvalidVersion);
        }
    }

    if dot_count != 2 || part_len == 0 {
        return Err(Error::InvalidVersion);
    }

    Ok(())
}
