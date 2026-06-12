# Listings Module Documentation

## Purpose

The listings module covers public and host-managed listing APIs for activities and rentals. Tour listing APIs are documented separately in `TOURS.md`.

## Source Files

```text
app/api/activity/*
app/api/rental/*
modules/activity/controllers/activity.controller.ts
modules/activity/services/activity.service.ts
modules/rental/controllers/rental.controller.ts
modules/rental/services/rental.service.ts
services/activity.service.ts
services/rental.service.ts
```

## Auth

```text
GET list/detail routes:
  public by default.

POST/PUT/DELETE routes:
  require authenticated host session.
  controller checks current user session and Host record.
```

## Activity Endpoints

```text
GET    /api/activity
POST   /api/activity
GET    /api/activity/[id]
PUT    /api/activity/[id]
DELETE /api/activity/[id]
```

## Rental Endpoints

```text
GET    /api/rental
POST   /api/rental
GET    /api/rental/[id]
PUT    /api/rental/[id]
DELETE /api/rental/[id]
```

## Common Listing Flow

```text
Public list request
  -> parse query params
  -> service queries active/public listings
  -> return { data: [...] }

Public detail request
  -> find by id or slug depending service behavior
  -> return listing detail or 404

Host create request
  -> require session
  -> load Host by user id
  -> validate payload in service/controller
  -> create listing with host ownership
  -> return { data } with 201

Host update/delete request
  -> require session and host
  -> verify listing exists and belongs to host
  -> mutate listing
  -> return success/data
```

## Typical Listing Status Flow

```text
DRAFT or PENDING_REVIEW
  -> admin review
  -> ACTIVE or REJECTED
  -> PAUSED or ARCHIVED
```

## Response Shapes

```json
{ "data": [] }
```

```json
{ "data": {} }
```

```json
{ "success": true }
```

```json
{ "error": "Activity not found" }
```

```json
{ "error": "Rental not found" }
```

## Testing Notes

```text
GET list should work unauthenticated.
GET detail should return 404 for unknown id/slug.
POST without auth should return 401.
POST as USER without Host should return 403.
POST as Host should create listing.
PUT/DELETE should reject non-owner host.
Duplicate slug should return 409.
```

## Known Risks / Follow-Ups

```text
Host authorization should require approved/active host if product policy requires it.
Input validation should be schema-backed for every create/update payload.
Admin moderation should be required before public ACTIVE visibility.
```
