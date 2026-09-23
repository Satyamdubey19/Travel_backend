# Rental booking module

Status: implemented foundation; integration and operations gates remain open.

## Purpose

This module turns a moderated rental listing into a traveler-owned reservation. It never trusts a browser-supplied amount, never exposes an unapproved host listing publicly and never treats opening the payment window as success.

## Public and traveler routes

| Method | Route | Responsibility |
|---|---|---|
| GET | `/api/rental` | Approved, active rentals from active/approved/verified hosts |
| GET | `/api/rental/:id-or-slug` | Public rental detail and host terms |
| POST | `/api/rental/:id-or-slug/booking` | Idempotent 15-minute date hold |
| POST | `/api/rental/:id-or-slug/payment/order` | User-owned Razorpay order |
| POST | `/api/rental/:id-or-slug/payment/verify` | Constant-time signature verification and confirmation |
| POST | `/api/rental-bookings/:bookingId/cancel` | Owner cancellation and refund-review request |
| GET/POST | `/api/rental/:id-or-slug/reviews` | Published reviews / completed-booking review upsert |
| GET/PUT/POST | `/api/host/rental-bookings/:bookingId/inspections/:stage` | Host reads, saves and submits pickup/return evidence |
| GET | `/api/rental-bookings/:bookingId/inspections` | Traveler reads submitted evidence |
| POST | `/api/rental-bookings/:bookingId/inspections/:stage/respond` | Traveler acknowledges or disputes evidence |
| GET | `/api/admin/rental-disputes` | Admin lists disputed/resolved custody evidence |
| PATCH | `/api/admin/rental-disputes/:id` | Admin records a final reasoned evidence outcome |

## Inventory and price rules

- Pickup and return are calendar dates; return is exclusive and must be after pickup.
- Past pickup dates and online rentals longer than 60 days are rejected.
- The server multiplies the stored daily rate by calculated days. Browser totals are display-only.
- The security deposit is disclosed but not included in the current online payment.
- A serializable transaction locks the rental row and counts overlapping live `PENDING` holds plus `CONFIRMED` reservations.
- Capacity comes from the host's moderated `availableUnits`; stale pending records stop counting when their hold expires.
- Booking idempotency is scoped by traveler and rental so identical client keys cannot cross accounts or listings.

## Payment and lifecycle

- A pending booking and payment are created together and expire after 15 minutes.
- Payment-order creation first claims the payment record to avoid parallel provider orders.
- Browser verification binds the Razorpay order to the authenticated traveler and requested rental.
- The signed raw-body webhook independently validates provider order amount/currency and confirms the matching rental payment.
- The expiry job cancels stale holds and marks unpaid payment failed.
- Confirmed bookings become `COMPLETED` after their return date so reviews remain booking-linked.

## Cancellation and refunds

- Only the booking owner may cancel a pending or confirmed rental.
- Unpaid cancellation becomes `CANCELLED` and immediately stops consuming date capacity.
- Paid cancellation becomes `REFUND_PENDING` and creates one `RentalRefund` with the maximum paid amount and captured policy text.
- Free-form host policy is not automatically interpreted. Provider refund execution requires a reviewed approved amount and remains an open operations gate.

## Host and admin controls

- Host create/update payloads are schema validated.
- A host cannot set moderation status. Create and every content update become `PENDING_REVIEW`, clear approval and require admin review.
- Host deletion is a recoverable archive operation.
- Admin moderation uses `/api/admin/listings` and `/api/admin/listings/rental/:id`; rejection, pause and archive require a reason and all decisions are audited.

## Pickup, return and custody evidence

- Only the approved booking host can create a draft or submit it, and only for a paid confirmed/completed rental.
- Pickup evidence must be submitted before return evidence can be recorded.
- Each stage is unique per booking. Submitted evidence is immutable.
- Submission requires odometer, fuel/charge percentage, meaningful condition notes, a completed checklist and at least two private images.
- Inspection uploads use authenticated storage under the owning host and booking; references reject URLs and traversal-like identifiers.
- Signed evidence links last ten minutes and are returned only after host or traveler booking ownership checks.
- The traveler can acknowledge or dispute a submitted stage once. A dispute requires a meaningful reason and creates an audit warning.
- Return acknowledgement completes a confirmed booking and records the custody closure timeline.
- Admin resolution is conditionally claimed, requires one supported outcome and at least 20 characters of notes, notifies both parties and records an audit warning.
- Evidence resolution does not automatically charge a deposit or issue a refund; money movement stays in its separately reviewed provider workflow.

## Verification evidence

- Prisma schema validates and client generation succeeds.
- Rental policy tests cover idempotency scope, strict date parsing, duration bounds and server totals.
- The shared backend suite currently passes 35 tests; backend and frontend TypeScript and lint gates pass.
- Production builds are recorded separately in the live tracker after each complete slice.

## Open production gates

- Apply/rehearse the migration against isolated PostgreSQL and run parallel overlap tests.
- Exercise Razorpay test-mode success, failure, delayed webhook, duplicate webhook and reconciliation.
- Rehearse the implemented admin approval/provider execution/retry/reconciliation flow in Razorpay test mode.
- Apply the rental-inspection migration and exercise pickup/return ownership and concurrency against isolated PostgreSQL.
- Add retention/deletion jobs, evidence malware/content scanning and a legal escalation runbook.
- Validate the implemented transactional notification outbox in PostgreSQL/Brevo test mode and add browser accessibility/end-to-end coverage.
