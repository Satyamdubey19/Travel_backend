# Backend Module Documentation Index

This folder contains module-level documentation for the active backend API surface.

## Modules

```text
ADMIN.md
  Admin dashboard, users, hosts, KYC, listings, bookings, payouts, and posts.

LISTINGS.md
  Activity, rental, and public listing CRUD patterns.

TOURS.md
  Tour CRUD, host operations, tour detail APIs, chat, documents, announcements, joins, reviews, and waitlist.

TOUR_BOOKING.md
  Tour booking intent, travelers, cancellation, payment order, payment verification, duplicate traveler checks.

ACTIVITY_BOOKING.md
  Dated activity inventory, idempotent seat holds, payment, expiry, cancellation/refund review and verified reviews.

RENTAL_BOOKING.md
  Date-overlap rental inventory, idempotent holds, payment, expiry, cancellation/refund review and verified reviews.

REVIEWS.md
  Booking-linked reviews, public visibility, host responses, admin moderation and aggregate repair.

INCIDENTS.md
  Private booking-bound tour incident reporting, ordered admin triage, audited restrictions and emergency-service boundary.

COMMUNITY_SAFETY.md
  Trip Circle message reporting, user blocking, symmetric message visibility and audited admin moderation.

HOST.md
  Host onboarding, host authorization expectations, and host-related route ownership.

BOOKINGS.md
  User booking history and booking ownership patterns.

WISHLIST.md
  Wishlist list, add, and remove flows.

NOTIFICATIONS.md
  Ownership-scoped inbox, transactional email outbox, retry/dead-letter worker, privacy boundary, and remaining real-time work.

UTILITY.md
  Uploads, location, AI, and legacy alias endpoints.

JOBS.md
  Cron and background job responsibilities.
```

Auth documentation is separate under:

```text
docs/auth/
```

## Common Response Shapes

Most module APIs use one of these shapes:

```json
{ "data": {} }
```

```json
{ "success": true, "data": {} }
```

```json
{ "error": "message" }
```

## Common Auth Rules

```text
Public GET routes return public listing data.
User routes require a valid auth cookie or NextAuth session.
Host mutation routes require an authenticated user with a Host record.
Admin routes require role ADMIN through requireAdmin().
Cron routes require CRON_SECRET bearer token or x-cron-secret.
```
