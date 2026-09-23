# Jobs And Cron Module Documentation

## Purpose

Jobs perform delayed or external work without making critical booking and payment transactions depend on network providers. Two cron entry points are currently active: stale booking expiry and durable notification email delivery.

## Active Endpoints

```text
GET|POST /api/cron/expire-bookings
GET|POST /api/cron/process-notifications?limit=25
```

Both accept either:

```text
Authorization: Bearer <CRON_SECRET>
x-cron-secret: <CRON_SECRET>
```

Production fails closed if the secret is absent. Development permits local invocation when no secret is configured. The secret must be high entropy, stored only in the deployment secret manager, rotated after exposure, and never placed in a frontend environment variable.

## Booking Expiry

The expiry job finds unpaid pending holds past `expiresAt`, conditionally claims them, changes status, and releases supported inventory. Confirmed or paid bookings are excluded. The result is a bounded summary rather than booking PII.

## Notification Delivery

Domain services atomically create `Notification` and `NotificationDelivery` rows. The worker:

1. selects at most the requested bounded batch (1–100);
2. atomically claims eligible or stale-locked rows;
3. sends a privacy-minimized email with a provider idempotency key;
4. marks success as `DELIVERED`; or
5. schedules exponential retry and finally `DEAD_LETTER` after five attempts.

The job is safe for overlapping scheduler invocations because each candidate is conditionally claimed. A 15-minute stale lock recovers interrupted work. Provider email failure does not undo a booking, payment, refund decision, inspection, or review operation.

## Launch Scheduling

```text
expire-bookings:       every minute
process-notifications: every minute, begin with limit=25
```

Scale the notification batch only after measuring provider rate limits and database duration. Scheduler timeouts must remain above a normal batch duration but below the stale-lock window.

## Required Monitoring

- Cron authentication failures and job duration.
- Oldest pending notification age.
- Counts by delivery status.
- Failure and dead-letter rate.
- Booking expiry count and inventory-release failures.
- Provider bounce, complaint, and suppression webhooks after integration.

Never log full notification messages, access tokens, OTPs, KYC values, evidence URLs, or provider credentials.

## Production Validation Still Required

- Apply and rollback migrations on a staging clone.
- Run two notification workers concurrently against isolated PostgreSQL.
- Force provider timeout, rejection, success-after-timeout, and rate-limit responses.
- Verify the same Brevo `headers.idempotencyKey` does not create a duplicate message.
- Verify stale locks recover and attempt five dead-letters.
- Exercise the implemented privacy-safe health queue and audited dead-letter replay before opening traffic; connect external alerts.

Refund reconciliation, waitlist promotion, payout scheduling, community moderation, and retention jobs remain future active implementations; legacy queue/worker folders alone are not treated as completed behavior.
