#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, IntoVal, String, Symbol, Val, Vec,
};

mod eligibility;
mod events;
mod metadata;
mod storage;
mod types;

pub use eligibility::EligibilityResult;
pub use metadata::{BadgeOwnershipInfo, UserBadgeCollection};
pub use types::{BadgeMetadata, BadgeType, UserBadge};

use eligibility::evaluate_eligibility;
use storage::{
    get_admin, get_escrow_contract, has_badge, remove_badge, save_badge, set_admin,
    set_escrow_contract,
};

#[contracttype]
#[derive(Clone, Debug)]
pub struct BadgeEvidence {
    pub escrow_id: String,
    pub total_split_amount: i128,
    pub participant_count: u32,
    pub completion_rate: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Badge {
    pub id: Symbol,
    pub recipient: Address,
    pub tier: Symbol,
    pub evidence_escrow_id: String,
    pub minted_at: u64,
}

#[contract]
pub struct AchievementBadgesContract;

#[contractimpl]
impl AchievementBadgesContract {
    pub fn initialize(env: Env, admin: Address, escrow_contract: Address) {
        admin.require_auth();
        set_admin(&env, &admin);
        set_escrow_contract(&env, &escrow_contract);
        events::emit_initialized(&env, &admin);
    }

    /// Read-only eligibility check — no auth required.
    ///
    /// This function evaluates real achievement evidence against badge criteria.
    /// It takes explicit contract inputs to back the eligibility decision.
    pub fn check_eligibility_with_evidence(
        env: Env,
        user: Address,
        evidence: BadgeEvidence,
    ) -> EligibilityResult {
        let _ = user;
        evaluate_eligibility(&env, &evidence)
    }

    pub fn mint_badge_with_evidence(env: Env, user: Address, evidence: BadgeEvidence) -> Badge {
        user.require_auth();

        if has_badge(&env, &user, &evidence.escrow_id) {
            panic!("badge already minted for this escrow");
        }

        let escrow_address = get_escrow_contract(&env);
        let on_chain_total = get_total_split_amount(&env, &escrow_address, &evidence.escrow_id);
        let on_chain_participants =
            get_participant_count(&env, &escrow_address, &evidence.escrow_id);

        let verified_evidence = BadgeEvidence {
            escrow_id: evidence.escrow_id.clone(),
            total_split_amount: on_chain_total,
            participant_count: on_chain_participants,
            completion_rate: evidence.completion_rate,
        };

        let result = evaluate_eligibility(&env, &verified_evidence);
        if !result.is_eligible {
            panic!("eligibility check failed: on-chain data does not meet badge threshold");
        }

        let badge = Badge {
            id: Symbol::new(&env, "badge"),
            recipient: user.clone(),
            tier: result.tier,
            evidence_escrow_id: evidence.escrow_id.clone(),
            minted_at: env.ledger().timestamp(),
        };

        save_badge(&env, &user, &evidence.escrow_id, &badge);
        badge
    }

    pub fn revoke_badge(env: Env, admin: Address, user: Address, escrow_id: String) {
        admin.require_auth();
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            panic!("unauthorized: caller is not admin");
        }

        remove_badge(&env, &user, &escrow_id);
    }

    pub fn get_badge_metadata(env: Env, badge_type: BadgeType) -> BadgeMetadata {
        metadata::get_metadata_for_badge(&env, &badge_type)
    }

    pub fn badge_metadata_standard(env: Env, badge_type: BadgeType) -> BadgeMetadata {
        metadata::get_metadata_for_badge(&env, &badge_type)
    }

    pub fn has_badge(env: Env, user: Address, escrow_id: String) -> bool {
        has_badge(&env, &user, &escrow_id)
    }
}

fn get_total_split_amount(env: &Env, escrow_address: &Address, escrow_id: &String) -> i128 {
    let mut args: Vec<Val> = Vec::new(env);
    args.push_back(escrow_id.clone().into_val(env));

    env.invoke_contract(
        escrow_address,
        &Symbol::new(env, "get_total_split_amount"),
        args,
    )
}

fn get_participant_count(env: &Env, escrow_address: &Address, escrow_id: &String) -> u32 {
    let mut args: Vec<Val> = Vec::new(env);
    args.push_back(escrow_id.clone().into_val(env));

    env.invoke_contract(
        escrow_address,
        &Symbol::new(env, "get_participant_count"),
        args,
    )
}
