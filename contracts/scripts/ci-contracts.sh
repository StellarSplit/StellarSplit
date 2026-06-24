#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Supported contracts: all crates that compile cleanly under the pinned Soroban toolchain.
#
# Excluded (broken):
# - multi-sig-splits: E0507 move error (needs ownership fix)
SUPPORTED_CONTRACTS=(
  "achievement-badges"
  "dispute-resolution"
  "flash-loan"
  "path-payment"
  "reminder"
  "split-template"
  "staking"
  "reminder"
)

COMMAND="${1:-all}"

run_for_contract() {
  local contract="$1"

  echo ""
  echo "==> $COMMAND :: $contract"

  case "$COMMAND" in
    fmt)
      cargo fmt -p "$contract" --all -- --check
      ;;
    test)
      cargo test -p "$contract"
      ;;
    build)
      cargo build -p "$contract" --target wasm32-unknown-unknown --release
      ;;
    *)
      echo "Unsupported command: $COMMAND (expected fmt, test, build, or all)"
      echo "Usage: bash ./scripts/ci-contracts.sh [fmt|test|build|all]"
      exit 1
      ;;
  esac
}

if [ "$COMMAND" = "all" ]; then
  # Run fmt, test, and build sequentially for all supported contracts
  for step in fmt test build; do
    COMMAND="$step"
    for contract in "${SUPPORTED_CONTRACTS[@]}"; do
      run_for_contract "$contract"
    done
  done
  COMMAND="all"
else
  for contract in "${SUPPORTED_CONTRACTS[@]}"; do
    run_for_contract "$contract"
  done
fi

echo ""
echo "All contract checks completed for: ${SUPPORTED_CONTRACTS[*]}"
