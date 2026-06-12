# Admin Module Documentation

## Purpose

The admin module manages platform operations: dashboard metrics, users, hosts, KYC, listings, bookings, payouts, and posts.

## Source Files

```text
app/api/admin/*
controllers/admin.controller.ts
modules/admin/controllers/admin.controller.ts
services/admin.service.ts
modules/admin/services/admin.service.ts
utils/admin-auth.ts
utils/admin-query.ts
validators/admin.validators.ts
types/admin.ts
```

## Auth

Admin endpoints require an authenticated `ADMIN` user.

```text
request
  -> requireAdmin()
  -> custom token cookie or NextAuth session
  -> load DB user
  -> require role ADMIN
```

Unauthorized or non-admin requests return admin access errors.

## API Endpoints

```text
GET   /api/admin/dashboard
GET   /api/admin/users
PATCH /api/admin/users/[id]
GET   /api/admin/hosts
PATCH /api/admin/hosts/[id]
GET   /api/admin/kyc
PATCH /api/admin/kyc/[id]
GET   /api/admin/listings
PATCH /api/admin/listings/[type]/[id]
GET   /api/admin/bookings
PATCH /api/admin/bookings/[id]
GET   /api/admin/payouts
PATCH /api/admin/payouts/[id]
GET/PATCH /api/admin/posts
```

## Main Flows

### Dashboard

```text
GET /api/admin/dashboard
  -> require ADMIN
  -> aggregate users, hosts, bookings, payouts, listings, revenue
  -> return dashboard metrics
```

### User Moderation

```text
GET /api/admin/users
  -> require ADMIN
  -> apply query filters/search/pagination
  -> return user rows

PATCH /api/admin/users/[id]
  -> require ADMIN
  -> validate moderation payload
  -> update status/isActive/isBanned/moderation fields
  -> return updated user
```

### Host Moderation

```text
GET /api/admin/hosts
  -> require ADMIN
  -> list host profiles and moderation state

PATCH /api/admin/hosts/[id]
  -> require ADMIN
  -> approve, reject, suspend, or update host status
  -> return updated host
```

### KYC Review

```text
GET /api/admin/kyc
  -> require ADMIN
  -> list KYC applications

PATCH /api/admin/kyc/[id]
  -> require ADMIN
  -> approve or reject KYC
  -> update reviewed fields
```

### Listing Moderation

```text
GET /api/admin/listings
  -> require ADMIN
  -> list hotels, tours, rentals, activities by status/type

PATCH /api/admin/listings/[type]/[id]
  -> require ADMIN
  -> approve, reject, pause, archive, or update listing status
```

Supported listing types should match service handling:

```text
hotel
tour
rental
activity
```

### Bookings And Payouts

```text
GET /api/admin/bookings
PATCH /api/admin/bookings/[id]
GET /api/admin/payouts
PATCH /api/admin/payouts/[id]
```

These APIs support operational review, status updates, payout approval/rejection, and audit trails where implemented.

## Testing Notes

```text
Test every route without auth -> should fail.
Test with USER -> should fail.
Test with HOST -> should fail.
Test with ADMIN -> should succeed.
Verify pagination/search/filter query behavior.
Verify moderation actions persist reviewedBy/reviewedAt where supported.
Verify invalid listing type is rejected.
```

## Known Risks / Follow-Ups

```text
Admin security depends on auth token/session correctness.
Add audit logging for every admin mutation if not already covered.
Add regression tests for role enforcement.
```
