# Activity Booking Module

Status: **Implemented locally; integration verification pending**  
Last verified: **2026-09-10**

## Purpose

This module provides the traveler activity lifecycle: discover verified-host inventory, select a real dated slot, hold capacity, pay through Razorpay, confirm from signed provider evidence, cancel, release inventory and publish a booking-linked review after completion.

## Endpoints

```text
GET  /api/activity
GET  /api/activity/[id]
POST /api/activity/[id]/booking
POST /api/activity/[id]/payment/order
POST /api/activity/[id]/payment/verify
GET  /api/activity/[id]/reviews
POST /api/activity/[id]/reviews
GET/POST /api/activity/[id]/slots
PATCH/DELETE /api/activity/[id]/slots/[slotId]
POST /api/activity-bookings/[bookingId]/cancel
POST /api/webhooks/razorpay
POST /api/cron/expire-bookings
```

## Booking invariants

- Only active activities owned by active, approved and verified hosts appear publicly.
- The host account cannot book its own activity.
- Online checkout requires at least next-day inventory; same-day timing ambiguity is deliberately rejected.
- Cancellation terms must be published before checkout.
- Client idempotency is scoped by authenticated user and activity.
- Price is read from the database and multiplied by validated guest count on the server.
- Capacity is held with one conditional SQL update inside a serializable transaction.
- The booking and payment hold expires after 15 minutes.
- An expiry/cancellation releases capacity only after winning a conditional state claim.
- A payment order is bound to the booking owner and route activity.
- Browser verification uses the Razorpay order/payment HMAC; webhook verification uses the exact raw request body and event ID deduplication.
- Payment success is checked against stored amount/currency in the webhook before confirmation.

## Cancellation and refunds

Unpaid bookings become `CANCELLED` and their pending/processing payment becomes `FAILED`. Paid confirmed bookings become `REFUND_PENDING`, and an `ActivityRefund` record captures the maximum requested amount and exact listing policy text for operations review.

The system intentionally does not calculate or promise an automatic refund from free-form policy text. Admin tooling now supports capped approval/rejection, a claimed Razorpay refund attempt, reconciliation, audit logs and traveler notification. Razorpay test-mode lifecycle and dispute handling remain required.

## Reviews

Only a traveler with a `COMPLETED` activity booking may review. One review is allowed per activity booking. Updating a review does not inflate totals; count and average rating are recomputed transactionally from published reviews.

## Remaining production gates

- Apply and rehearse migrations in an isolated PostgreSQL database.
- Prove concurrent last-seat behavior and duplicate idempotency requests.
- Run Razorpay test-mode success, failed, dismissed, duplicate and out-of-order webhook cases.
- Rehearse admin refund execution/reconciliation in Razorpay test mode.
- Extend the implemented unified host manifest with explicit check-in and schedule-change operations.
- Validate the implemented notification outbox and delivery retry path against isolated PostgreSQL and Brevo test mode.
- Run responsive, keyboard, screen-reader and browser checkout tests.
