#![cfg(test)]

use crate::{FlashLoanContract, FlashLoanContractClient};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient as TokenAdminClient};
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

mod receiver {
    use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Bytes, Env, String};

    #[contract]
    pub struct ReceiverContract;

    #[contractimpl]
    impl ReceiverContract {
        pub fn on_loan(env: Env, _loan_id: String, amount: i128, fee: i128, _data: Bytes) {
            let token_address = env
                .storage()
                .instance()
                .get::<_, Address>(&symbol_short!("tok_addr"))
                .unwrap();
            let token_client = token::Client::new(&env, &token_address);
            let flash_loan_address = env
                .storage()
                .instance()
                .get::<_, Address>(&symbol_short!("fl_addr"))
                .unwrap();

            // Transfer principal + fee back to the flash loan contract
            token_client.transfer(
                &env.current_contract_address(),
                &flash_loan_address,
                &(amount + fee),
            );
        }

        pub fn set_flash_loan(env: Env, addr: Address, token: Address) {
            env.storage()
                .instance()
                .set(&symbol_short!("fl_addr"), &addr);
            env.storage()
                .instance()
                .set(&symbol_short!("tok_addr"), &token);
        }
    }
}

mod failing_receiver {
    use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Bytes, Env, String};

    #[contract]
    pub struct FailingReceiverContract;

    #[contractimpl]
    impl FailingReceiverContract {
        pub fn on_loan(env: Env, _loan_id: String, amount: i128, fee: i128, _data: Bytes) {
            let token_address = env
                .storage()
                .instance()
                .get::<_, Address>(&symbol_short!("tok_addr"))
                .unwrap();
            let token_client = token::Client::new(&env, &token_address);
            let flash_loan_address = env
                .storage()
                .instance()
                .get::<_, Address>(&symbol_short!("fl_addr"))
                .unwrap();
            // Repay only the principal
            token_client.transfer(
                &env.current_contract_address(),
                &flash_loan_address,
                &amount,
            );
        }
        pub fn set_flash_loan(env: Env, addr: Address, token: Address) {
            env.storage()
                .instance()
                .set(&symbol_short!("fl_addr"), &addr);
            env.storage()
                .instance()
                .set(&symbol_short!("tok_addr"), &token);
        }
    }
}

mod fee_only_receiver {
    use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Bytes, Env, String};

    #[contract]
    pub struct FeeOnlyReceiverContract;

    #[contractimpl]
    impl FeeOnlyReceiverContract {
        pub fn on_loan(env: Env, _loan_id: String, _amount: i128, fee: i128, _data: Bytes) {
            let token_address = env
                .storage()
                .instance()
                .get::<_, Address>(&symbol_short!("tok_addr"))
                .unwrap();
            let token_client = token::Client::new(&env, &token_address);
            let flash_loan_address = env
                .storage()
                .instance()
                .get::<_, Address>(&symbol_short!("fl_addr"))
                .unwrap();
            token_client.transfer(&env.current_contract_address(), &flash_loan_address, &fee);
        }
        pub fn set_flash_loan(env: Env, addr: Address, token: Address) {
            env.storage()
                .instance()
                .set(&symbol_short!("fl_addr"), &addr);
            env.storage()
                .instance()
                .set(&symbol_short!("tok_addr"), &token);
        }
    }
}

use failing_receiver::{FailingReceiverContract, FailingReceiverContractClient};
use fee_only_receiver::{FeeOnlyReceiverContract, FeeOnlyReceiverContractClient};
use receiver::{ReceiverContract, ReceiverContractClient};

#[test]
fn test_flash_loan_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // Deploy token
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();
    let token_client = TokenClient::new(&env, &token_address);
    let token_admin_client = TokenAdminClient::new(&env, &token_address);

    // Deploy Flash Loan Contract
    let flash_loan_id = env.register_contract(None, FlashLoanContract);
    let flash_loan_client = FlashLoanContractClient::new(&env, &flash_loan_id);
    flash_loan_client.initialize(&admin, &token_address, &50u32); // 0.5% fee

    // Deploy Receiver
    let receiver_id = env.register_contract(None, ReceiverContract);
    let receiver_client = ReceiverContractClient::new(&env, &receiver_id);
    receiver_client.set_flash_loan(&flash_loan_id, &token_address);

    // Mint tokens to Flash Loan contract
    token_admin_client.mint(&flash_loan_id, &1000000);
    // Mint tokens to Receiver for fees
    token_admin_client.mint(&receiver_id, &10000);

    // Perform flash loan
    let loan_amount = 100000;
    flash_loan_client.flash_loan(&receiver_id, &loan_amount, &Bytes::new(&env));

    // Verify balances
    assert_eq!(token_client.balance(&flash_loan_id), 1000500);
}

#[test]
fn test_flash_loan_insufficient_repayment() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // Deploy token
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();
    let token_admin_client = TokenAdminClient::new(&env, &token_address);

    // Deploy Flash Loan Contract
    let flash_loan_id = env.register_contract(None, FlashLoanContract);
    let flash_loan_client = FlashLoanContractClient::new(&env, &flash_loan_id);
    flash_loan_client.initialize(&admin, &token_address, &50u32);

    // Deploy Failing Receiver
    let receiver_id = env.register_contract(None, FailingReceiverContract);
    let receiver_client = FailingReceiverContractClient::new(&env, &receiver_id);
    receiver_client.set_flash_loan(&flash_loan_id, &token_address);

    token_admin_client.mint(&flash_loan_id, &1000000);

    // This should fail because fee is not paid
    let result = flash_loan_client.try_flash_loan(&receiver_id, &100000, &Bytes::new(&env));

    assert!(result.is_err());
}

