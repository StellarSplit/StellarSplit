# StellarSplit Webhooks Guide

This guide provides comprehensive information for implementing and troubleshooting StellarSplit webhooks. Webhooks allow your application to receive real-time notifications about events in StellarSplit, such as split creation, payments, and participant updates.

## Table of Contents

1. [Overview](#overview)
2. [Webhook Registration](#webhook-registration)
3. [Event Types](#event-types)
4. [Webhook Payload Structure](#webhook-payload-structure)
5. [Signature Verification](#signature-verification)
6. [Delivery and Retries](#delivery-and-retries)
7. [Rate Limiting](#rate-limiting)
8. [Failure Handling and Deactivation](#failure-handling-and-deactivation)
9. [Delivery Logs and Statistics](#delivery-logs-and-statistics)
10. [Testing Webhooks](#testing-webhooks)
11. [Troubleshooting](#troubleshooting)
12. [Security Best Practices](#security-best-practices)

---

## Overview

StellarSplit webhooks are HTTP POST callbacks that deliver event notifications to your registered endpoints. When an event occurs in StellarSplit (e.g., a payment is made, a split is created), the system sends a JSON payload to your webhook URL with a cryptographic signature for verification.

### Key Features

- **Event Fan-out**: Multiple webhooks can be registered for the same event type
- **HMAC-SHA256 Signatures**: All webhooks are cryptographically signed for security
- **Automatic Retries**: Failed deliveries are retried with exponential backoff
- **Rate Limiting**: Protection against webhook spam
- **Delivery Logs**: Full visibility into delivery attempts and responses
- **Automatic Deactivation**: Webhooks with excessive failures are automatically disabled

---

## Webhook Registration

### Creating a Webhook

Register a webhook by sending a POST request to the webhooks endpoint:

**Request**

```http
POST /api/webhooks
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "url": "https://your-app.com/webhooks/stellarsplit",
  "events": ["split.created", "payment.received"]
}
```

**Request Fields**

| Field        | Type     | Required | Description                                                                 |
| ------------ | -------- | -------- | --------------------------------------------------------------------------- |
| `url`        | string   | Yes      | HTTPS endpoint where webhook events will be sent                             |
| `events`     | string[] | Yes      | Array of event types to subscribe to (see [Event Types](#event-types))     |

**Response** `201 Created`

```json
{
  "id": "webhook-uuid",
  "url": "https://your-app.com/webhooks/stellarsplit",
  "secret": "8d4f3c9a1b2e7f0d5c6b8a9e4f2d1c3b8a7e6f5d4c3b2a1908f7e6d5c4b3a291",
  "events": ["split.created", "payment.received"],
  "userId": "user-uuid-or-wallet-address",
  "isActive": true,
  "failureCount": 0,
  "lastTriggeredAt": null,
  "createdAt": "2026-04-28T12:00:00.000Z",
  "updatedAt": "2026-04-28T12:00:00.000Z"
}
```

Store the returned `secret` securely when the webhook is created. StellarSplit generates this 32-byte random signing secret server-side instead of accepting one in the create request.

### Listing Webhooks

Retrieve all webhooks, optionally filtered by user ID:

```http
GET /api/webhooks?userId=user-uuid-or-wallet-address
Authorization: Bearer <your_jwt_token>
```

**Response** `200 OK`

```json
[
  {
    "id": "webhook-uuid",
    "url": "https://your-app.com/webhooks/stellarsplit",
    "events": ["split.created"],
    "isActive": true,
    "failureCount": 0,
    "createdAt": "2026-04-28T12:00:00.000Z"
  }
]
```

### Updating a Webhook

Modify an existing webhook:

```http
PATCH /api/webhooks/:id
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "url": "https://your-app.com/webhooks/new-endpoint",
  "events": ["split.created", "payment.received", "participant.added"]
}
```

To rotate a webhook secret, send a replacement `secret` with at least 32 non-repeating characters. Weak values such as `secret`, `test`, `changeme`, or repeated single-character secrets are rejected.

### Deleting a Webhook

Remove a webhook:

```http
DELETE /api/webhooks/:id
Authorization: Bearer <your_jwt_token>
```

**Response** `204 No Content`

---

## Event Types

StellarSplit emits the following event types that you can subscribe to:

| Event Type           | Description                                    | Triggered When                                    |
| -------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `split.created`      | A new split was created                         | Split creation is completed                       |
| `split.updated`      | A split was updated                             | Split details are modified                        |
| `split.completed`    | A split was marked as completed                 | All participants have paid their shares          |
| `payment.completed`  | A payment was successfully completed            | Stellar transaction is confirmed                 |
| `payment.failed`     | A payment failed                                | Stellar transaction failed or was rejected       |
| `participant.added`  | A participant was added to a split              | New participant joins a split                     |
| `participant.removed`| A participant was removed from a split          | Participant is removed from a split               |
| `receipt.uploaded`   | A receipt was uploaded                          | Receipt image is successfully uploaded           |
| `receipt.ocr_complete`| Receipt OCR processing completed              | OCR data extraction is finished                  |

### Event Fan-out

When an event occurs, StellarSplit delivers it to **all active webhooks** that are:
1. Subscribed to that specific event type
2. Associated with the same user ID (if specified during registration)

This means you can register multiple webhooks for different purposes (e.g., one for notifications, one for analytics, one for backup).

---

## Webhook Payload Structure

All webhook deliveries follow this standard structure:

**Request Headers**

```http
Content-Type: application/json
X-Webhook-Signature: sha256=<hex_signature>
X-Webhook-Timestamp: 1714320000000
X-Webhook-Event: split.created
```

**Request Body**

```json
{
  "event": "split.created",
  "data": {
    "splitId": "split-uuid",
    "title": "Dinner at Nobu",
    "totalAmount": 450.00,
    "currency": "USD",
    "creatorId": "user-uuid",
    "participants": [...]
  },
  "timestamp": 1714320000000
}
```

### Payload Fields

| Field      | Type    | Description                                                   |
| ---------- | ------- | ------------------------------------------------------------- |
| `event`    | string  | The event type that triggered this webhook                    |
| `data`     | object  | Event-specific data (varies by event type)                    |
| `timestamp` | number  | Unix timestamp in milliseconds when the webhook was triggered |

### Event-Specific Data

#### split.created

```json
{
  "splitId": "uuid",
  "title": "Dinner at Nobu",
  "totalAmount": 450.00,
  "currency": "USD",
  "creatorId": "user-uuid",
  "status": "active",
  "createdAt": "2026-04-28T12:00:00.000Z"
}
```

#### payment.completed

```json
{
  "paymentId": "uuid",
  "splitId": "uuid",
  "participantId": "uuid",
  "amount": 225.00,
  "asset": "XLM",
  "stellarTxHash": "abc123...",
  "confirmedAt": "2026-04-28T12:00:00.000Z"
}
```

#### participant.added

```json
{
  "participantId": "uuid",
  "splitId": "uuid",
  "name": "Alice",
  "walletAddress": "GABC...",
  "amountOwed": 225.00,
  "addedAt": "2026-04-28T12:00:00.000Z"
}
```

---

## Signature Verification

All webhook deliveries include an `X-Webhook-Signature` header that contains an HMAC-SHA256 signature of the request body. You should verify this signature to ensure the webhook is genuinely from StellarSplit.

### Verification Process

1. Extract the signature from the `X-Webhook-Signature` header
2. Remove the `sha256=` prefix to get the raw hex signature
3. Compute your own HMAC-SHA256 hash using your webhook secret
4. Compare the computed hash with the received signature using constant-time comparison

### Example Implementation

#### Node.js

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in Express
app.post('/webhooks/stellarsplit', (req, res) => {
  const signature = req.headers['x-webhook-signature'].replace('sha256=', '');
  const payload = JSON.stringify(req.body);
  const secret = 'your-webhook-secret';
  
  if (!verifyWebhookSignature(payload, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process the webhook
  console.log('Webhook verified:', req.body);
  res.status(200).send('OK');
});
```

#### Python

```python
import hmac
import hashlib

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

# Usage in Flask
@app.route('/webhooks/stellarsplit', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Webhook-Signature').replace('sha256=', '')
    payload = request.get_data(as_text=True)
    secret = 'your-webhook-secret'
    
    if not verify_webhook_signature(payload, signature, secret):
        return 'Invalid signature', 401
    
    # Process the webhook
    print('Webhook verified:', request.json)
    return 'OK', 200
```

#### Go

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "strings"
)

func verifyWebhookSignature(payload, signature, secret string) bool {
    h := hmac.New(sha256.New, []byte(secret))
    h.Write([]byte(payload))
    expectedSignature := hex.EncodeToString(h.Sum(nil))
    
    return hmac.Equal([]byte(signature), []byte(expectedSignature))
}
```

---

## Delivery and Retries

### Delivery Process

1. **Queueing**: When an event occurs, all matching webhooks are queued for delivery
2. **Rate Limit Check**: Each webhook is checked against rate limits before delivery
3. **HTTP Request**: A POST request is sent to your webhook URL with a 5-second timeout
4. **Response Handling**: Your endpoint should respond with a 2xx status code
5. **Retry on Failure**: Failed deliveries are automatically retried

### Retry Policy

| Configuration | Value               |
| ------------- | ------------------- |
| Max Retries   | 3 attempts         |
| Backoff Type  | Exponential        |
| Initial Delay | 1,000 ms (1 second)|
| Timeout       | 5,000 ms (5 seconds)|

### Retry Schedule

- **Attempt 1**: Immediate
- **Attempt 2**: ~1 second after first failure
- **Attempt 3**: ~2 seconds after second failure
- **Attempt 4**: ~4 seconds after third failure (final attempt)

### Successful Delivery

A delivery is considered successful if your endpoint responds with any HTTP status code in the `2xx` range (200-299). Any other status code or timeout is treated as a failure.

### Response Recommendations

- **200 OK**: Webhook processed successfully
- **202 Accepted**: Webhook accepted for async processing
- **204 No Content**: Webhook processed, no content to return

Avoid returning 5xx errors for expected failures (e.g., validation errors). Use 4xx codes instead to prevent unnecessary retries.

---

## Rate Limiting

To protect against webhook spam and ensure system stability, StellarSplit implements per-webhook rate limiting.

### Rate Limit Configuration

| Parameter               | Value          |
| ----------------------- | -------------- |
| Window Duration         | 60,000 ms (1 minute) |
| Max Requests per Window | 10 requests    |

### Rate Limit Behavior

- Each webhook has its own rate limit counter
- The counter resets after the window expires
- If a webhook exceeds the limit, deliveries are skipped until the window resets
- Rate-limited deliveries are not retried

### Handling Rate Limits

If your webhook is rate-limited, you will see skipped deliveries in your delivery logs. To avoid rate limiting:

1. Ensure your webhook endpoint responds quickly (< 1 second)
2. Process webhooks asynchronously if heavy processing is required
3. Consider batching multiple events if your use case allows it

---

## Failure Handling and Deactivation

### Failure Counting

Each webhook maintains a `failureCount` that increments when:
- A delivery fails after all retry attempts
- Your endpoint returns a non-2xx status code
- The request times out

### Automatic Deactivation

To prevent endless retries to failing endpoints, webhooks are automatically deactivated when:

| Condition                      | Threshold |
| ------------------------------ | --------- |
| Consecutive failures           | 10        |

When a webhook is deactivated:
- `isActive` is set to `false`
- No further events are delivered to this webhook
- You must manually reactivate it via the API

### Reactivating a Webhook

To reactivate a deactivated webhook:

```http
PATCH /api/webhooks/:id
Content-Type: application/json

{
  "isActive": true,
  "failureCount": 0
}
```

### Monitoring Failure Counts

Check your webhook's failure count regularly:

```http
GET /api/webhooks/:id/stats
```

**Response**

```json
{
  "total": 100,
  "success": 95,
  "failed": 5,
  "pending": 0,
  "successRate": 95.0
}
```

A success rate below 90% may indicate issues with your webhook endpoint.

---

## Delivery Logs and Statistics

### Viewing Delivery Logs

Retrieve recent delivery attempts for a webhook:

```http
GET /api/webhooks/:id/deliveries?limit=50
Authorization: Bearer <your_jwt_token>
```

**Query Parameters**

| Parameter | Type   | Default | Description                              |
| --------- | ------ | ------- | ---------------------------------------- |
| `limit`   | number | 50      | Maximum number of delivery logs to return |

**Response** `200 OK`

```json
[
  {
    "id": "delivery-uuid",
    "webhookId": "webhook-uuid",
    "eventType": "payment.completed",
    "status": "success",
    "httpStatus": 200,
    "attemptCount": 1,
    "deliveredAt": "2026-04-28T12:00:00.000Z",
    "responseBody": "{\"status\":\"ok\"}",
    "errorMessage": null,
    "createdAt": "2026-04-28T12:00:00.000Z"
  },
  {
    "id": "delivery-uuid-2",
    "webhookId": "webhook-uuid",
    "eventType": "split.created",
    "status": "failed",
    "httpStatus": 500,
    "attemptCount": 3,
    "deliveredAt": "2026-04-28T12:00:00.000Z",
    "responseBody": "{\"error\":\"Internal server error\"}",
    "errorMessage": "HTTP 500: Internal Server Error",
    "createdAt": "2026-04-28T12:00:00.000Z"
  }
]
```

### Delivery Status Values

| Status   | Description                                    |
| -------- | ---------------------------------------------- |
| `pending`| Delivery is queued but not yet attempted        |
| `success`| Delivery succeeded (2xx response)               |
| `failed` | Delivery failed after all retry attempts        |

### Viewing Delivery Statistics

Get aggregated statistics for a webhook:

```http
GET /api/webhooks/:id/stats
Authorization: Bearer <your_jwt_token>
```

**Response** `200 OK`

```json
{
  "total": 100,
  "success": 95,
  "failed": 5,
  "pending": 0,
  "successRate": 95.0
}
```

### Interpreting Statistics

- **total**: Total number of delivery attempts
- **success**: Number of successful deliveries
- **failed**: Number of failed deliveries
- **pending**: Number of deliveries currently queued
- **successRate**: Percentage of successful deliveries (0-100)

A success rate above 95% is considered healthy. Rates below 90% may indicate issues with your endpoint.

---

## Testing Webhooks

### Test Endpoint

Test a webhook with a sample event before using it in production:

```http
POST /api/webhooks/:id/test
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "eventType": "payment.completed",
  "payload": {
    "test": true,
    "message": "This is a test webhook",
    "timestamp": "2026-04-28T12:00:00.000Z"
  }
}
```

**Request Fields**

| Field       | Type   | Required | Description                                    |
| ----------- | ------ | -------- | ---------------------------------------------- |
| `eventType` | string | Yes      | Event type to simulate                         |
| `payload`   | object | No       | Custom payload (defaults to sample if omitted)  |

**Response** `200 OK`

```json
{
  "message": "Test webhook triggered",
  "webhookId": "webhook-uuid",
  "eventType": "payment.completed"
}
```

### Testing Best Practices

1. **Use a test environment**: Create a separate webhook for testing with a different URL
2. **Test signature verification**: Ensure your verification logic works correctly
3. **Test error handling**: Simulate failures to verify your retry logic
4. **Test rate limiting**: Send multiple test events to verify rate limit behavior
5. **Check delivery logs**: Verify test deliveries appear in the logs

### Local Testing Tools

For local development, use tools like:
- **ngrok**: Expose your local server to the internet
- **webhook.site**: Temporary webhook URL for testing
- **RequestBin**: Inspect webhook requests

Example with ngrok:

```bash
# Start your local server
npm run start

# Expose it via ngrok
ngrok http 3000

# Register webhook with ngrok URL
POST /api/webhooks
{
  "url": "https://abc123.ngrok.io/webhooks/stellarsplit",
  ...
}
```

---

## Troubleshooting

### Common Issues

#### Webhook Not Receiving Events

**Possible Causes:**
- Webhook is not active (`isActive: false`)
- Webhook is not subscribed to the event type
- User ID filter doesn't match the event's user
- Webhook has been deactivated due to excessive failures

**Solutions:**
1. Check webhook status: `GET /api/webhooks/:id`
2. Verify event subscription: Ensure the event type is in the `events` array
3. Check delivery logs: `GET /api/webhooks/:id/deliveries`
4. Reactivate if deactivated: `PATCH /api/webhooks/:id` with `isActive: true`

#### Signature Verification Failing

**Possible Causes:**
- Incorrect secret key
- Payload encoding mismatch
- Timing attack vulnerability in comparison

**Solutions:**
1. Verify the secret matches what you registered
2. Ensure you're using the raw request body (not parsed JSON)
3. Use constant-time comparison for signature verification
4. Check for whitespace or encoding issues

#### High Failure Rate

**Possible Causes:**
- Webhook endpoint is slow or timing out
- Endpoint returning non-2xx status codes
- Network connectivity issues
- Rate limiting

**Solutions:**
1. Check delivery logs for specific error messages
2. Ensure your endpoint responds within 5 seconds
3. Return 2xx status codes even for expected errors
4. Implement async processing for heavy operations
5. Check rate limit statistics

#### Webhook Deactivated Unexpectedly

**Possible Causes:**
- 10 consecutive delivery failures
- Persistent endpoint issues

**Solutions:**
1. Review delivery logs to identify the root cause
2. Fix the underlying issue with your endpoint
3. Reactivate the webhook: `PATCH /api/webhooks/:id` with `isActive: true`
4. Reset failure count if needed: `PATCH /api/webhooks/:id` with `failureCount: 0`

### Debugging Checklist

- [ ] Webhook is active (`isActive: true`)
- [ ] Webhook URL is accessible and responds to POST requests
- [ ] Webhook is subscribed to the correct event types
- [ ] Signature verification is implemented correctly
- [ ] Endpoint returns 2xx status codes
- [ ] Endpoint responds within 5 seconds
- [ ] Delivery logs show recent attempts
- [ ] Success rate is above 90%
- [ ] Rate limits are not being exceeded

### Getting Help

If you're still experiencing issues:

1. Check the delivery logs for detailed error messages
2. Review the statistics for patterns in failures
3. Test your webhook with the test endpoint
4. Consult the API documentation for endpoint details
5. Open an issue on GitHub with:
   - Webhook ID
   - Recent delivery logs
   - Expected vs. actual behavior
   - Your endpoint implementation (sanitized)

---

## Security Best Practices

### Secret Management

- **Generate strong secrets**: Use at least 32 characters of random data
- **Store secrets securely**: Use environment variables or secret management services
- **Rotate secrets periodically**: Change webhook secrets regularly
- **Never log secrets**: Ensure secrets are never written to logs or error messages

### Endpoint Security

- **Use HTTPS**: Always use HTTPS URLs for webhook endpoints
- **Validate signatures**: Always verify the HMAC signature before processing
- **Use constant-time comparison**: Prevent timing attacks in signature verification
- **Rate limit your endpoint**: Implement your own rate limiting to prevent abuse
- **Sanitize payloads**: Validate and sanitize all webhook data before use

### Data Handling

- **Treat webhooks as untrusted**: Verify all data before using it
- **Validate event types**: Ensure the event type is expected
- **Check timestamps**: Reject old or future timestamps to prevent replay attacks
- **Log security events**: Log signature failures and suspicious activity

### Monitoring and Alerting

- **Monitor success rates**: Set up alerts for success rates below 90%
- **Track failure counts**: Alert when failure counts approach the deactivation threshold
- **Monitor endpoint health**: Ensure your webhook endpoint is always available
- **Review delivery logs regularly**: Check for patterns in failures or anomalies

### Example Secure Implementation

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

// Environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MAX_TIMESTAMP_DIFF = 5 * 60 * 1000; // 5 minutes

app.post('/webhooks/stellarsplit', express.raw({type: 'application/json'}), (req, res) => {
  // 1. Verify signature
  const signature = req.headers['x-webhook-signature'];
  if (!signature) {
    console.error('Missing signature');
    return res.status(401).send('Missing signature');
  }
  
  const payload = req.body.toString();
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expectedSignature)
  )) {
    console.error('Invalid signature');
    return res.status(401).send('Invalid signature');
  }
  
  // 2. Parse and validate payload
  let webhookData;
  try {
    webhookData = JSON.parse(payload);
  } catch (e) {
    console.error('Invalid JSON');
    return res.status(400).send('Invalid JSON');
  }
  
  // 3. Check timestamp (prevent replay attacks)
  const now = Date.now();
  const timestamp = webhookData.timestamp;
  if (Math.abs(now - timestamp) > MAX_TIMESTAMP_DIFF) {
    console.error('Timestamp too old or in future');
    return res.status(400).send('Invalid timestamp');
  }
  
  // 4. Validate event type
  const validEvents = ['split.created', 'payment.completed', 'participant.added'];
  if (!validEvents.includes(webhookData.event)) {
    console.error('Unknown event type:', webhookData.event);
    return res.status(400).send('Unknown event type');
  }
  
  // 5. Process webhook asynchronously
  processWebhookAsync(webhookData)
    .then(() => res.status(200).send('OK'))
    .catch((error) => {
      console.error('Webhook processing failed:', error);
      res.status(500).send('Processing failed');
    });
});

async function processWebhookAsync(data) {
  // Your webhook processing logic here
  console.log('Processing webhook:', data.event);
  // ...
}

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

---

## Additional Resources

- [API Reference](API.md) - Complete API documentation
- [Authentication Guide](AUTHENTICATION.md) - Authentication details
- [Backend README](../backend/README.md) - Backend setup and configuration
- [GitHub Issues](https://github.com/T-kesh/StellarSplit/issues) - Report bugs or request features

---

## Changelog

### Version 1.0 (2026-04-28)
- Initial webhook documentation
- Coverage of registration, delivery, retries, and security
- Signature verification examples in multiple languages
- Troubleshooting guide and best practices
