# Auth Current Release Gate

Last revalidated: 2026-09-13

This is the authoritative current-state document for authentication release decisions. Historical findings in older audit reports remain useful context, but this document supersedes any conflicting status claim.

Brevo setup and the operator checklist are documented in [`BREVO_CONFIGURATION.md`](./BREVO_CONFIGURATION.md).

## What is implemented in the active code

The active implementation is in `app/api/auth`, `modules/auth`, `lib`, and `proxy.ts`. The files below `src/modules/auth` are zero-byte legacy placeholders. A static import search found no active imports of that folder.

The current credential flow provides:

- public traveller registration and separate host-onboarding registration;
- a pending host profile rather than self-service `HOST` role assignment;
- credential login only after email verification;
- role checks resolved through `/api/auth/me`, so pages do not trust a stale role stored only in a browser token;
- a 15-minute `token` httpOnly access cookie plus a 30-day `refreshToken` httpOnly refresh cookie;
- device records, session records, refresh-token rotation, a three-device limit, and device logout;
- password reset and email-change flows that set `User.sessionInvalidatedAt`, revoke refresh/session/device rows, and reject access tokens issued at or before the invalidation time;
- strict request validation, trusted-origin checks on mutations, generic unknown-email password-recovery responses, and Redis-backed rate limiting when Redis is available;
- a development-only in-memory rate-limit fallback when a configured Redis connection is unreachable, while production returns a controlled 503 instead of falsely reporting a 429 client throttle.

`GET /api/verify` is deliberately retired and returns `410 Gone`. Current email verification uses `/api/auth/verify?email=...&token=...`.

## Current local configuration action

The real file to edit is `Travels_backend/.env`; editing `.env.example` does not change the running server. The current local `REDIS_URL` is an HTTPS REST endpoint. This backend uses `ioredis`, so copy the provider's Node/TCP connection string instead (it starts with `rediss://default:` for a hosted TLS Redis database). For a disposable machine-local development service, `redis://127.0.0.1:6379` is also syntactically valid. Never put the REST URL in `REDIS_URL` and never commit either value.

Brevo is now the only application email provider. The old Resend integration and package have been removed from the active backend and frontend. Before relying on registration or password recovery, add a valid Brevo API key, authenticate the sender/domain in Brevo, and use an isolated test inbox. Until those values are present, the code intentionally returns a controlled 503 and removes an incomplete account when verification mail cannot be delivered.

## Evidence already obtained

| Gate | Current evidence | Result |
| --- | --- | --- |
| Source test suite | `npm test` | 94 passing, 0 failing, including access-token invalidation, retired-route, strict device-replacement payload, public NextAuth endpoint, Brevo payload/error handling, and rate-limit error-classification regression tests |
| Static checks | `npm run lint` | Passed |
| Optimized application build | `npm run build` with a process-only syntactically valid Redis placeholder | Passed compilation, TypeScript, page collection, static generation, and optimization after the final auth-flow fixes. A normal build with the current `.env` remains intentionally blocked until the real `rediss://` value replaces the HTTPS REST URL. |
| Environment preflight | `npm run env:check` | Blocked by the current HTTPS Redis REST URL and absent `BREVO_API_KEY`/`BREVO_FROM_EMAIL`; the backend requires a TLS TCP `rediss://` connection string plus a verified Brevo sender configuration |
| Development database connectivity | Direct read-only `SELECT 1` connection check | Passed |
| Auth schema audit | `npm run auth:schema-audit` with explicit `READ_ONLY` development confirmation | All eight required auth tables, expected columns, and indexes are present. Current development counts are User 17, RefreshToken 30, Session 30, UserDevice 30, PasswordResetToken 0, EmailChangeRequest 0, LoginAttempt 33, SecurityEvent 96. The Prisma migration ledger is present but empty and still needs a formal baseline before staging. |
| Real backend role flow | Isolated traveler, approved host, and admin test identities on port 4000 | Login and `/api/auth/me` returned USER, HOST, and ADMIN respectively; logout returned 200 and the post-logout session request returned 401. The three-device limit and replacement-login path also passed after fixing strict payload validation. |
| Frontend proxy role flow | Isolated traveler through port 3000 | Login, `/api/auth/me`, cookie forwarding, logout, and post-logout 401 all passed through the browser-facing proxy. |
| Admin dashboard authorization | Approved admin identity through port 4000 | `GET /api/admin/dashboard` returned 200 after replacing a stale full-relation projection with an explicit compatible select. |
| Public signup delivery gate | Throwaway development signup through port 3000 | Previously failed closed with a controlled 503 because the former Resend sender was rejected. This gate must be rerun with `BREVO_API_KEY` and a verified `BREVO_FROM_EMAIL`; no unusable account was left behind. |
| Password-change containment | Isolated traveler on port 4000 | Password change returned 200; old password and replayed old access token returned 401; new password returned 200 |
| Current runtime auth proxy | `GET /api/auth/providers` and `GET /api/auth/session` through port 3000 | JSON responses returned; the old HTML/JSON client-fetch failure was not reproduced |
| Enumeration-safe recovery response | Unknown-address `POST /api/auth/forgot-password` on the local proxy | 201 generic response; no known account or token was created |
| Retired legacy route | Live `GET /api/verify` | 410 returned |
| Public UI route audit | Login, signup, host signup, recovery, and incomplete reset-link screens | Single clear role-neutral sign-in form; no broken role tabs; no browser console error on the incomplete reset screen |

