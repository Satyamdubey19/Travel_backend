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

HOST.md
  Host onboarding, host authorization expectations, and host-related route ownership.

BOOKINGS.md
  User booking history and booking ownership patterns.

WISHLIST.md
  Wishlist list, add, and remove flows.

NOTIFICATIONS.md
  Notification services, real-time gateway responsibilities, queues, and event fanout.

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
