#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod events;
mod storage;
mod types;
mod errors;
pub use errors::Error;

#[cfg(test)]
mod test;

pub use events::*;
pub use storage::*;
pub use types::*;

#[contract]
pub struct ReminderContract;

#[contractimpl]
impl ReminderContract {
    pub fn create_reminder_escrow(
        env: Env,
        split_id: String,
        participants: Vec<EscrowParticipant>,
    ) -> Result<(), Error> {
        let escrow = ReminderEscrow {
            split_id: split_id.clone(),
            participants,
        };
        storage::set_escrow(&env, &split_id, &escrow);
        Ok(())
    }

    pub fn request_reminder(env: Env, split_id: String, participant: Address) -> Result<(), Error> {
        participant.require_auth();

        let mut escrow = storage::get_escrow(&env, &split_id).ok_or(Error::EscrowNotFound)?;

        let mut found = false;
        let mut updated_participants = Vec::new(&env);

        for i in 0..escrow.participants.len() {
            let mut p = escrow.participants.get(i).unwrap();
            if p.address == participant && p.amount_paid < p.amount_owed {
                p.reminder_requested = true;
                events::emit_reminder_requested(&env, participant.clone(), &split_id);
                found = true;
            }
            updated_participants.push_back(p);
        }

        if !found {
            return Err(Error::AlreadyPaid);
        }

        escrow.participants = updated_participants;
        storage::set_escrow(&env, &split_id, &escrow);
        Ok(())
    }

    pub fn cancel_reminder(env: Env, split_id: String, participant: Address) -> Result<(), Error> {
        participant.require_auth();

        let mut escrow = storage::get_escrow(&env, &split_id).ok_or(Error::EscrowNotFound)?;

        let mut found = false;
        let mut updated_participants = Vec::new(&env);

        for i in 0..escrow.participants.len() {
            let mut p = escrow.participants.get(i).unwrap();
            if p.address == participant {
                p.reminder_requested = false;
                events::emit_reminder_cancelled(&env, participant.clone(), &split_id);
                found = true;
            }
            updated_participants.push_back(p);
        }

        if !found {
            return Err(Error::ParticipantNotFound);
        }

        escrow.participants = updated_participants;
        storage::set_escrow(&env, &split_id, &escrow);
        Ok(())
    }

    pub fn get_reminder_requested(env: Env, split_id: String, participant: Address) -> Result<bool, Error> {
        let escrow = storage::get_escrow(&env, &split_id).ok_or(Error::EscrowNotFound)?;

        for i in 0..escrow.participants.len() {
            let p = escrow.participants.get(i).unwrap();
            if p.address == participant {
                return Ok(p.reminder_requested);
            }
        }

        Ok(false)
    }
}