These are source, build, development-database, and controlled role-flow checks. They do **not** yet prove real email delivery, public registration verification, password-reset email use, email-change delivery, Google handoff, or cross-instance behavior.

## Development database reconciliation record

The confirmed development database is reachable and the active auth schema now contains all required security tables and columns. A focused idempotent repair exists at `prisma/migrations/20260613010000_harden_auth_schema/migration.sql`; the live migration ledger remains empty, so the complete migration history has not yet been reconciled. The latest read-only audit recorded 17 users and 30 refresh/session/device records after controlled development role testing. No production data was targeted.

This repaired the active authentication schema but did **not** create migration-history rows. Before staging or production, reconcile the complete Prisma migration ledger against a freshly provisioned database or an approved baseline plan. Never use `migrate reset` on a non-disposable database.

## Blocking release conditions

Authentication must not be described as production-ready or released until every condition below has direct evidence.

1. Environment variable preflight and development database confirmation are complete. Keep all secret values out of source control and chat.
2. Reconcile the full Prisma migration ledger before staging or launch; the focused development auth repair intentionally did not invent ledger history.
3. Use a verified Brevo sender and an isolated test inbox to prove registration, verification, recovery, password reset, and email-change delivery.
4. Exercise pending-host, banned, disabled, and deleted account behavior against the real schema. Traveler, approved-host, and administrator login/session/logout behavior is now proven.
5. Replace the current HTTPS Redis REST URL with the provider's TLS TCP `rediss://` connection string, then prove PING, shared rate limits, and refresh-token behavior against that Redis instance. Development safely falls back to in-memory limits while this is missing; that fallback is not acceptable for multi-instance production.
6. If Google sign-in is enabled, configure its exact local callback URL and test a verified Google account followed by the first-party session handoff.
7. Run a staging multi-instance check before launch.

## Remaining engineering limitation

New custom access tokens carry both the device id and the exact persisted `Session.id`. `getUserFromSessionToken` checks that row on every authenticated request, so single-device logout is now enforced by PostgreSQL across application instances as well as by the local short-lived deny-list. Whole-account invalidation remains persisted through `User.sessionInvalidatedAt` and revokes refresh/session/device rows.

Tokens issued by an older build without a `sessionId` claim can still rely on the process-memory deny-list until their 15-minute expiry. Drain those cookies during deployment (or wait for expiry) before claiming multi-instance revocation parity; newly issued tokens use the persisted check.

## Next verified sequence

1. Configure a reachable TLS Redis endpoint and prove a PING plus shared rate-limit behavior.
2. Provide or create an isolated test inbox, then test registration, verification, recovery, reset, and email-change delivery without using a personal account.
3. Test pending-host, banned, disabled, and deleted behavior against the real schema.
4. Test Google handoff if it remains enabled for launch.
5. Create a migration-baseline plan for staging; never infer migration history from the focused development repair.
6. Fix every failed gate, repeat the affected tests, and append results to this document and the phase evidence before moving on.

## Prohibited shortcuts

- Never paste a secret, database URL, password, token, or payment key into a ticket, screenshot, documentation file, or chat.
- Never test migrations or seed data against production.
- Never grant `ADMIN` or approved `HOST` role through a public signup or profile update.
- Never treat a passing UI render or build as proof of a real email, session, database, or cross-instance security flow.
