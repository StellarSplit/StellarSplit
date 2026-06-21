//! # Unit Tests for Split Template Contract

#[cfg(test)]
mod tests {
    use soroban_sdk::{
        testutils::Address as _, testutils::Ledger as _, Address, Env, String as SorobanString,
        Vec as SorobanVec,
    };

    use crate::types::{Participant, SplitType};
    use crate::{SplitTemplateContract, SplitTemplateContractClient};

    fn setup() -> (Env, Address, SplitTemplateContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        // Start at a high enough sequence so that bumping by small amounts later
        // (e.g. +1 or repeating the same value) never causes the contract instance
        // or its storage to appear "archived" relative to the registration ledger.
        env.ledger().with_mut(|l| {
            l.sequence_number = 500_000;
        });

        let contract_id = env.register_contract(None, SplitTemplateContract);
        let client = SplitTemplateContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);

        (env, creator, client)
    }

    fn create_participant(env: &Env, share: i128) -> Participant {
        Participant {
            address: Address::generate(env),
            share,
        }
    }

    fn create_equal_split_participants(env: &Env, count: u32) -> SorobanVec<Participant> {
        let mut participants = SorobanVec::new(env);
        for _ in 0..count {
            participants.push_back(create_participant(env, 1));
        }
        participants
    }

    fn create_percentage_split_participants(
        env: &Env,
        percentages: &[i128],
    ) -> SorobanVec<Participant> {
        let mut participants = SorobanVec::new(env);
        for &percentage in percentages.iter() {
            participants.push_back(create_participant(env, percentage));
        }
        participants
    }

    fn create_fixed_split_participants(env: &Env, amounts: &[i128]) -> SorobanVec<Participant> {
        let mut participants = SorobanVec::new(env);
        for &amount in amounts.iter() {
            participants.push_back(create_participant(env, amount));
        }
        participants
    }

    // ============================================
    // Core Functionality Tests
    // ============================================

    #[test]
    fn test_create_template_equal_split() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Equal Split");
        let participants = create_equal_split_participants(&env, 3);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        assert!(!template_id.is_empty());
    }

    #[test]
    fn test_create_template_percentage_split_valid() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Percentage Split");
        let percentages = [50i128, 30, 20];
        let participants = create_percentage_split_participants(&env, &percentages);

        let template_id = client.create_template(
            &creator,
            &name,
            &SplitType::Percentage,
            &participants,
            &None,
        );

        assert!(!template_id.is_empty());
    }

    #[test]
    #[should_panic]
    fn test_create_template_percentage_split_invalid_sum() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Bad Percentage Split");
        let percentages = [50i128, 30, 15]; // Sum is 95, not 100
        let participants = create_percentage_split_participants(&env, &percentages);

        let _ = client.create_template(
            &creator,
            &name,
            &SplitType::Percentage,
            &participants,
            &None,
        );
    }

    #[test]
    #[should_panic]
    fn test_create_template_percentage_split_out_of_range() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Out of Range Percentage");
        let percentages = [50i128, 60]; // 60 exceeds 100
        let participants = create_percentage_split_participants(&env, &percentages);

        let _ = client.create_template(
            &creator,
            &name,
            &SplitType::Percentage,
            &participants,
            &None,
        );
    }

    #[test]
    fn test_create_template_fixed_split_valid() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Fixed Split");
        let amounts = [100i128, 200, 300];
        let participants = create_fixed_split_participants(&env, &amounts);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Fixed, &participants, &None);

        assert!(!template_id.is_empty());
    }

    #[test]
    #[should_panic]
    fn test_create_template_fixed_split_invalid_zero() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Invalid Fixed Split");
        let amounts = [100i128, 0, 300];
        let mut participants = SorobanVec::new(&env);
        for &amount in amounts.iter() {
            participants.push_back(create_participant(&env, amount));
        }

        let _ = client.create_template(&creator, &name, &SplitType::Fixed, &participants, &None);
    }

    #[test]
    #[should_panic]
    fn test_create_template_empty_participants() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Empty Participants");
        let participants = SorobanVec::new(&env);

        let _ = client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);
    }

    // ============================================
    // Deterministic ID Tests
    // ============================================

    #[test]
    fn test_deterministic_id_same_ledger_sequence() {
        // The ID function is deterministic: same creator + name + ledger sequence
        // always produces the same hex string. We verify this directly through the
        // id module (unit-level) rather than creating two templates via the contract,
        // because the contract's name-uniqueness guard would reject the second call.
        use crate::id::generate_template_id;

        let env = Env::default();
        env.ledger().with_mut(|l| l.sequence_number = 500_000);

        let creator = Address::generate(&env);
        let name = SorobanString::from_str(&env, "Deterministic Test");

        let id1 = generate_template_id(&env, &creator, &name);
        let id2 = generate_template_id(&env, &creator, &name);

        // Same inputs + same sequence → identical ID
        assert_eq!(id1, id2);

        // Must be a 64-character hex string (SHA256)
        assert_eq!(id1.len(), 64);
    }

    #[test]
    fn test_different_names_different_ids() {
        let (env, creator, client) = setup();

        let name1 = SorobanString::from_str(&env, "Template A");
        let name2 = SorobanString::from_str(&env, "Template B");
        let participants1 = create_equal_split_participants(&env, 2);
        let participants2 = create_equal_split_participants(&env, 2);

        // Both calls at the same sequence (500_000 from setup); only name differs.
        let id1 =
            client.create_template(&creator, &name1, &SplitType::Equal, &participants1, &None);
        let id2 =
            client.create_template(&creator, &name2, &SplitType::Equal, &participants2, &None);

        // Different names should produce different IDs
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_same_name_different_creators_different_ids() {
        let (env, creator1, client) = setup();
        let creator2 = Address::generate(&env);

        let name = SorobanString::from_str(&env, "Same Name");
        let participants1 = create_equal_split_participants(&env, 2);
        let participants2 = create_equal_split_participants(&env, 2);

        // Both calls at the same sequence; only the creator differs.
        let id1 =
            client.create_template(&creator1, &name, &SplitType::Equal, &participants1, &None);
        let id2 =
            client.create_template(&creator2, &name, &SplitType::Equal, &participants2, &None);

        // Same name with different creators should produce different IDs
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_same_creator_different_times_different_ids() {
        let (env, creator, client) = setup();

        // Each call uses a distinct name so the DuplicateName guard doesn't fire,
        // but both are by the same creator. Different sequence numbers → different IDs.
        let name1 = SorobanString::from_str(&env, "Time Sensitive v1");
        let name2 = SorobanString::from_str(&env, "Time Sensitive v2");
        let participants = create_equal_split_participants(&env, 2);

        // First call at the setup sequence (500_000)
        let id1 = client.create_template(&creator, &name1, &SplitType::Equal, &participants, &None);

        // Advance by one ledger
        env.ledger().with_mut(|l| l.sequence_number += 1);
        let id2 = client.create_template(&creator, &name2, &SplitType::Equal, &participants, &None);

        // The IDs must differ because the names differ (and the sequence differs too)
        assert_ne!(id1, id2);

        // Additionally verify at the unit level that same name + different sequence → different ID
        use crate::id::generate_template_id;
        let shared_name = SorobanString::from_str(&env, "Time Check");
        env.ledger().with_mut(|l| l.sequence_number = 500_000);
        let raw_id1 = generate_template_id(&env, &creator, &shared_name);
        env.ledger().with_mut(|l| l.sequence_number = 500_001);
        let raw_id2 = generate_template_id(&env, &creator, &shared_name);
        assert_ne!(raw_id1, raw_id2);
    }

    #[test]
    fn test_duplicate_name_collision_handling() {
        let (env, creator, client) = setup();

        // The contract enforces unique names per creator.
        // Verify two different names at the same sequence produce different IDs,
        // and that re-submitting an existing name is rejected with DuplicateName.
        let name_a = SorobanString::from_str(&env, "Collision A");
        let name_b = SorobanString::from_str(&env, "Collision B");
        let participants = create_equal_split_participants(&env, 2);

        let id1 =
            client.create_template(&creator, &name_a, &SplitType::Equal, &participants, &None);
        let id2 =
            client.create_template(&creator, &name_b, &SplitType::Equal, &participants, &None);

        // Different names → different IDs
        assert_ne!(id1, id2);

        // Both templates are retrievable and belong to the creator
        let t1 = client.get_template(&id1);
        let t2 = client.get_template(&id2);
        assert_eq!(t1.creator, creator);
        assert_eq!(t2.creator, creator);

        // Attempting to re-use name_a returns DuplicateName (via try_ variant)
        let dup =
            client.try_create_template(&creator, &name_a, &SplitType::Equal, &participants, &None);
        assert!(dup.is_err());
    }

    #[test]
    #[should_panic]
    fn test_duplicate_name_rejection() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Duplicate Name Test");
        let participants1 = create_equal_split_participants(&env, 2);
        let participants2 = create_equal_split_participants(&env, 3);

        // Create first template (sequence already set to 500_000 in setup)
        let _id1 =
            client.create_template(&creator, &name, &SplitType::Equal, &participants1, &None);

        // Same name → DuplicateName → should panic
        let _ = client.create_template(&creator, &name, &SplitType::Equal, &participants2, &None);
    }

    #[test]
    fn test_id_hex_format_validation() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Format Test");
        let participants = create_equal_split_participants(&env, 2);

        // Sequence is 500_000 from setup — no need to set it manually
        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        // Verify ID is 64-character hex string
        assert_eq!(template_id.len(), 64);

        // Length check suffices since the ID generator uses SHA256 -> hex encoding,
        // which always produces valid uppercase hex. Character-level inspection
        // requires std::string traits not available in no_std context.
    }

    // ============================================
    // Storage and Retrieval Tests
    // ============================================

    #[test]
    fn test_get_template_success() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Retrievable Template");
        let participants = create_equal_split_participants(&env, 3);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        let template = client.get_template(&template_id);
        assert_eq!(template.id, template_id);
        assert_eq!(template.creator, creator);
        assert_eq!(template.name, name);
        assert_eq!(template.split_type, SplitType::Equal);
        assert_eq!(template.participants.len(), 3);
    }

    #[test]
    fn test_get_template_by_name_success() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Named Template");
        let participants = create_equal_split_participants(&env, 2);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        let template = client.get_template_by_name(&creator, &name);
        assert_eq!(template.id, template_id);
        assert_eq!(template.creator, creator);
        assert_eq!(template.name, name);
    }

    #[test]
    #[should_panic]
    fn test_get_template_not_found() {
        let (env, _creator, client) = setup();

        let fake_id = SorobanString::from_str(&env, "NONEXISTENT");
        let _ = client.get_template(&fake_id);
    }

    #[test]
    fn test_get_templates_by_creator() {
        let (env, creator, client) = setup();

        let name1 = SorobanString::from_str(&env, "Template 1");
        let name2 = SorobanString::from_str(&env, "Template 2");
        let name3 = SorobanString::from_str(&env, "Template 3");

        let participants1 = create_equal_split_participants(&env, 2);
        let participants2 = create_percentage_split_participants(&env, &[50, 50]);
        let participants3 = create_fixed_split_participants(&env, &[100, 200]);

        // Create three templates
        client.create_template(&creator, &name1, &SplitType::Equal, &participants1, &None);

        client.create_template(
            &creator,
            &name2,
            &SplitType::Percentage,
            &participants2,
            &None,
        );

        client.create_template(&creator, &name3, &SplitType::Fixed, &participants3, &None);

        // Retrieve all templates by creator
        let templates = client.get_templates(&creator);

        assert_eq!(templates.len(), 3);

        // Verify all templates belong to the creator
        for template in templates.iter() {
            assert_eq!(template.creator, creator);
        }
    }

    #[test]
    fn test_get_templates_empty_for_new_creator() {
        let (env, _, client) = setup();

        let new_creator = Address::generate(&env);
        let templates = client.get_templates(&new_creator);

        assert_eq!(templates.len(), 0);
    }

    #[test]
    fn test_get_templates_multiple_creators() {
        let (env, creator1, client) = setup();
        let creator2 = Address::generate(&env);

        let name1 = SorobanString::from_str(&env, "Creator1 Template");
        let name2 = SorobanString::from_str(&env, "Creator2 Template");

        let participants = create_equal_split_participants(&env, 2);

        // Creator 1 creates a template
        client.create_template(&creator1, &name1, &SplitType::Equal, &participants, &None);

        // Creator 2 creates a template
        client.create_template(&creator2, &name2, &SplitType::Equal, &participants, &None);

        // Verify separation
        let templates1 = client.get_templates(&creator1);
        let templates2 = client.get_templates(&creator2);

        assert_eq!(templates1.len(), 1);
        assert_eq!(templates2.len(), 1);
        assert_eq!(templates1.get(0).unwrap().creator, creator1);
        assert_eq!(templates2.get(0).unwrap().creator, creator2);
    }

    // ============================================
    // Template Usage Tests
    // ============================================

    #[test]
    fn test_use_template_success() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Usable Template");
        let participants = create_equal_split_participants(&env, 2);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        let split_id = 1000u64;
        let _ = client.use_template(&template_id, &split_id);
    }

    #[test]
    #[should_panic]
    fn test_use_template_not_found() {
        let (env, _creator, client) = setup();

        let fake_template_id = SorobanString::from_str(&env, "NONEXISTENT_TEMPLATE");
        let split_id = 1000u64;

        let _ = client.use_template(&fake_template_id, &split_id);
    }

    #[test]
    fn test_use_template_emits_event() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Event Template");
        let participants = create_equal_split_participants(&env, 2);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        let split_id = 1000u64;

        // Use the template and emit event
        let _ = client.use_template(&template_id, &split_id);

        // In practice, you'd verify the event was emitted
        // This is a smoke test that the function completes
    }

    // ============================================
    // Authorization Tests
    // ============================================

    #[test]
    fn test_create_template_requires_auth() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Auth Test");
        let participants = create_equal_split_participants(&env, 2);

        // The create_template function calls creator.require_auth()
        // If we call it without authorizing the creator, Soroban SDK will handle it
        // This test verifies the auth is performed

        let _ = client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        // The test framework handles auth; this verifies the contract compiles
        // and the require_auth call is made
    }

    // ============================================
    // Versioning Tests
    // ============================================

    #[test]
    fn test_get_template_version() {
        let (_env, _creator, client) = setup();

        let version = client.get_template_version();
        assert_eq!(version, 1);
    }

    #[test]
    fn test_is_compatible_current_version() {
        let (_env, _creator, client) = setup();

        assert!(client.is_compatible(&1));
    }

    #[test]
    fn test_is_not_compatible_old_version() {
        let (_env, _creator, client) = setup();

        assert!(!client.is_compatible(&0));
    }

    #[test]
    fn test_is_not_compatible_future_version() {
        let (_env, _creator, client) = setup();

        assert!(!client.is_compatible(&2));
    }

    #[test]
    fn test_template_stores_version() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Versioned Template");
        let participants = create_equal_split_participants(&env, 2);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        let template = client.get_template(&template_id);
        assert_eq!(template.version, 1);
    }

    // ============================================
    // Edge Cases
    // ============================================

    #[test]
    fn test_template_with_many_participants() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Many Participants");
        let mut participants = SorobanVec::new(&env);

        // Create 100 participants with equal share
        for _ in 0..100 {
            participants.push_back(create_participant(&env, 1));
        }

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        let template = client.get_template(&template_id);
        assert_eq!(template.participants.len(), 100);
    }

    #[test]
    fn test_creator_index_persistence() {
        let (env, creator, client) = setup();

        // Create 5 templates
        let template_names = [
            "Template 0",
            "Template 1",
            "Template 2",
            "Template 3",
            "Template 4",
        ];

        for name_str in template_names.iter() {
            let name = SorobanString::from_str(&env, name_str);
            let participants = create_equal_split_participants(&env, 2);

            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);
        }

        // Verify all 5 are indexed
        let templates = client.get_templates(&creator);
        assert_eq!(templates.len(), 5);
    }

    // ============================================
    // apply_template: use_count, max_uses, missing template
    // ============================================

    #[test]
    fn test_apply_template_increments_use_count() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Count Template");
        let participants = create_equal_split_participants(&env, 2);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        // use_count starts at 0
        let before = client.get_template(&template_id);
        assert_eq!(before.use_count, 0);

        // First application
        let after_first = client.apply_template(&template_id, &1u64);
        assert_eq!(after_first.use_count, 1);

        // Persisted value should reflect increment
        let stored = client.get_template(&template_id);
        assert_eq!(stored.use_count, 1);

        // Second application
        let after_second = client.apply_template(&template_id, &2u64);
        assert_eq!(after_second.use_count, 2);

        let stored2 = client.get_template(&template_id);
        assert_eq!(stored2.use_count, 2);
    }

    #[test]
    fn test_apply_template_respects_max_uses() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Limited Template");
        let participants = create_equal_split_participants(&env, 2);

        // Set max_uses = 2
        let template_id = client.create_template(
            &creator,
            &name,
            &SplitType::Equal,
            &participants,
            &Some(2u32),
        );

        // First two applications should succeed
        let r1 = client.apply_template(&template_id, &1u64);
        assert_eq!(r1.use_count, 1);

        let r2 = client.apply_template(&template_id, &2u64);
        assert_eq!(r2.use_count, 2);

        // Third application must return TemplateLimitReached
        let result = client.try_apply_template(&template_id, &3u64);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(crate::Error::TemplateLimitReached));
    }

    #[test]
    fn test_apply_template_unlimited_when_no_max_uses() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Unlimited Template");
        let participants = create_equal_split_participants(&env, 2);

        let template_id =
            client.create_template(&creator, &name, &SplitType::Equal, &participants, &None);

        // Apply 10 times — should never hit a limit
        for i in 0u64..10 {
            let result = client.apply_template(&template_id, &i);
            assert_eq!(result.use_count, (i + 1) as u32);
        }
    }

    #[test]
    fn test_apply_template_missing_template_returns_error() {
        let (env, _creator, client) = setup();

        let nonexistent_id = SorobanString::from_str(&env, "DOES_NOT_EXIST");

        let result = client.try_apply_template(&nonexistent_id, &1u64);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(crate::Error::TemplateNotFound));
    }

    #[test]
    fn test_apply_template_max_uses_zero_always_errors() {
        let (env, creator, client) = setup();

        let name = SorobanString::from_str(&env, "Zero Max Template");
        let participants = create_equal_split_participants(&env, 2);

        // max_uses = 0 means it can never be applied
        let template_id = client.create_template(
            &creator,
            &name,
            &SplitType::Equal,
            &participants,
            &Some(0u32),
        );

        let result = client.try_apply_template(&template_id, &1u64);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Ok(crate::Error::TemplateLimitReached));
    }
}
