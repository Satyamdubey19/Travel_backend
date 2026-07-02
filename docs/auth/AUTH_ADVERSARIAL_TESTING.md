# Auth Adversarial Testing Report

Audit date: 2026-06-12  
Remediation update: 2026-06-14  
Target base URL: `http://localhost:4000`  
Scope: auth endpoints, JWT cookies, NextAuth integration, role behavior, password reset, email verification, CSRF, user enumeration, and race conditions.

This report assumes the tester is a malicious user with normal internet access and no database access unless explicitly stated for setup.

## Remediation Status

The second remediation pass has been applied and verified with `npm run build`.

Fixed or materially reduced:

```text
Public host signup no longer writes User.role=HOST; host signup creates a USER with pending Host profile.
Credential registration no longer auto-signs in unverified users.
Credential login now requires isEmailVerified=true.
Unknown auth payload fields now fail schema validation.
Missing-user login now performs a dummy bcrypt comparison to reduce timing enumeration.
Reset password now consumes the reset token with an atomic conditional update.
No-Origin auth mutations are rejected; Origin or Referer must be trusted.
Google OAuth now requires email_verified=true and rejects missing email_verified.
Middleware now verifies protected page sessions through /api/auth/me, reusing DB/status/revocation checks.
Same-second session invalidation now rejects tokens with iat <= invalidated timestamp.
Redis-backed auth rate limits, email verification-token storage, and refresh-token storage are available when REDIS_URL is configured.
Login now enforces a maximum of 3 active devices and returns DEVICE_LIMIT_REACHED with active devices instead of issuing tokens on a 4th device.
```

Still needs production hardening:

```text
JWT access-token revocation and session invalidation are still process-memory based.
Registration can still reveal account existence through conflict behavior unless changed to a fully generic signup response.
Legacy /api/verify remains and should be removed or delegated.
Stored profile text still needs frontend output-escaping guarantees.
```

## Executive Summary

Current risk level: Medium-High

Major remaining attack paths:

```text
1. Custom JWT revocation/session invalidation is process-memory only.
2. Registration conflict behavior can still expose account existence.
3. GET email verification is a state-changing GET and legacy /api/verify remains.
4. JWT forgery is possible if any JWT/NEXTAUTH secret is weak or leaked.
5. Stored profile text can become XSS if frontend output escaping is missed.
```

## Test Variables

Use these placeholders in Postman or curl:

```text
BASE_URL=http://localhost:4000
ATTACKER_EMAIL=attacker@example.com
ATTACKER_PASSWORD=secret123
VICTIM_EMAIL=victim@example.com
HOST_EMAIL=evil-host@example.com
```

For curl examples, preserve cookies:

```bash
curl -i -c cookies.txt -b cookies.txt ...
```

## Attack Path 1 - Public Host Privilege Escalation

Goal: obtain `HOST` role without admin/KYC approval.

Status: Blocked after remediation.

PoC:

```bash
curl -i -c host-cookies.txt \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/register" \
  -d '{
    "name": "Evil Host",
    "email": "evil-host@example.com",
    "phone": "9000000101",
    "password": "secret123",
    "role": "host",
    "businessName": "Evil Travel Co"
  }'
```

Expected secure behavior:

```text
Account should be USER or pending host until KYC/admin approval.
```

Expected current behavior:

```text
User is created with role USER.
Pending Host record is created.
No login cookie is issued until email verification and login.
Host page middleware does not allow /host routes from this account.
```

Impact:

```text
Attacker can create a pending Host profile, but should not receive HOST access.
Downstream host APIs must still avoid trusting Host row existence alone.
```

Fix:

```text
Keep this behavior and add admin/KYC approval flow for later HOST promotion.
```

## Attack Path 2 - Host Self-Activation From Existing User

Goal: promote an existing normal user to host through `/api/auth/me`.

Status: Mostly blocked after remediation. It creates/updates Host profile but no longer changes `User.role` to `HOST`.

PoC:

```bash
curl -i -b user-cookies.txt \
  -H "Content-Type: application/json" \
  -X PATCH "$BASE_URL/api/auth/me" \
  -d '{
    "businessName": "Escalation Attempt",
    "activateHost": true
  }'
```

Expected secure behavior:

```text
No HOST role should be granted.
```

Expected current behavior:

