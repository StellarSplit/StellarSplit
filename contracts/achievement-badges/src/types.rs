//! # Custom Types for Achievement Badges Contract
//!
//! This module defines the data structures for the NFT achievement badges system.

use soroban_sdk::{contracterror, contracttype, String};

/// Types of achievement badges
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BadgeType {
    FirstSplitCreator,
    HundredSplitsParticipated,
    BigSpender,
    FrequentSettler,
    GroupLeader,
}

/// Badge metadata structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct BadgeMetadata {
    pub name: String,
    pub description: String,
    pub image_url: String,
    pub badge_type: BadgeType,
}

/// User's badge ownership record
#[contracttype]
#[derive(Clone, Debug)]
pub struct UserBadge {
    pub badge_type: BadgeType,
    pub token_id: u64,
    pub minted_at: u64,
}

/// Error types for the contract
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum BadgeError {
    AlreadyMinted = 1,
    NotEligible = 2,
    InvalidBadgeType = 3,
    Unauthorized = 4,
    TransferNotAllowed = 10,
}
