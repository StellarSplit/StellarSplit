//! Error mapping utilities for path-payment contract.

use crate::types::Error;
use soroban_sdk::String;

/// Convert an error to a human-readable string for debugging/logging.
pub fn error_to_string(env: &soroban_sdk::Env, error: Error) -> String {
    match error {
        Error::PathNotFound => String::from_str(env, "Path not found between assets"),
        Error::InvalidPath => String::from_str(env, "Invalid payment path provided"),
        Error::SlippageExceeded => String::from_str(env, "Slippage tolerance exceeded"),
        Error::SwapFailed => String::from_str(env, "Swap operation failed"),
        Error::Unauthorized => String::from_str(env, "Unauthorized operation"),
        Error::InvalidAmount => String::from_str(env, "Invalid amount specified"),
        Error::SplitNotFound => String::from_str(env, "Split not found"),
        Error::NotInitialized => String::from_str(env, "Contract not initialized"),
        Error::PairNotRegistered => String::from_str(env, "Asset pair not registered"),
        Error::RateNotAvailable => String::from_str(env, "Conversion rate not available"),
        Error::PathExpired => String::from_str(env, "Payment path expired"),
        Error::UnsupportedAsset => String::from_str(env, "Unsupported asset type"),
        Error::AmountTooLow => String::from_str(env, "Amount too low"),
        Error::AmountTooHigh => String::from_str(env, "Amount too high"),
        Error::AlreadyInitialized => String::from_str(env, "Contract already initialized"),
        Error::MissingRouter => String::from_str(env, "Swap router not set"),
        Error::InvalidState => String::from_str(env, "Invalid contract state"),
    }
}
