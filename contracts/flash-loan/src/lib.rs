#![no_std]

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, Bytes, Env, IntoVal, String, Val,
};

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use crate::errors::*;
pub use crate::types::*;

#[contract]
pub struct FlashLoanContract;

#[contractimpl]
impl FlashLoanContract {
    /// Initialize the contract
    pub fn initialize(env: Env, admin: Address, token: Address, fee_bp: u32) -> Result<(), Error> {
        if storage::has_admin(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        storage::set_token(&env, &token);
        storage::set_fee_bp(&env, fee_bp);
        events::emit_initialized(&env, &admin);
        Ok(())
    }

    /// Borrow tokens for an atomic transaction
    pub fn flash_loan(
        env: Env,
        borrower: Address,
        amount: i128,
        callback_data: Bytes,
    ) -> Result<(), Error> {
        if !storage::has_admin(&env) {
            return Err(Error::NotInitialized);
        }

        // Reentrancy protection (for this entry point)
        if storage::is_reentrancy_guard_active(&env) {
            return Err(Error::ReentrancyGuardActive);
        }
        storage::set_reentrancy_guard(&env, true);

        let fee_bp = storage::get_fee_bp(&env);
        let fee = (amount * fee_bp as i128) / 10000;

        let token_address = storage::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();

        // Check balance before
        let balance_before = token_client.balance(&contract_address);

        // Generate a unique loan ID
        let loan_id = Self::generate_loan_id(&env, &borrower);
        storage::set_loan(
            &env,
            &loan_id,
            &Loan {
                borrower: borrower.clone(),
                amount,
                fee,
                repaid: false,
            },
        );

        // Transfer funds to borrower
        token_client.transfer(&contract_address, &borrower, &amount);

        // Emit creation event
        events::emit_loan_created(&env, &loan_id, &borrower, amount);

        // Call the borrower's callback
        // Note: The borrower should NOT call FlashLoan methods here to avoid re-entry errors.
        // Instead, they should transfer the (amount + fee) back to this contract using token.transfer.
        env.invoke_contract::<Val>(
            &borrower,
            &symbol_short!("on_loan"),
            (loan_id.clone(), amount, fee, callback_data).into_val(&env),
        );

        // Check balance after
        let balance_after = token_client.balance(&contract_address);

        if balance_after < balance_before {
            return Err(Error::InsufficientRepayment);
        }

        let net_received = balance_after - (balance_before - amount);
        if net_received < amount + fee {
            return Err(Error::InsufficientRepayment);
        }

        // Cleanup
        storage::set_reentrancy_guard(&env, false);

        // Emit repayment events
        events::emit_loan_repaid(&env, &loan_id, amount + fee, fee);
        events::emit_fee_collected(&env, fee);

        Ok(())
    }

    /// Repay a flash loan
    pub fn repay_flash_loan(env: Env, loan_id: String, amount: i128) -> Result<(), Error> {
        let mut loan = storage::get_loan(&env, &loan_id).ok_or(Error::LoanNotFound)?;

        if loan.repaid {
            return Err(Error::LoanAlreadyRepaid);
        }

        let total_expected = loan.amount + loan.fee;
        if amount < total_expected {
            return Err(Error::InsufficientFunds);
        }

        // Transfer funds back
        let token_address = storage::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&loan.borrower, &env.current_contract_address(), &amount);

        // Mark as repaid
        loan.repaid = true;
        storage::set_loan(&env, &loan_id, &loan);

        // Emit events
        events::emit_loan_repaid(&env, &loan_id, amount, loan.fee);
        events::emit_fee_collected(&env, loan.fee);

        Ok(())
    }

    /// Get current flash loan fee in basis points
    pub fn get_flash_loan_fee(env: Env) -> u32 {
        storage::get_fee_bp(&env)
    }

    fn generate_loan_id(env: &Env, _borrower: &Address) -> String {
        // Simple deterministic ID for this session
        // In practice, we might want something more robust
        String::from_str(env, "loan_")
    }
}
