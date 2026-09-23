# Reviews module

Status: implemented locally; database/browser integration remains open.

## Product promise

Reviews are evidence-backed marketplace feedback, not marketing fixtures. A traveler must have a completed booking for the reviewed tour, activity or rental. Public pages show only published records and identify them as booking-linked feedback.

## Routes

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/tour/:id/reviews` | Public reviews / completed-tour review upsert |
| GET/POST | `/api/activity/:id/reviews` | Public reviews / completed-activity review upsert |
| GET/POST | `/api/rental/:id/reviews` | Public reviews / completed-rental review upsert |
| GET | `/api/host/reviews` | Owning host's cross-product feedback and stored statistics |
| PUT | `/api/host/reviews/:id/response` | Owning host creates or updates one public response |
| GET | `/api/admin/reviews` | Admin moderation filters |
| PATCH | `/api/admin/reviews/:id` | Reasoned hide/restore operation |

## Invariants

- Review creation requires the current traveler and a completed product-specific booking.
- One review exists per booking; a later save updates rather than inflates totals.
- Rating is an integer from 1–5, title is at most 120 characters and comment is 10–2000 characters.
- Traveler edits preserve moderation visibility. A hidden review cannot self-republish.
- Host response requires host ownership, a published review and 10–1000 characters. It never changes the traveler rating or comment.
- Visibility changes require admin role, a 10–1000 character reason, a conditional claim, an audit event and traveler notification.
- Tour/activity/rental aggregates are recalculated from published reviews after create/update/moderation.
- Public listing lookup also requires an approved active listing and active, approved, verified host.

## Remaining gates

- Add abuse-report intake, appeal deadlines and moderation case assignment.
- Run PostgreSQL ownership/concurrency tests and browser role journeys.
- Add profanity/PII assistance without automatically suppressing legitimate negative reviews.
- Define retention and legal-export policy for moderated content.
