//! # Metadata Standardization Module
//!
//! This module provides structured helpers and standardized metadata
//! for achievement badges, documenting token semantics and ensuring
//! a consistent contract API.

use crate::types::*;
use soroban_sdk::{contracttype, Address, Env, String, Vec};

// ============================================================================
// Token Semantics & Documentation
// ============================================================================

/// Token Semantics for Achievement Badges
///
/// Achievement badges are non-fungible tokens (NFTs) that represent verified
/// user accomplishments in the StellarSplit application. Each badge:
///
/// - Is uniquely identified by its token_id
/// - Is issued once per user per badge type (non-repeatable)
/// - Cannot be transferred (achievement badges are soulbound)
/// - Represents verifiable on-chain achievements
/// - Carries standardized metadata for display and discovery
///
/// Token ID Assignment:
/// - Globally incremented counter ensuring unique IDs
/// - IDs never reused, even after token burn
///
/// Ownership:
/// - Each badge is owned by exactly one address
/// - Ownership is permanent and non-transferable
/// - Verified through UserBadge records in persistent storage

// ============================================================================
// Standardized Metadata Definitions
// ============================================================================

/// Standard metadata for FirstSplitCreator badge
pub fn metadata_first_split_creator(env: &Env) -> BadgeMetadata {
    BadgeMetadata {
        name: String::from_str(env, "First Split Creator"),
        description: String::from_str(env, "Awarded for creating your first split"),
        image_url: String::from_str(env, "https://stellarsplit.com/badges/first-creator.png"),
        badge_type: BadgeType::FirstSplitCreator,
    }
}

/// Standard metadata for HundredSplitsParticipated badge
pub fn metadata_hundred_splits_participated(env: &Env) -> BadgeMetadata {
    BadgeMetadata {
        name: String::from_str(env, "Century Club"),
        description: String::from_str(env, "Participated in 100 splits"),
        image_url: String::from_str(env, "https://stellarsplit.com/badges/century-club.png"),
        badge_type: BadgeType::HundredSplitsParticipated,
    }
}

/// Standard metadata for BigSpender badge
pub fn metadata_big_spender(env: &Env) -> BadgeMetadata {
    BadgeMetadata {
        name: String::from_str(env, "Big Spender"),
        description: String::from_str(env, "Spent a significant amount in splits"),
        image_url: String::from_str(env, "https://stellarsplit.com/badges/big-spender.png"),
        badge_type: BadgeType::BigSpender,
    }
}

/// Standard metadata for FrequentSettler badge
pub fn metadata_frequent_settler(env: &Env) -> BadgeMetadata {
    BadgeMetadata {
        name: String::from_str(env, "Frequent Settler"),
        description: String::from_str(env, "Completed 50 split settlements"),
        image_url: String::from_str(env, "https://stellarsplit.com/badges/frequent-settler.png"),
        badge_type: BadgeType::FrequentSettler,
    }
}

/// Standard metadata for GroupLeader badge
pub fn metadata_group_leader(env: &Env) -> BadgeMetadata {
    BadgeMetadata {
        name: String::from_str(env, "Group Leader"),
        description: String::from_str(env, "Managing group splits"),
        image_url: String::from_str(env, "https://stellarsplit.com/badges/group-leader.png"),
        badge_type: BadgeType::GroupLeader,
    }
}

// ============================================================================
// Metadata Helper Provider
// ============================================================================

/// Get standardized metadata for a badge type
///
/// This ensures all badge metadata is consistent, properly formatted,
/// and follows a predictable structure for callers.
pub fn get_metadata_for_badge(env: &Env, badge_type: &BadgeType) -> BadgeMetadata {
    match badge_type {
        BadgeType::FirstSplitCreator => metadata_first_split_creator(env),
        BadgeType::HundredSplitsParticipated => metadata_hundred_splits_participated(env),
        BadgeType::BigSpender => metadata_big_spender(env),
        BadgeType::FrequentSettler => metadata_frequent_settler(env),
        BadgeType::GroupLeader => metadata_group_leader(env),
    }
}

// ============================================================================
// Ownership Information Helpers
// ============================================================================

/// Complete ownership information for a specific badge
#[contracttype]
#[derive(Clone, Debug)]
pub struct BadgeOwnershipInfo {
    /// The address that owns this badge
    pub owner: Address,
    /// The token ID of this badge
    pub token_id: u64,
    /// The type of badge
    pub badge_type: BadgeType,
    /// When this badge was minted (unix timestamp)
    pub minted_at: u64,
    /// Standardized metadata for this badge
    pub metadata: BadgeMetadata,
}

impl BadgeOwnershipInfo {
    /// Construct ownership information from a user badge and owner
    pub fn from_user_badge(env: &Env, owner: Address, user_badge: &UserBadge) -> Self {
        BadgeOwnershipInfo {
            owner,
            token_id: user_badge.token_id,
            badge_type: user_badge.badge_type.clone(),
            minted_at: user_badge.minted_at,
            metadata: get_metadata_for_badge(env, &user_badge.badge_type),
        }
    }
}

/// Collection summary for a user's badges
#[contracttype]
#[derive(Clone, Debug)]
pub struct UserBadgeCollection {
    /// The user's address
    pub owner: Address,
    /// Total number of badges owned
    pub badge_count: u32,
    /// List of badge ownership info
    pub badges: Vec<BadgeOwnershipInfo>,
}

impl UserBadgeCollection {
    /// Check if user has a specific badge type
    pub fn has_badge(&self, badge_type: &BadgeType) -> bool {
        for ownership_info in &self.badges {
            if &ownership_info.badge_type == badge_type {
                return true;
            }
        }
        false
    }
}
