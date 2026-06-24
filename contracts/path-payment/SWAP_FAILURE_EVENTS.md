# Swap Failure Event Implementation

## Overview

The path-payment contract now emits structured events when swap operations fail. This enables real-time monitoring systems to track and respond to failed swap attempts on-chain, providing complete observability for the swap pipeline.

## Problem Statement

Previously, when a swap failed during path payment execution (e.g., insufficient balance, token paused, router unavailable), the function would return an error but no on-chain event would be recorded. This created a blind spot in monitoring systems — only successful swaps were observable.

## Solution

Added a comprehensive event emission system that:
- Records all swap failures before returning errors
- Captures source asset, destination asset, amount, and failure reason
- Complements existing success event (`emit_path_payment_executed`)

## Implementation Details

### 1. Event Function (events.rs)

**Function**: `emit_swap_failed`

```rust
pub fn emit_swap_failed(env: &Env, from: &Address, to: &Address, amount_in: i128, reason: &str) {
    env.events().publish(
        (symbol_short!("swap_err"),),
        (
            from.clone(),
            to.clone(),
            amount_in,
            String::from_str(env, reason),
        ),
    );
}
```

**Event Topic**: `swap_err` (9-character limit for Soroban symbols)

**Event Data Structure**:
- `from`: Source asset address
- `to`: Destination asset address  
- `amount_in`: Amount of source asset that failed to swap
- `reason`: String description of failure reason

**Location**: [contracts/path-payment/src/events.rs](src/events.rs#L44-L51)

### 2. Error Paths in execute_path_payment

The function emits `swap_err` event in three failure scenarios:

#### Scenario 1: Missing Router
**Location**: [lib.rs:233-239](src/lib.rs#L233-L239)

```rust
let router = match storage::get_swap_router(&env) {
    Some(r) => r,
    None => {
        let to_asset = path.get(1).unwrap();
        events::emit_swap_failed(
            &env,
            &source_addr,
            &to_asset.address().clone(),
            amount_in,
            "no_router_set",
        );
        return Err(Error::MissingRouter);
    }
};
```

**When**: No swap router contract has been configured
**Reason Code**: `"no_router_set"`

#### Scenario 2: Invalid Swap Output
**Location**: [lib.rs:254-260](src/lib.rs#L254-L260)

```rust
Ok(_out) => {
    events::emit_swap_failed(
        &env,
        &current_asset,
        &to_addr,
        current_amount,
        "zero_or_negative_output",
    );
    return Err(Error::SwapFailed);
}
```

**When**: Swap returns zero or negative output amount
**Reason Code**: `"zero_or_negative_output"`

#### Scenario 3: Router Invocation Failure
**Location**: [lib.rs:264-270](src/lib.rs#L264-L270)

```rust
Err(_) => {
    events::emit_swap_failed(
        &env,
        &current_asset,
        &to_addr,
        current_amount,
        "invoke_error",
    );
    return Err(Error::SwapFailed);
}
```

**When**: External router contract call fails or panics
**Reason Code**: `"invoke_error"`

### 3. Success Event (Complementary)

For context, successful path payments emit:

```rust
events::emit_path_payment_executed(
    &env,
    &split_id,
    &source_addr,
    &dest_addr,
    current_amount,
    path.len(),
);
```

**Event Topic**: `pay_exec`

## Testing

### Test Function
**Location**: [test.rs:5-56](src/test.rs#L5-L56)

**Function**: `test_swap_failure_event_emitted`

**What it validates**:
1. ✅ Triggers a swap failure (no router set)
2. ✅ Verifies error is returned
3. ✅ Uses `env.events().all()` to retrieve on-chain events
4. ✅ Confirms `swap_err` event topic is present
5. ✅ Validates event data contains 4 elements (from, to, amount, reason)
6. ✅ Asserts event emission with descriptive message

**Test Coverage**:
- Validates the event is emitted before error return
- Confirms event structure matches specification
- Demonstrates proper use of `env.events().all()` for event retrieval

### Running Tests

```bash
# Run the specific failure event test
cargo test -p path-payment -- test_swap_failure_event_emitted --nocapture

# Run all path-payment tests
cargo test -p path-payment

# Run with output
cargo test -p path-payment -- --nocapture
```

## Event Schema Reference

### swap_err Event

| Field | Type | Description |
|-------|------|-------------|
| Topic | Symbol | `"swap_err"` |
| from | Address | Source asset contract address |
| to | Address | Destination asset contract address |
| amount_in | i128 | Amount of source asset attempted |
| reason | String | Failure reason code |

### Reason Codes

| Code | Scenario |
|------|----------|
| `"no_router_set"` | Swap router not configured |
| `"zero_or_negative_output"` | Router returned invalid output |
| `"invoke_error"` | External call to router failed |

## Usage in Monitoring Systems

### Example: Event Listener (Conceptual)

```rust
// Listen for swap failures
let events = env.events().all();
for (contract_addr, topics, data) in events {
    // Topic check
    if let Ok(sym) = Symbol::try_from_val(&env, &topics[0]) {
        if sym == symbol_short!("swap_err") {
            // Extract data
            if let Ok(data_vec) = Vec::<Val>::try_from_val(&env, &data) {
                let from = data_vec.get(0);      // Address
                let to = data_vec.get(1);        // Address
                let amount = data_vec.get(2);    // i128
                let reason = data_vec.get(3);    // String
                
                // Alert monitoring system
                alert_failed_swap(from, to, amount, reason);
            }
        }
    }
}
```

## Integration Points

1. **Path Payment Execution**: Automatically emits on any swap failure
2. **Monitoring Systems**: Subscribe to `swap_err` events for real-time alerts
3. **Compliance/Auditing**: On-chain record of all failed attempts for investigation
4. **Retry Logic**: External systems can trigger retries based on reason code

## Acceptance Criteria — Met ✅

- ✅ Failed swap emits `swap_err` event
- ✅ Successful swap emits `swap_executed` event (`pay_exec`)
- ✅ All existing path-payment tests pass
- ✅ New test validates event emission on failure
- ✅ Event contains all required data (from, to, amount, reason)

## Technical Notes

### Symbol Limitations
Soroban constrains event topics to 9-character symbols. `"swap_err"` uses 8 characters.

### Error Handling Pattern
The implementation follows the pattern:
1. Detect failure condition
2. Emit event with context
3. Return error

This ensures events are always recorded before errors propagate.

### Token Transfer Edge Case
The initial token transfer (line 211) uses `token::Client::transfer()` which panics on failure rather than returning `Result`. This is a Soroban SDK design limitation — panics bypass normal error handling. If transfer fails, the entire transaction reverts and no event is emitted (transaction not finalized). This is acceptable as token transfer failures are fatal to the entire operation.

## Files Modified

- `contracts/path-payment/src/events.rs` — Added `emit_swap_failed` function
- `contracts/path-payment/src/lib.rs` — Added event emissions in error paths
- `contracts/path-payment/src/test.rs` — Added comprehensive failure event test

## Related Events

| Event | Topic | When |
|-------|-------|------|
| Initialized | `"init"` | Contract initialized |
| Path Found | `"path_fnd"` | Payment path located |
| Payment Executed | `"pay_exec"` | Successful path payment |
| Pair Registered | `"pair_reg"` | Asset pair registered |
| **Swap Failed** | **`"swap_err"`** | **Swap operation failed** |

---

**Implementation Date**: 2026-06-21  
**Status**: Complete and Tested ✅
