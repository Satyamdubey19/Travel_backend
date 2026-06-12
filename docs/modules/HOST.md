# Host Module Documentation

## Purpose

The host module represents supplier/operator accounts that manage tours, rentals, activities, bookings, KYC, payments, reviews, and analytics.

## Source Files

```text
modules/host/services/host.service.ts
app/host frontend pages
app/api/admin/hosts/*
app/api/admin/kyc/*
modules/activity/*
modules/rental/*
modules/tour/*
```

## Current Backend Shape

There is no large standalone `app/api/host/*` route group in the current backend. Host behavior is spread across:

```text
auth host intent/signup
admin host moderation
KYC admin review
host-owned listing CRUD
tour/rental/activity host operations
booking/payout/review admin and host surfaces
```

## Host Onboarding Flow

```text
User requests host signup or activateHost intent
  -> backend creates User with role USER if public signup
  -> backend creates pending Host profile
  -> user verifies email
  -> host completes KYC/profile/listing requirements
  -> admin reviews KYC/host/listings
  -> backend/admin process grants HOST access when approved
```

Important current auth rule:

```text
Public host signup and PATCH /api/auth/me activateHost do not grant HOST role by themselves.
```

## Host Authorization Expectations

Host-scoped mutation APIs should verify:

```text
authenticated user exists
User.role is HOST where host access is required
Host record exists
Host is active
Host is approved or KYC-approved where product policy requires it
resource belongs to host
```

## Related APIs

```text
PATCH /api/auth/me
GET   /api/admin/hosts
PATCH /api/admin/hosts/[id]
GET   /api/admin/kyc
PATCH /api/admin/kyc/[id]
POST  /api/tour
PUT   /api/tour/[id]
DELETE /api/tour/[id]
POST  /api/rental
PUT   /api/rental/[id]
DELETE /api/rental/[id]
POST  /api/activity
PUT   /api/activity/[id]
DELETE /api/activity/[id]
```

## Testing Notes

```text
Normal USER cannot access host-only mutation routes.
Pending Host profile without role HOST cannot access host-only routes.
HOST cannot mutate another host's listing.
Suspended/inactive host cannot mutate listings.
Admin approval should be required where product policy says so.
```

## Known Risks / Follow-Ups

```text
Audit every host mutation route for approved/active Host checks.
Create a dedicated host API doc if app/api/host routes are added.
Define exact admin/KYC flow that promotes USER+Host profile to HOST access.
```
