# Auth Module QA & Security Audit Report

Audit date: 2026-06-12  
Last updated: 2026-06-14  
Current implementation status: Remediated with remaining production-hardening items.

## Scope

Audited endpoints:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PATCH /api/auth/me
POST /api/auth/logout
GET  /api/auth/verify
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/google-login
GET/POST /api/auth/[...nextauth]
```

Supporting files:

```text
modules/auth/controllers/auth.controller.ts
modules/auth/services/auth.service.ts
modules/auth/services/auth-security.service.ts
lib/auth.ts
middleware.ts
prisma/schema.prisma
```

## Executive Summary

Current production risk level: Medium

The highest-risk auth findings from the first audit have been remediated in code:

```text
Account-state checks are enforced.
Public host signup no longer grants HOST role.
Self-service host activation no longer grants HOST role.
Credential registration no longer auto-signs in users.
Credential login requires verified email.
Auth mutation endpoints have trusted Origin/Referer checks.
Auth endpoints use Redis-backed rate limiting when REDIS_URL is configured.
Login enforces a maximum of 3 active devices per user.
Reset password requires a valid password and consumes tokens atomically.
Logout revokes the current JWT in process memory.
Logout deletes the matching Redis refresh token when REDIS_URL is configured.
Logout marks the current UserDevice and Session rows inactive.
Password reset invalidates existing sessions in process memory.
Password reset deletes all Redis refresh tokens when REDIS_URL is configured.
Password reset marks all user devices inactive.
Middleware-protected pages verify auth through /api/auth/me.
Google OAuth requires email_verified=true.
Strict Zod schemas reject unknown auth payload fields.
```

Remaining production-hardening risks:

```text
JWT access-token revocation and session invalidation are still process-memory based. Move those to Redis/database or a persisted session version before multi-instance deployment.
Registration conflict responses still disclose whether an email or phone exists.
Legacy /api/verify remains and can confuse QA or old clients.
Profile text accepts HTML-like values, so frontend output escaping must be guaranteed.
Full automated Jest/Supertest coverage is still missing.
```

Verification performed:

```bash
npm run build
```

Result:

```text
Passed
```

## Current Auth Architecture

```text
Register
  -> validate strict schema
  -> Redis-backed rate limit when REDIS_URL is configured
  -> trusted Origin/Referer check
  -> create USER account
  -> store hashed email verification token in Redis when REDIS_URL is configured
  -> if host signup requested, create pending Host profile
  -> send verification email
  -> no auth cookie is issued

Verify Email
  -> check raw token against Redis SHA-256 token hash first
  -> fall back to database verification fields for older links
  -> clear verification token
  -> set isEmailVerified=true

Login
  -> validate strict schema
  -> Redis-backed rate limit when REDIS_URL is configured
  -> trusted Origin/Referer check
  -> dummy bcrypt compare for missing users
  -> require active usable account
  -> require isEmailVerified=true
  -> bcrypt password check
  -> role check if requested
  -> enforce maximum 3 active UserDevice rows
  -> return DEVICE_LIMIT_REACHED with active devices on fourth device
  -> create Session/UserDevice/RefreshToken rows on success
  -> set httpOnly JWT cookie
  -> store hashed refresh-token metadata in Redis when REDIS_URL is configured

Device Management
  -> GET /api/auth/devices lists active devices
  -> POST /api/auth/devices/logout logs out a selected owned device
  -> POST /api/auth/login/replace-device validates credentials, removes selected device, and logs in current device

Current User
  -> verify custom JWT and revocation state
  -> load DB user and account state
  -> fallback to NextAuth only when DB user exists

Update Profile / Host Intent
  -> validate strict schema
  -> trusted Origin/Referer check
  -> rate limit
  -> update profile fields
  -> activateHost=true creates/updates pending Host profile only
  -> does not grant HOST role

Reset Password
  -> validate strict schema
  -> trusted Origin/Referer check
  -> rate limit
  -> verify token hash and expiry
  -> atomic conditional update clears token and changes password
  -> invalidate sessions in process memory

Middleware
  -> checks token presence
  -> calls /api/auth/me for DB/status/revocation-backed verification
  -> gates /admin and /host pages based on verified response
