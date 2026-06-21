# StellarSplit Contracts Status

This document provides a single source of truth for the deployment readiness and integration status of all Soroban smart contracts in the `contracts/` workspace.

## Contract Matrix

| Contract | Status | Supported? | Description | Known Blockers / Notes |
|----------|--------|------------|-------------|------------------------|
| **achievement-badges** | Production | ✅ Yes | NFT achievement badges | None. Ready for integration. |
| **flash-loan** | Production | ✅ Yes | Flash loan protocol | None. Fully tested. |
| **path-payment** | Production | ✅ Yes | Automatic currency conversion | None. |
| **split-template** | Production | ✅ Yes | Reusable split templates | None. Supports versioning. |
| **staking** | Production | ✅ Yes | Staking, governance & rewards | None. Fully tested. |
| **dispute-resolution** | Production | ✅ Yes | On-chain dispute handling | None. Ready for integration. |
| **split-escrow** | In Progress | ❌ No | Trustless bill split escrow | Excluded from workspace. Issues being resolved in a separate PR. |
| **multi-sig-splits** | Broken | ❌ No | Multi-signature coordination | Excluded from workspace. Failing unit and proptests. |
| **reminder** | Production | ✅ Yes | On-chain payment reminders | Ready for integration. |

## Integration Policy

The frontend and backend **must only integrate with contracts marked as Production**. 

Contracts listed as **Broken** or **In Progress** (such as `split-escrow` and `multi-sig-splits`) are currently undergoing heavy refactoring or toolchain upgrades and **cannot be deployed or interacted with** locally or on testnet. Attempts to compile these modules using `cargo build --workspace` will currently fail unless they are specifically excluded from the workspace (which they are in `Cargo.toml`).

## Updating Status

When fixing a broken contract:
1. Ensure `cargo test -p <contract_name>` passes locally.
2. Ensure `cargo clippy --target wasm32-unknown-unknown` yields no errors.
3. Update `contracts/README.md` and this document to reflect the `Production` status.
4. Add the contract to the CI build scripts.