```text
User.role remains USER.
Host profile may be created/updated.
Response has role USER and isHost false.
```

Residual risk:

```text
If any downstream API checks only for existence of Host row instead of role/approval, this still becomes a privilege path.
```

Fix:

```text
Ensure host APIs require role=HOST and host.isApproved/isActive/KYC policy.
Do not create Host profile from /auth/me unless this is intentional onboarding.
```

## Attack Path 3 - Admin Signup Attempt

Goal: create an admin account through public registration.

Status: Blocked.

PoC:

```bash
curl -i \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/register" \
  -d '{
    "name": "Fake Admin",
    "email": "fake-admin@example.com",
    "phone": "9000000102",
    "password": "secret123",
    "role": "admin"
  }'
```

Expected current result:

```text
role is normalized to USER because register schema only accepts user/host/USER/HOST.
If role validation rejects first, response is 400.
No ADMIN account is created.
```

Fix:

```text
Keep public admin signup blocked.
Add regression test for role=admin, ADMIN, and mixed-case variants.
```

## Attack Path 4 - Admin Escalation Through Profile Update

Goal: change role/provider fields through mass assignment.

Status: Blocked for direct role fields.

PoC:

```bash
curl -i -b user-cookies.txt \
  -H "Content-Type: application/json" \
  -X PATCH "$BASE_URL/api/auth/me" \
  -d '{
    "name": "Attacker",
    "role": "ADMIN",
    "isAdmin": true,
    "provider": "google",
    "providerId": "attacker-controlled",
    "isBanned": false,
    "status": "ACTIVE"
  }'
```

Expected current result:

```text
Unknown fields are ignored by Zod object default behavior.
User.role remains unchanged.
```

Residual risk:

```text
Unknown fields are ignored, not rejected. That is safer than assignment but weaker for auditability.
```

Fix:

```text
Use `.strict()` on update schemas so privilege payloads fail loudly.
```

## Attack Path 5 - JWT Forgery With Algorithm Confusion

Goal: forge token with `role=ADMIN`.

Status: Blocked if JWT secret is strong and not leaked.

PoC token payload attempt:

```json
{
  "id": "attacker-user-id",
  "email": "attacker@example.com",
  "role": "ADMIN",
  "iat": 1760000000,
  "exp": 1999999999
}
```

Unsigned `alg=none` token test:

```bash
curl -i \
  -H "Cookie: token=<alg-none-token>" \
  "$BASE_URL/api/auth/me"
```

Expected current result:

```text
401 Unauthorized.
jsonwebtoken rejects unsigned token.
middleware rejects non-HS256 token.
```

Weak-secret forgery test:

```bash
# Only for local testing if you intentionally set JWT_SECRET=secret.
# Create an HS256 token signed with the weak secret and role ADMIN.
curl -i \
  -H "Cookie: token=<forged-hs256-admin-token>" \
  "$BASE_URL/api/auth/me"
```

Expected secure behavior:

```text
401 unless token is signed with the real strong secret.
```

Critical condition:

```text
If JWT_ACCESS_SECRET/JWT_SECRET/NEXTAUTH_SECRET is weak or leaked, attacker can forge custom JWTs.
```

Fix:

```text
Use at least 32 random bytes for secrets.
Rotate secrets if exposed.
Do not reuse NEXTAUTH_SECRET as custom JWT secret in production.
```

## Attack Path 6 - Logout Token Reuse Against API

Goal: reuse a copied JWT after logout.

Status: Blocked only within the same server process after remediation.

PoC:

```bash
# 1. Login and copy token from Set-Cookie.
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/login" \
  -d '{"email":"attacker@example.com","password":"secret123"}'

# 2. Logout.
curl -i -b cookies.txt -X POST "$BASE_URL/api/auth/logout"

# 3. Replay copied token manually.
curl -i \
  -H "Cookie: token=<copied-token-before-logout>" \
  "$BASE_URL/api/auth/me"
```

Expected current result in same process:

```text
401 Unauthorized because token is in in-memory revoked map.
```

Bypass conditions:

```text
Server restart clears revokedTokens.
Multi-instance deployment sends replay to another instance with empty revokedTokens.
```

Fix:

```text
Move revoked token/session storage to Redis or database.
Use session ids or tokenVersion persisted on User.
```

## Attack Path 7 - Logout Token Reuse Against Frontend Middleware

