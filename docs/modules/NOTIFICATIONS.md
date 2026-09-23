# Notifications Module Documentation

## Purpose

The notification module gives each authenticated traveler, host, or administrator an ownership-scoped in-app inbox and a durable email-delivery path. Domain transactions never call the email provider. They store the notification and its delivery intent together; a protected background worker performs external delivery afterward.

## Implemented Source Files

```text
modules/notification/services/notification.service.ts
modules/notification/services/notification-outbox.service.ts
modules/notification/services/notification-delivery.service.ts
modules/notification/services/notification-delivery-policy.ts
app/api/notifications/route.ts
app/api/notifications/[id]/route.ts
app/api/cron/process-notifications/route.ts
lib/mail.ts
prisma/migrations/20260910050000_notification_delivery_outbox/migration.sql
tests/notification-delivery-policy.test.ts
```

Older `src/realtime/*`, `src/jobs/*`, and `workers/*` folders are not evidence of an active production path. Real-time notification push is still pending; the current header retrieves stored notifications when opened.

## User API

```text
GET   /api/notifications       latest 50 notifications for the current user
PATCH /api/notifications/[id]  mark one owned notification read
PATCH /api/notifications       mark all current-user notifications read
```

All three routes require the current database user. Mark-one uses both `id` and `userId`, preventing an authenticated user from changing another user's notification.

## Transactional Outbox Contract

`queueNotification(tx, { data })` must receive the caller's active Prisma transaction. It writes:

1. one `Notification` row for the in-app inbox; and
2. one `NotificationDelivery` row for the `EMAIL` channel.

The unique `(notificationId, channel)` constraint prevents two email intents for one notification. Booking confirmation/cancellation, host booking actions, rental inspection/dispute events, reviews, refunds, admin decisions, and tour waitlist events now use this helper. Tour payment confirmation also creates its notification and delivery intent inside the successful payment transaction.

Legacy notifications created before this migration are intentionally not backfilled automatically; a product-approved migration would be required to avoid sending old events unexpectedly.

## Delivery State Machine

```text
PENDING -> PROCESSING -> DELIVERED
             |
             +-> FAILED -> PROCESSING (retry)
             |
             +-> DEAD_LETTER (after attempt 5)
```

- Eligible `PENDING` or `FAILED` rows are claimed with a conditional `updateMany`.
- Claiming increments the attempt counter and stores a lock timestamp.
- A `PROCESSING` row locked for more than 15 minutes becomes claimable again, which recovers from a crashed worker.
- Retry delay is exponential: 1, 2, 4, 8, then 16 minutes, capped at six hours for future policy changes.
- Errors are normalized to one line and capped at 500 characters before storage.
- Brevo receives the delivery UUID as its `headers.idempotencyKey` value, reducing duplicate sends when provider success occurs before the database is marked delivered.
- Missing provider configuration is a delivery failure. It never silently marks the job delivered and never rolls back the already-committed booking/payment action.

## Privacy Boundary

Email includes the notification title and a secure sign-in prompt only. The stored in-app message remains the source for booking codes, refund reasoning, KYC outcomes, evidence disputes, and other operational details. Email never asks for a password or OTP and does not include identity documents or private evidence URLs.

## Worker API

```text
GET  /api/cron/process-notifications?limit=25
POST /api/cron/process-notifications?limit=25
Authorization: Bearer <CRON_SECRET>
```

`x-cron-secret` is also supported. In production, absence of `CRON_SECRET` fails closed. A request processes 1–100 records and returns `scanned`, `claimed`, `delivered`, `failed`, and `deadLettered` counts.

Recommended launch schedule: every minute. Alert on dead-letter growth, sustained failure rate, or oldest pending age. Do not expose this endpoint through the browser UI.

## Verified Checks

- Notification retry, cap, terminal state, and error-sanitization policy tests pass.
- The backend production build and TypeScript validation pass with the generated Prisma client.
- Repository tracing finds no direct domain `notification.create`/`createMany` call outside the outbox helper.

Database/provider integration remains required in an isolated environment before launch: concurrent worker claims, Brevo idempotency, retry recovery, rate limits, email suppression/bounce handling, and dead-letter replay must be exercised with PostgreSQL and Brevo test credentials.

## Remaining Scope

- Exercise the implemented admin delivery-health screen and reasoned, rate-limited, audited dead-letter replay against isolated PostgreSQL.
- Persist notification preferences and enforce transactional versus optional categories server-side.
- Add provider webhook processing for delivered, bounced, complained, and suppressed events.
- Add unread-count polling or access-scoped real-time push.
- Add retention/anonymization policy and operational dashboards.
