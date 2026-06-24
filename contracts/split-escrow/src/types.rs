use soroban_sdk::{contracttype, Address, Map, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SplitStatus {
    Pending,
    Ready,
    /// Funds refunded to participants (e.g. dispute upheld).
    Cancelled,
    Released,
}

/// Escrow split state. `participants.len()` is the current distinct participant count.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Split {
    pub split_id: u64,
    pub creator: Address,
    pub description: String,
    pub metadata: Map<String, String>,
    pub total_amount: i128,
    pub deposited_amount: i128,
    pub status: SplitStatus,
    /// Maximum distinct participants allowed (default 50 at creation if not specified).
    pub max_participants: u32,
    /// Distinct addresses that have deposited; length is the current participant count.
    pub participants: Vec<Address>,
    /// Per-participant deposited balances so we can refund on dispute outcomes.
    pub balances: Map<Address, i128>,
    /// Per-participant cumulative deposits used for reconciliation views.
    pub deposits: Map<Address, i128>,
    /// Per-participant expected contribution.
    pub obligations: Map<Address, i128>,
    /// Short on-chain context (max 128 bytes at creation/update); empty if unset.
    pub note: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParticipantBalance {
    pub deposited: i128,
    pub owed: i128,
    pub remaining: i128,
}
