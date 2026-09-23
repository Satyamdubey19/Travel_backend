# Tours Module Documentation

## Purpose

The tours module manages public tour browsing, host tour CRUD, tour operational content, join requests, participants, chat, documents, announcements, reviews, and waitlist entry points.

Booking intent, travelers, cancellation, and payment are documented in `TOUR_BOOKING.md`.

## Risk-aware listing controls

Tour supply stores an explicit `LOW`, `MEDIUM`, `HIGH`, or `VERY_HIGH` risk level separately from physical difficulty. Submission requires an honest public risk disclosure, public meeting-area guidance, eligibility, and minimum age. Medium and higher risk require an emergency/escalation plan. High risk additionally requires adult travelers, an equipment checklist, supported traveler verification, and organizer approval for each join request.

Very-high-risk listings may be documented but cannot be activated until caretaker assignment and qualification checks are implemented. Admin activation re-runs the same server policy. Migration `20260910060000_tour_risk_safety` returns existing active/approved tours to `PENDING_REVIEW`; no old listing inherits an unreviewed safety classification.

## Source Files

```text
app/api/tour/*
modules/tour/controllers/tour.controller.ts
modules/tour/controllers/tour-operations.controller.ts
modules/tour/services/tour.service.ts
modules/tour/services/tour-operations.service.ts
modules/tour/services/tour-listing-policy.ts
modules/tour/services/tour-traveler-duplicate.service.ts
```

## Auth

```text
Public GET routes:
  public tour list/detail/reviews where implemented.

Host mutation routes:
  require authenticated user and Host record.

Traveler/user actions:
  require authenticated user.
```

## Main Tour Endpoints

```text
GET    /api/tour
POST   /api/tour
GET    /api/tour/[id]
PUT    /api/tour/[id]
DELETE /api/tour/[id]
```

Flow:

```text
GET /api/tour
  -> public list query
  -> return tour data

POST /api/tour
  -> require host
  -> create host-owned tour
  -> return 201

GET /api/tour/[id]
  -> public detail by id or slug
  -> return tour or 404

PUT /api/tour/[id]
  -> require host owner
  -> update tour

DELETE /api/tour/[id]
  -> require host owner
  -> soft-archive tour
```

Public list/detail results require an active, approved listing owned by an active, approved and verified host. Host create/update ignores client-supplied publication status; every material save re-enters moderation and revokes prior approval.

## Operational Endpoints

```text
GET/POST /api/tour/[id]/batches
GET/POST /api/tour/[id]/participants
GET/POST /api/tour/[id]/chat
GET/POST /api/tour/[id]/announcements
GET/POST /api/tour/[id]/documents
POST    /api/tour/[id]/join-request
PATCH   /api/tour/[id]/join-request/[requestId]
GET/POST /api/tour/[id]/reviews
POST    /api/tour/[id]/validate-traveler
POST    /api/tour/[id]/waitlist
```

## Batches

```text
GET /api/tour/[id]/batches
  -> list departure batches for tour

POST /api/tour/[id]/batches
  -> require host owner
  -> create departure batch
```

## Participants

```text
GET /api/tour/[id]/participants
  -> require host or authorized participant depending controller rules
  -> list participant/traveler data

POST /api/tour/[id]/participants
  -> operational participant mutation where supported
```

## Chat

```text
GET /api/tour/[id]/chat
  -> authenticate user
  -> load chat history

POST /api/tour/[id]/chat
  -> authenticate user
  -> persist message
  -> return message
```

Real-time socket support exists separately under:

```text
lib/socket-server.ts
src/realtime/*
```

## Announcements And Documents

```text
GET /api/tour/[id]/announcements
POST /api/tour/[id]/announcements
GET /api/tour/[id]/documents
POST /api/tour/[id]/documents
```

Expected pattern:

```text
GET requires either the active approved owning host or a participant whose membership and canonical booking are confirmed.
Cancellation/removal revokes access; completed members retain read access to archived announcements/documents.
Participant document reads exclude host-only records.
POST is host-owned operational content.
```

## Join Requests

```text
POST /api/tour/[id]/join-request
  -> authenticate user
  -> create request to join a tour/group

PATCH /api/tour/[id]/join-request/[requestId]
  -> host approves or rejects request
```

## Reviews

```text
GET /api/tour/[id]/reviews
  -> public published reviews

POST /api/tour/[id]/reviews
  -> authenticate user
  -> require completed booking/traveler
  -> create review
```

## Traveler Validation And Waitlist

```text
POST /api/tour/[id]/validate-traveler
  -> authenticate user
  -> validate duplicate traveler identity

POST /api/tour/[id]/waitlist
  -> authenticate user
  -> add user/traveler to waitlist
```

## Testing Notes

```text
Public list/detail should work without auth.
Host create/update/delete should reject unauthenticated users.
Host create/update/delete should reject normal USER accounts.
Host update/delete should reject non-owner host.
Duplicate slugs should return 409.
Review creation should require completed booking.
Join request approval should require host owner.
Chat send should require authenticated user and tour access.
```

## Known Risks / Follow-Ups

```text
Host approval/KYC should be enforced consistently before host mutations if product policy requires it.
Tour operations should have ownership checks on every POST/PATCH/DELETE.
Trip Circle database/browser authorization tests remain required for chat, roster, announcements and documents.
Message-level reporting, blocking and moderation remain required.
```
