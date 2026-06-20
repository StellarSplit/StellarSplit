//! # Types for Multi-Signature Splits Contract

use soroban_sdk::{contracterror, contracttype, Address, String, Vec};

/// Status of a multi-signature split
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MultisigStatus {
    Pending,
    Active,
    Executed,
    Cancelled,
    Expired,
}

/// Multi-signature split configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultisigSplit {
    /// Unique split identifier
    pub split_id: String,
    /// Required number of signatures
    pub required_signatures: u32,
    /// Current number of signatures collected
    pub current_signatures: u32,
    /// Time lock duration in seconds
    pub time_lock: u64,
    /// Creation timestamp
    pub created_at: u64,
    /// Execution timestamp (0 if not executed)
    pub executed_at: u64,
    /// Current status
    pub status: MultisigStatus,
    /// List of authorized signers
    pub signers: Vec<Address>,
    /// List of signers who have actually signed (collected signatures)
    pub signed_signers: Vec<Address>,
}

/// Governance information for a multi-signature split
#[contracttype]
#[derive(Clone, Debug)]
pub struct GovernanceInfo {
    /// Total number of authorized signers
    pub num_signers: u32,
    /// Required number of signatures
    pub required_signatures: u32,
    /// Current number of signatures collected
    pub current_signatures: u32,
    /// Threshold as a percentage (0-100)
    pub threshold_percentage: u32,
}

/// Execution intent for a multi-signature split
#[contracttype]
#[derive(Clone, Debug)]
pub struct ExecutionIntent {
    /// Unique intent identifier (typically split_id)
    pub intent_id: String,
    /// The split being executed
    pub split_id: String,
    /// Description of the intended action
    pub action: String,
    /// Timestamp when intent was recorded
    pub recorded_at: u64,
    /// Timestamp when intent was executed (0 if not yet executed)
    pub executed_at: u64,
    /// Whether this intent has been executed
    pub is_executed: bool,
}

/// Error types for the contract
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MultisigError {
    SplitAlreadyExists = 1,
    SplitNotFound = 2,
    InvalidThreshold = 3,
    AlreadySigned = 4,
    NotAuthorized = 5,
    TimeLockNotExpired = 6,
    InsufficientSignatures = 7,
    SplitNotActive = 8,
    SplitAlreadyExecuted = 9,
    SplitCancelled = 10,
    SignerAlreadyExists = 11,
    SignerNotFound = 12,
    CannotRemoveLastSigner = 13,
    ThresholdTooHigh = 14,
    ThresholdTooLow = 15,
    InvalidSigner = 16,
    InvalidTimeLock = 17,
}
