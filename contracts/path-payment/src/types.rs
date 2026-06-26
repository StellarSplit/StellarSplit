//! Types for path-payment contract: Asset and errors.

use soroban_sdk::{contracterror, contracttype, Address, Env, String, Vec};

/// Stellar asset represented as a Soroban token contract address.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Asset(pub Address);

impl Asset {
    pub fn address(&self) -> &Address {
        &self.0
    }
}

/// A directed edge for path finding.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetPair {
    pub from: Address,
    pub to: Address,
}

/// Path intent created during find_payment_path with discovery metadata.
/// Used for time-bound execution to prevent front-running attacks.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PathIntent {
    /// The discovered path from source to destination asset.
    pub path: Vec<Asset>,
    /// Ledger number when the path was discovered.
    pub discovered_ledger: u32,
    /// Optional split ID for tracking purposes.
    pub split_id: String,
}

/// Errors for path payment operations.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    PathNotFound = 1,
    InvalidPath = 2,
    SlippageExceeded = 3,
    SwapFailed = 4,
    Unauthorized = 5,
    InvalidAmount = 6,
    SplitNotFound = 7,
    NotInitialized = 8,
    PairNotRegistered = 9,
    RateNotAvailable = 10,
    PathExpired = 11,
    UnsupportedAsset = 12,
    AmountTooLow = 13,
    AmountTooHigh = 14,
    AlreadyInitialized = 15,
    MissingRouter = 16,
    InvalidState = 17,
}
