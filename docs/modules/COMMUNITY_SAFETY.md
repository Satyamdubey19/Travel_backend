# Community safety: blocking and Trip Circle message reports

## Boundary and access

This module protects private Trip Circle communication. It is separate from emergency incidents: message reports are moderation cases; immediate danger belongs in the incident flow and local emergency services (112 in India where available).

- All traveler operations require the current database-backed session.
- Reporting and blocking require approved-host or confirmed-participant Trip Circle access.
- A person can block only another member of that circle. Self-blocking is rejected in policy and by the database.
- Reports must reference a non-deleted message in the same circle. Self-reporting and duplicate reports are rejected.
- Admin list/decision routes require the database-backed ADMIN guard; client roles are never accepted.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/community/blocks` | List the current user's blocks |
| DELETE | `/api/community/blocks/:blockedId` | Remove one block |
| POST | `/api/tour/:id/blocks/:blockedId` | Block a circle member |
| POST | `/api/tour/:id/chat/:messageId/report` | Privately report one stored message |
| GET | `/api/admin/message-reports?status=OPEN` | Oldest-first moderation queue |
| PATCH | `/api/admin/message-reports/:id` | Save an ordered, reasoned decision |

Mutations inherit same-origin/CSRF protection. Block creation is limited to 20 per user/IP per hour; reports are limited to 10.

## Blocking behavior

`UserBlock` is directional for user control, but visibility is symmetric. If either person blocks the other, REST history and live message/typing delivery exclude that peer in both directions. Blocking does not change a paid booking, remove anyone from a trip, or hide host safety announcements.

## Reports and moderation

Reasons cover harassment, hate/abuse, sexual content, threat/safety, scam/spam, privacy violation and other. Context is bounded to 2,000 characters and mandatory for `OTHER`.

```text
OPEN -> IN_REVIEW -> ACTIONED
  |          `----> DISMISSED
  `--------------> ACTIONED or DISMISSED
```

Terminal cases cannot be reopened through this endpoint. Review requires meaningful notes and conditional update prevents concurrent overwrite. `ACTIONED` soft-deletes the message, preserves evidence, writes `AuditLog`, records the reviewer and queues a privacy-minimized outcome notification. The reported person is not told the reporter's identity.

## Stored host announcements

Host chat reads and creates real announcements through `/api/tour/:id/announcements`. Titles/bodies are bounded, severity is allow-listed, creation is rate-limited and traveler/host views refresh every 30 seconds. Invented pinned content and dead media/moderation buttons were removed.

## Migration and proof

`20260911010000_community_message_safety` adds `UserBlock`, `TourMessageReport`, explicit enums, uniqueness/indexes, foreign keys and self-target checks. It is not applied to the drifted shared database; it belongs in the documented backup/baseline/staging rehearsal.

Prisma format/validation, backend/frontend TypeScript and ESLint, and 63 backend tests pass. Database integration, authenticated two-browser block/report tests, retention/appeals, evidence-access policy, staffing/SLA and horizontally scaled socket fanout remain release gates.
