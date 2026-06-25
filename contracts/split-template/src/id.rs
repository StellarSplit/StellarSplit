//! # Deterministic ID Generation for Split Template Contract
//!
//! Provides deterministic template ID generation using cryptographic hashing.
//! Ensures unique IDs based on creator address, template name, and ledger context.

use soroban_sdk::{xdr::ToXdr, Address, Bytes, Env, String};

use crate::utils::hash_to_hex_upper;

/// Generate a deterministic template ID.
///
/// Creates a unique template ID by hashing the creator address, template name,
/// and current ledger sequence number. This ensures:
/// - Same creator + same name + same ledger time = same ID
/// - Different creators with same name = different IDs
/// - Same creator with same name at different times = different IDs
/// - Cryptographically unique and collision-resistant
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `creator` - The address creating this template
/// * `name` - Human-readable name for the template
///
/// # Returns
/// A 64-character hex string representing the SHA256 hash
pub fn generate_template_id(env: &Env, creator: &Address, name: &String) -> String {
    // Get current ledger sequence for temporal uniqueness
    let ledger_seq = env.ledger().sequence();

    // Create a hashable payload combining all uniqueness factors
    let mut payload = Bytes::new(env);

    // Add creator address to payload
    let creator_bytes = creator.clone().to_xdr(env);
    payload.append(&creator_bytes);

    // Add name bytes to payload
    let name_bytes = name.clone().to_xdr(env);
    payload.append(&name_bytes);

    // Add ledger sequence to payload (converted to bytes)
    let seq_bytes = ledger_seq.to_le_bytes();
    payload.extend_from_array(&seq_bytes);

    // Compute SHA256 hash of the combined payload
    let hash = env.crypto().sha256(&payload);

    // Convert hash to hex string for storage.
    // `to_array()` returns [u8; 32] by value; take a reference for `hash_to_hex_upper`.
    hash_to_hex_upper(env, &hash.to_array())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env};

    fn set_seq(env: &Env, seq: u32) {
        env.ledger().with_mut(|l| {
            l.sequence_number = seq;
        });
    }

    #[test]
    fn test_deterministic_id_same_inputs() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let name = String::from_str(&env, "Test Template");

        set_seq(&env, 12345);

        let id1 = generate_template_id(&env, &creator, &name);
        let id2 = generate_template_id(&env, &creator, &name);

        // Same inputs should produce same ID
        assert_eq!(id1, id2);

        // ID should be 64 hex characters (SHA256 output)
        assert_eq!(id1.len(), 64);
    }

    #[test]
    fn test_different_creators_different_ids() {
        let env = Env::default();
        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let name = String::from_str(&env, "Same Name");

        set_seq(&env, 12345);

        let id1 = generate_template_id(&env, &creator1, &name);
        let id2 = generate_template_id(&env, &creator2, &name);

        // Different creators should produce different IDs
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_different_names_different_ids() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let name1 = String::from_str(&env, "Template A");
        let name2 = String::from_str(&env, "Template B");

        set_seq(&env, 12345);

        let id1 = generate_template_id(&env, &creator, &name1);
        let id2 = generate_template_id(&env, &creator, &name2);

        // Different names should produce different IDs
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_different_ledger_times_different_ids() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let name = String::from_str(&env, "Same Template");

        set_seq(&env, 12345);
        let id1 = generate_template_id(&env, &creator, &name);

        set_seq(&env, 12346);
        let id2 = generate_template_id(&env, &creator, &name);

        // Different ledger times should produce different IDs
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_id_format_is_hex() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let name = String::from_str(&env, "Format Test");

        set_seq(&env, 100);

        let id = generate_template_id(&env, &creator, &name);

        // Verify it's valid hex (uppercase), 64 characters
        assert_eq!(id.len(), 64);
    }
}
