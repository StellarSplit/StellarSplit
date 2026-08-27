# PR Description: Harden Webhook Signing Secrets

## Summary

This PR removes client-controlled webhook secrets from creation and makes StellarSplit generate cryptographically strong signing secrets server-side. It also blocks weak client-supplied values during secret rotation so HMAC verification cannot be downgraded after creation.

## Related issue

- #729 Webhook Secret Is Fully Client-Supplied With No Entropy Requirement

## Problem

- `CreateWebhookDto` accepted any non-empty string as the webhook signing secret.
- A caller could register a trivially brute-forceable secret such as `"a"`.
- `WebhookDeliveryService.generateSignature()` uses the webhook secret as the HMAC-SHA256 trust anchor for outbound webhook verification.

## What changed

- Removed `secret` from `CreateWebhookDto`.
- Generate new webhook secrets in `WebhooksService.create()` with `crypto.randomBytes(32).toString('hex')`.
- Build the create payload explicitly so direct service callers cannot smuggle in a weak `secret` property.
- Validate secret rotation in `WebhooksService.update()`:
  - minimum 32 characters
  - reject all-same-character values
  - reject common weak values such as `secret`, `test`, and `changeme`
- Added DTO-level validation hints for update requests.
- Updated webhook documentation to describe server-generated creation secrets and rotation requirements.

## Migration / Backfill Note

Existing webhooks may already have weak secrets created before this fix. This PR does not force-rotate them to avoid breaking receivers unexpectedly. Follow-up operational work should identify weak existing secrets using the same minimum length, repeated-character, and deny-list checks, notify affected owners, and rotate each webhook secret through the existing update flow.

## Validation

- `npm test -- --runTestsByPath src/webhooks/webhooks.service.spec.ts src/webhooks/webhook-delivery.service.spec.ts src/webhooks/webhooks.controller.spec.ts`

## Acceptance Criteria

- New webhooks receive server-generated 64-character hex secrets from 32 bytes of cryptographic randomness.
- Client-supplied create secrets are ignored by the service and rejected by the global validation pipe in the HTTP API.
- Weak update/rotation secrets are rejected.
- Existing webhook delivery signing flow is unchanged.