```

## Findings Status Table

| ID | Previous Issue | Status | Current Behavior | Remaining Work |
|---|---|---|---|---|
| AUTH-001 | Inactive/banned/deleted users could authenticate | Fixed | Auth lookups enforce usable account state | Add automated regression tests |
| AUTH-002 | Self-service `activateHost` granted HOST | Fixed | It creates/updates pending Host profile only | Ensure host APIs require role/approval |
| AUTH-003 | No auth rate limiting | Fixed for Redis-enabled deployments | Redis-backed limits with memory fallback | Add integration tests and production Redis monitoring |
| AUTH-004 | Reset accepted weak/missing password | Fixed | Strict schema requires valid password | Add password complexity if required |
| AUTH-005 | Logout did not revoke current JWT | Partially fixed | In-memory token revocation exists | Persist revocation/session version |
| AUTH-006 | Duplicate phone leaked raw Prisma errors | Fixed | Duplicate email/phone messages are mapped safely | Decide whether conflict enumeration is acceptable |
| AUTH-007 | Weak validation and length limits | Fixed | Strict Zod schemas and limits exist | Add field-specific sanitization where needed |
| AUTH-008 | Invalid date reached Prisma | Fixed | dateOfBirth is validated | Add age/business rules if needed |
| AUTH-009 | CSRF risk on cookie mutations | Partially fixed | Trusted Origin/Referer required | Add full CSRF token strategy if browser-only |
| AUTH-010 | Email verification not required for login | Fixed | Login requires `isEmailVerified=true` | Ensure frontend handles this state |
| AUTH-011 | Google email verification not enforced | Fixed | Missing/false `email_verified` is rejected | Keep provider-specific tests |
| AUTH-012 | `/me` trusted stale NextAuth payload | Fixed | Missing DB user returns 401 | Add regression test |
| AUTH-013 | Invalid credentials returned 400 | Fixed | Wrong password returns 401 | Keep consistent error contract |
| AUTH-014 | Cookie maxAge missing | Fixed | Cookie maxAge matches 7-day JWT | None |
| AUTH-015 | Legacy `/api/verify` remains | Open | Legacy endpoint still exists | Remove or delegate |
| AUTH-016 | Empty duplicate `src/modules/auth/*` files | Open | Files still exist but inactive | Remove or document as unused |

## Current Test Matrix

Registration:

```text
valid user registration returns 201 and no token cookie
valid host signup returns role USER, isHost false, businessName populated
registration with role admin is rejected
duplicate email returns conflict-style safe error
duplicate phone returns conflict-style safe error
invalid email/phone/password are rejected
unknown fields are rejected
rapid registration is rate limited with Redis when REDIS_URL is configured
```

Email verification:

```text
valid token verifies email
wrong token fails
expired token fails
reused token fails
legacy /api/verify is not used
```

Login:

```text
unverified user cannot login
verified user can login
wrong password returns 401
missing user returns same error and dummy bcrypt path runs
banned/deleted/inactive user cannot login
USER cannot login with type HOST
HOST requires actual HOST role
ADMIN requires ADMIN role
rapid login attempts are rate limited with Redis when REDIS_URL is configured
4th active device login returns DEVICE_LIMIT_REACHED and no cookies
replace-device rejects devices not owned by the user
replace-device succeeds after selecting an owned active device
```

Profile and host intent:

```text
valid profile update succeeds
unknown fields are rejected
duplicate email/phone rejected
invalid date/URL rejected
activateHost=true creates pending Host but keeps role USER
```

Session:

```text
GET /api/auth/me works after login
GET /api/auth/me fails after logout with the same token in the same process
logout marks current device inactive
selected device logout marks only that owned device inactive
password reset invalidates prior token in the same process
middleware-protected page rejects stale/revoked token via /api/auth/me
```

Password reset:

```text
forgot password returns generic response
forgot password is rate limited with Redis when REDIS_URL is configured
reset requires valid token and password
reset token is atomically single-use
old sessions are invalidated in process memory
```

OAuth:

```text
Google login without session redirects to login
Google profile with email_verified=false is rejected
Google profile missing email_verified is rejected
Google profile with verified email creates/updates account
```

## Production Recommendations

Immediate:

```text
Keep REDIS_URL configured in production and monitor Redis rate-limit/auth-token keys.
Move JWT access-token revocation/session invalidation to Redis/database or User.sessionVersion.
Remove or delegate legacy /api/verify.
Add integration tests for the current matrix.
```

Short term:

```text
Convert duplicate registration responses to a generic response if account enumeration is unacceptable.
Add security audit logs for login, logout, reset, verify, host intent, and rate-limit events.
Add frontend handling for "verify email before login".
Review every host API to require role HOST plus approval/KYC where business rules require it.
```

Long term:

```text
Add MFA for ADMIN and HOST.
Add device/session management.
Add CAPTCHA or adaptive abuse controls after repeated auth abuse.
Remove inactive duplicate auth files under src/modules/auth or mark them clearly as inactive.
```

## Final Assessment

The auth module is now substantially safer than the original audited version. Redis-backed rate limits, email verification token storage, and refresh-token storage are available when REDIS_URL is configured. The remaining production risk is JWT access-token revocation/session invalidation, which is still process-memory based and should move to Redis/database or a persisted session version before multi-instance deployment.
