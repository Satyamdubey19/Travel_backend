# Jobs And Cron Module Documentation

## Purpose

Jobs and cron modules handle delayed or background operations such as booking expiry, refunds, waitlist processing, payouts, contests, and emails.

## Source Files

```text
app/api/cron/expire-bookings/route.ts
src/jobs/queues/*
src/jobs/workers/*
src/jobs/schedulers/*
workers/*
modules/booking/services/expire-bookings.service.ts
```

## Cron Endpoint

```text
GET  /api/cron/expire-bookings
POST /api/cron/expire-bookings
```

## Auth

The booking-expiry cron route is protected by a shared secret.

```text
Authorization: Bearer <CRON_SECRET>
```

or:

```text
x-cron-secret: <CRON_SECRET>
```

## Booking Expiry Flow

```text
cron request
  -> validate CRON_SECRET
  -> call booking expiry service
  -> find unpaid/expired pending bookings
  -> release inventory/reservations where supported
  -> update booking statuses
  -> return summary result
```

## Background Responsibilities

```text
booking expiry
refund processing
waitlist promotion
contest result processing
payout scheduling
email sending
notification fanout
```

## Testing Notes

```text
Missing secret should return 401.
Wrong secret should return 401.
Correct secret should execute expiry service.
Expired pending booking should be marked expired and release inventory.
Non-expired booking should not be changed.
Confirmed paid booking should not be expired.
```

## Production Notes

```text
Use external scheduler/cron provider to call cron routes.
Keep CRON_SECRET private and rotate if exposed.
Workers should be idempotent.
Long-running jobs should use queue workers instead of request lifecycle when possible.
```
