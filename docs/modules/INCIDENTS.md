# Incidents module

## Purpose and boundary

This module records private operational incidents linked to an existing tour booking. It is not a public review, social post, emergency dispatch system, safety guarantee, or replacement for India's 112 service.

## User routes

```text
GET  /api/incidents
POST /api/incidents
```

Both require the current database-backed user. A report may be created only by the traveler who owns the canonical `Booking` or the user who owns that booking's `Host`. The booking must point to a tour. Creation is limited to five reports per user/IP per hour.

Input is strict and bounded: booking UUID, supported category/severity, 10–160 character title, 30–4,000 character factual description and an urgent-danger flag. Immediate-danger reports must be high or critical. The UI directs people in danger to call 112/local emergency help first.

The user list returns only the reporter's incidents and a public-safe status history. It does not return administrative notes, another person's identity, or operational evidence.

## Admin routes

```text
GET   /api/admin/incidents?status=ACTIVE
PATCH /api/admin/incidents/:id
```

Admins can assign themselves, add notes, change severity, advance status, pause the affected tour, or suspend the affected host operation. Status progression is intentionally ordered:

```text
OPEN -> TRIAGED -> IN_PROGRESS -> RESOLVED -> CLOSED
```

Every mutation requires 20 or more characters of notes; resolution and closure require 40. A conditional update rejects concurrent stale actions. Each accepted action appends an `IncidentEvent`, writes `AuditLog`, and queues a privacy-minimized notification. Restricting a tour clears approval and activity; suspending a host clears approval and activity without erasing prior verification evidence or banning the underlying user automatically.

## Data and privacy

`Incident` contains the report, severity, status, owner and immutable booking/tour/host references. `IncidentEvent` is append-only application history. Public tour APIs never expose incident data or the full organizer emergency plan. Email messages contain a reference/status only; the report remains inside authenticated operations UI.

## Verified locally

- Schema validates and Prisma Client generates.
- Incident transition, urgent severity and decision-note policy tests pass.
- Backend and frontend lint and production builds pass.
- Routes appear in the compiled application manifests.

## Release gaps

- Run route/transaction tests against isolated PostgreSQL, including concurrent updates and notification rollback.
- Add private evidence uploads with malware/content scanning, authorization, retention and deletion rules.
- Define on-call roles, severity response targets, appeals and India-qualified emergency/legal procedures.
- Add browser accessibility tests and deployed alerting for unowned/overdue critical incidents.