Goal: access protected frontend pages after logout using a copied custom JWT.

Status: Blocked for API and middleware-protected pages after remediation.

Reason:

```text
middleware now calls /api/auth/me for protected pages, so this replay path should be rejected by the same API-side revocation and account-state checks.
```

PoC:

```bash
curl -i \
  -H "Cookie: token=<copied-token-before-logout>" \
  "$BASE_URL/profile"
```

Expected secure behavior:

```text
Redirect to /login after logout.
```

Expected current behavior:

```text
Middleware calls /api/auth/me and rejects the replayed token when API revocation/status checks reject it.
```

Fix:

```text
Move auth page checks to a shared server-side verifier that checks revocation and DB status.
Or make middleware use NextAuth/session database checks where feasible.
```

## Attack Path 8 - Password Reset Abuse / Email Spam

Goal: spam reset emails or enumerate accounts.

Status: Blocked by Redis-backed rate limiting when REDIS_URL is configured, plus generic success response.

PoC:

```bash
for i in 1 2 3 4 5; do
  curl -i \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/auth/forgot-password" \
    -d '{"email":"victim@example.com"}'
done
```

Expected current result:

```text
First few return 201 generic message.
Later requests return 429. With REDIS_URL configured, this is shared across app instances.
```

Bypass conditions:

```text
Use many IPs.
REDIS_URL missing, causing local process-memory fallback.
```

Fix:

```text
Keep Redis-backed rate limits enabled in production.
Add CAPTCHA or abuse detection after threshold.
Log reset attempts.
```

## Attack Path 9 - Reset Token Race

Goal: use the same reset token twice in parallel.

Status: Blocked after remediation.

Reason:

```text
ResetPassword reads user, validates token, then updates password and clears token.
Two parallel requests can both pass validation before either update commits.
```

PoC:

```bash
# Run these two commands at the same time with the same valid reset token.
curl -i -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/reset-password" \
  -d '{"email":"victim@example.com","token":"RAW_TOKEN","password":"newSecret123"}'

curl -i -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/reset-password" \
  -d '{"email":"victim@example.com","token":"RAW_TOKEN","password":"otherSecret123"}'
```

Expected secure behavior:

```text
Exactly one succeeds; the other fails with Invalid reset token.
```

Expected current behavior:

```text
Exactly one request succeeds because the update is conditional on the current resetToken.
```

Fix:

```text
Use conditional update:
where email + resetToken + resetTokenExpiry > now
or wrap in transaction with row lock where supported.
```

## Attack Path 10 - Verification Bypass Through Login Before Verification

Goal: use account without verifying email.

Status: Blocked after remediation.

PoC:

```bash
curl -i -c unverified.txt \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/register" \
  -d '{
    "name":"Unverified User",
    "email":"unverified@example.com",
    "phone":"9000000103",
    "password":"secret123",
    "role":"user"
  }'

curl -i -c unverified-login.txt \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/login" \
  -d '{"email":"unverified@example.com","password":"secret123"}'
```

Expected secure behavior:

```text
Login blocked until email verification, or sensitive actions blocked for unverified users.
```

Expected current behavior:

```text
Login fails with "Please verify your email before logging in".
```

Fix:

```text
Enforce isEmailVerified for login or introduce per-action verification checks.
```

## Attack Path 11 - Email Verification CSRF / Replay

Goal: trigger state-changing verification via GET.

Status: Token secrecy prevents practical exploitation unless token is leaked, but GET state change is still weak design.

PoC:

```html
<img src="http://localhost:4000/api/auth/verify?email=victim@example.com&token=LEAKED_TOKEN" />
```

Expected current result:

```text
If token is valid, account is verified.
Reusing token after success fails because verificationToken is cleared.
```

Fix:

```text
Use a confirmation page or POST for verification.
Keep token single-use.
Avoid logging raw tokens.
```

## Attack Path 12 - User Enumeration Through Register

Goal: determine whether an email or phone is registered.

Status: Viable.

PoC:

```bash
curl -i \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/register" \
  -d '{
    "name":"Probe",
    "email":"known-user@example.com",
    "phone":"9000000201",
    "password":"secret123",
    "role":"user"
  }'
```

Expected current result:

```json
{
  "error": "Email already exists"
}
```

Phone probe:

```bash
curl -i \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/register" \
  -d '{
    "name":"Probe",
    "email":"new-probe@example.com",
    "phone":"KNOWN_PHONE",
    "password":"secret123",
    "role":"user"
  }'
```

Expected current result:

```json
{
  "error": "Phone already exists"
}
```

Fix:

```text
For high-privacy systems, use generic signup conflict messages and notify account owner separately.
For this app, this may be accepted UX risk.
```

## Attack Path 13 - User Enumeration Through Login Timing

Goal: distinguish valid emails by timing.

Status: Reduced after remediation.

Reason:

```text
Existing users run bcrypt.compare.
Missing users return before bcrypt.
```

PoC:

```bash
time curl -s -o /dev/null \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/login" \
  -d '{"email":"known-user@example.com","password":"wrong-password"}'

time curl -s -o /dev/null \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/login" \
  -d '{"email":"missing-user@example.com","password":"wrong-password"}'
```

Expected secure behavior:

```text
Response body is same and timing difference is minimized.
```

Expected current result:

```text
Both return Incorrect email or password, and missing-user path performs a dummy bcrypt comparison.
Small timing differences may still exist due to database and branching overhead.
```

Fix:

```text
Run bcrypt.compare against a static dummy hash when user is missing.
```

## Attack Path 14 - CSRF Against Mutation Endpoints

Goal: trigger authenticated mutation from another origin.

Status: Mostly blocked after remediation. No-Origin mutation requests are now rejected.

Cross-origin PoC:

```bash
curl -i -b victim-cookies.txt \
  -H "Origin: https://evil.example" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/logout" \
  -d '{}'
```

Expected current result:

```text
403 Invalid request origin
```

No-Origin PoC:

```bash
curl -i -b victim-cookies.txt \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/auth/logout" \
  -d '{}'
```

Expected current result:

```text
403 Invalid request origin
```

Risk:

```text
Most browser cross-site POSTs include Origin, but Origin is not a full CSRF token strategy.
Same-site subdomain compromise remains a concern if allowed origins are broad.
```

Fix:

```text
Add CSRF tokens for cookie-auth mutations.
Require Origin for browser mutation endpoints if API clients are not needed.
```

## Attack Path 15 - Rate Limit Bypass

Goal: bypass brute-force protection.

Status: Blocked for Redis-enabled deployments. Viable only if REDIS_URL is missing and the app falls back to process-memory limits.

PoC:

```bash
for i in $(seq 1 10); do
  curl -i \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/auth/login" \
    -d '{"email":"victim@example.com","password":"guess'$i'"}'
done
```

Expected current single-process result:

```text
429 after configured threshold. With REDIS_URL configured, counters are shared through Redis.
```

Bypass:

```text
Rotate IP addresses.
Run without REDIS_URL, then restart or route across multiple instances.
```

Fix:

```text
Keep Redis/database rate limiter keyed by email, IP, subnet, and user-agent/device fingerprint.
```

## Attack Path 16 - Session Invalidation Same-Second Edge

Goal: keep a token alive after password reset due to timestamp comparison edge.

Status: Blocked after remediation.

Reason:

```text
isUserSessionInvalidated returns issuedAt < invalidatedAfter.
If token iat and invalidatedAfter are the same second, token may remain valid.
```

PoC:

```text
1. Login.
2. Immediately reset password in the same second.
3. Replay old token against /api/auth/me.
```

Expected secure behavior:

```text
Old token rejected.
```

Expected current behavior:

```text
Old token is rejected when iat <= invalidatedAfter.
```

Fix:

```text
Use issuedAt <= invalidatedAfter or store millisecond precision sessionVersion in DB.
```

## Attack Path 17 - NextAuth Stale Token Role In Middleware

Goal: keep page access after role/account status changes.

Status: Reduced after remediation.

Reason:

```text
middleware.ts trusts custom JWT/NextAuth token claims.
It does not query DB for current account status, role changes, host approval, or revocation.
```

PoC:

```text
1. Login as HOST.
2. Admin demotes/suspends user in DB.
3. Reuse old token to request /host.
```

Request:

```bash
curl -i \
  -H "Cookie: token=<old-host-token>" \
  "$BASE_URL/host"
```

Expected secure behavior:

```text
Redirect to login or forbidden.
```

Expected current behavior:

```text
Middleware calls /api/auth/me and should reject stale or inactive DB users.
```

Fix:

```text
Add DB-backed session version checks to middleware, or avoid role authorization in middleware and enforce it in server components/API.
```

## Attack Path 18 - OAuth Existing Account Takeover Checks

Goal: use OAuth to access an existing credentials account.

Status: Blocked for unverified or missing email verification claim after remediation.

PoC:

```text
1. Create credentials account victim@example.com.
2. Attempt Google OAuth login with same email.
```

Expected current behavior:

```text
If Google returns email_verified=true, account is treated as same user and isEmailVerified becomes true.
If email_verified=false or the claim is missing, sign-in is rejected.
```

Fix:

```text
For Google, require verified email explicitly. If the claim is absent, reject instead of accepting.
```

## Attack Path 19 - Legacy Verification Endpoint Confusion

Goal: use legacy `/api/verify` to verify incorrectly or confuse clients.

Status: Broken/legacy path remains.

PoC:

```bash
curl -i "$BASE_URL/api/verify?token=RAW_TOKEN_FROM_CURRENT_EMAIL"
```

Expected current result:

```text
Likely fails because current verification stores hashed token and requires email on /api/auth/verify.
```

Risk:

```text
Users, QA, or old clients may call the wrong endpoint and fail verification.
```

Fix:

```text
Remove /api/verify or make it redirect/delegate to the current hashed-token flow.
```

## Attack Path 20 - Malicious Profile Content / Stored XSS Probe

Goal: store script/HTML payload in profile fields.

Status: Input can still contain HTML in allowed text fields, but length-limited.

PoC:

```bash
curl -i -b user-cookies.txt \
  -H "Content-Type: application/json" \
  -X PATCH "$BASE_URL/api/auth/me" \
  -d '{
    "bio": "<img src=x onerror=alert(document.cookie)>",
    "instagram": "<script>alert(1)</script>"
  }'
```

Expected secure behavior:

```text
Either reject HTML where not needed, or store as plain text and escape everywhere on render.
```

Expected current behavior:

```text
Payload may be stored in UserProfile preferences/text fields.
```

Fix:

```text
Escape output in all frontend renders.
Optionally reject angle brackets for fields that should be handles/names only.
```

## Priority Fix List

Critical/High:

```text
1. Move JWT access-token revocation/session invalidation to Redis/database or User.sessionVersion.
2. Remove or delegate legacy /api/verify.
3. Add automated regression tests for host onboarding, middleware auth, and reset-token races.
```

Medium:

```text
1. Consider full CSRF tokens in addition to Origin/Referer checks.
2. Convert signup duplicate email/phone responses to generic responses if enumeration risk is unacceptable.
3. Add security audit logging for auth events.
4. Guarantee frontend escaping for all profile text fields.
```

Low:

```text
1. Decide whether register duplicate email/phone enumeration is acceptable UX.
2. Add security event audit logs.
3. Add CAPTCHA after abuse thresholds.
```

## Suggested Automated Adversarial Tests

Add integration tests for:

```text
public host signup does not grant HOST until approval
PATCH /api/auth/me activateHost does not grant HOST
role=ADMIN payload cannot change role
alg=none JWT is rejected
forged HS256 with wrong secret is rejected
replayed token after logout is rejected by /api/auth/me
replayed token after logout is rejected by middleware-protected page
forgot-password rate limit is enforced
login timing for missing and existing users is padded
two parallel reset requests: exactly one succeeds
unverified account cannot login if policy is changed
GET /api/auth/verify token is single-use
cross-origin Origin header is rejected
no-Origin mutation behavior matches final CSRF policy
stale HOST token fails after user role/status change
Google profile without email_verified is rejected
legacy /api/verify does not mislead clients
4th active device login does not create token/session/refresh token
replace-device cannot logout another user's device
replace-device deactivates selected device and logs in current device
```

## Final Assessment

The auth module is stronger after remediation. Direct host/admin privilege escalation, unverified login, reset-token replay, stale middleware token access, and no-Origin mutation attempts are now blocked by the current implementation. Redis now covers rate limits, email verification-token storage, and refresh-token state when REDIS_URL is configured. The remaining operational weakness is JWT access-token revocation/session invalidation, which is still process-memory based and should be persisted before multi-instance production use.