#[test]
fn test_fee_only_repayment_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();
    let token_admin_client = TokenAdminClient::new(&env, &token_address);

    let flash_loan_id = env.register_contract(None, FlashLoanContract);
    let flash_loan_client = FlashLoanContractClient::new(&env, &flash_loan_id);
    flash_loan_client.initialize(&admin, &token_address, &50u32);

    let receiver_id = env.register_contract(None, FeeOnlyReceiverContract);
    let receiver_client = FeeOnlyReceiverContractClient::new(&env, &receiver_id);
    receiver_client.set_flash_loan(&flash_loan_id, &token_address);

    token_admin_client.mint(&flash_loan_id, &1000000);
    token_admin_client.mint(&receiver_id, &5000);

    let result = flash_loan_client.try_flash_loan(&receiver_id, &100000, &Bytes::new(&env));

    assert!(result.is_err());
}

// ============================================================
// Property / invariant tests (proptest-style)
// ============================================================

mod proptests {
    use super::*;
    use proptest::prelude::*;

    mod param_receiver {
        use soroban_sdk::{
            contract, contractimpl, symbol_short, token, Address, Bytes, Env, String,
        };

        #[contract]
        pub struct ParamReceiverContract;

        #[contractimpl]
        impl ParamReceiverContract {
            pub fn on_loan(env: Env, _loan_id: String, amount: i128, fee: i128, data: Bytes) {
                let token_address = env
                    .storage()
                    .instance()
                    .get::<_, Address>(&symbol_short!("tok_addr"))
                    .unwrap();
                let flash_loan_address = env
                    .storage()
                    .instance()
                    .get::<_, Address>(&symbol_short!("fl_addr"))
                    .unwrap();

                // callback_data[0] = extra fee units (0..255). We repay:
                // amount + fee + extra.
                let extra_u8: u8 = data.get(0).unwrap_or(0u8);
                let extra: i128 = extra_u8 as i128;

                let token_client = token::Client::new(&env, &token_address);
                token_client.transfer(
                    &env.current_contract_address(),
                    &flash_loan_address,
                    &(amount + fee + extra),
                );
            }

            pub fn set_flash_loan(env: Env, addr: Address, token: Address) {
                env.storage()
                    .instance()
                    .set(&symbol_short!("fl_addr"), &addr);
                env.storage()
                    .instance()
                    .set(&symbol_short!("tok_addr"), &token);
            }
        }
    }

    use param_receiver::{ParamReceiverContract, ParamReceiverContractClient};

    proptest! {
        // This property focuses on money-critical invariants for `flash_loan`:
        // - borrower callback repayment makes the contract balance jump by fee + extra
        // - receiver ends at 0 (it was minted exactly fee + extra and then repaid principal+fee+extra)
        #![proptest_config(ProptestConfig { cases: 32, .. ProptestConfig::default() })]
        #[test]
        fn prop_flash_loan_balance_delta_and_receiver_settle(
            fee_bp in 0u32..500u32,
            amount in 1_000i128..50_000i128,
            extra in 0u8..=50u8
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);

            // Deploy token
            let token_admin = Address::generate(&env);
            let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
            let token_address = token_id.address();
            let token_client = TokenClient::new(&env, &token_address);
            let token_admin_client = TokenAdminClient::new(&env, &token_address);

            // Deploy Flash Loan contract
            let flash_loan_id = env.register_contract(None, FlashLoanContract);
            let flash_loan_client = FlashLoanContractClient::new(&env, &flash_loan_id);
            flash_loan_client.initialize(&admin, &token_address, &fee_bp);

            // Deploy parameterized receiver
            let receiver_id = env.register_contract(None, ParamReceiverContract);
            let receiver_client = ParamReceiverContractClient::new(&env, &receiver_id);
            receiver_client.set_flash_loan(&flash_loan_id, &token_address);

            // Contract initial liquidity must cover amount.
            let initial_contract_balance = amount + 1_000_000;
            token_admin_client.mint(&flash_loan_id, &initial_contract_balance);

            // Repayment required is amount + fee + extra.
            let fee: i128 = (amount * fee_bp as i128) / 10000i128;
            let extra_i128: i128 = extra as i128;
            let receiver_seed = fee + extra_i128;

            // Seed receiver with fee + extra. It will receive `amount` from flash_loan,
            // then repay `amount + fee + extra` during callback.
            token_admin_client.mint(&receiver_id, &receiver_seed);

            let before_contract_balance = token_client.balance(&flash_loan_id);
            let before_receiver_balance = token_client.balance(&receiver_id);
            prop_assert_eq!(before_receiver_balance, receiver_seed);

            let callback_data = Bytes::from_array(&env, &[extra]);
            let _ = flash_loan_client.flash_loan(&receiver_id, &amount, &callback_data);

            let after_contract_balance = token_client.balance(&flash_loan_id);
            let after_receiver_balance = token_client.balance(&receiver_id);

            // Net delta: contract sends `amount` to receiver, then receives `amount + fee + extra`.
            prop_assert_eq!(
                after_contract_balance - before_contract_balance,
                fee + extra_i128
            );
            prop_assert_eq!(after_receiver_balance, 0);
        }
    }
}
