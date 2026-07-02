# Auth Documentation Index

All backend auth documentation lives in this folder.

## Files

```text
AUTH_MODULE.md
  Current auth architecture, endpoint behavior, cookies, JWT, NextAuth, and frontend flow.

AUTH_API_POSTMAN.md
  Postman testing guide with request bodies, expected responses, cookies, and troubleshooting.

AUTH_QA_SECURITY_AUDIT.md
  Current QA/security audit status, fixed findings, remaining risks, and test matrix.

AUTH_ADVERSARIAL_TESTING.md
  Adversarial attack-path report with proof-of-concept requests and mitigation status.
```

## Current Auth Rules

```text
Registration does not log the user in.
Credential login requires email verification.
Credential login creates a 7-day httpOnly access cookie named token and a 30-day httpOnly refresh cookie named refreshToken.
Credential login also creates/updates an httpOnly deviceId cookie.
A user can have at most 3 active devices.
The 4th device receives DEVICE_LIMIT_REACHED and must call /api/auth/login/replace-device after choosing a device to logout.
Refresh tokens, password-reset tokens, and email verification tokens are stored only as SHA-256 hashes.
Refresh-token hashes and email verification-token hashes use Redis when REDIS_URL is configured, with database fallback where implemented.
Login attempts are persisted and repeated failures lock the account temporarily.
Public host signup creates a USER plus pending Host profile, not HOST role.
PATCH /api/auth/me with activateHost=true does not grant HOST role.
Auth mutations require trusted Origin or Referer.
Login, register, reset, forgot-password, verify, update, and logout use Redis-backed rate limits when REDIS_URL is configured.
Logout revokes the current access token in memory and deletes the matching refresh token from Redis.
Logout and device logout mark UserDevice/Session rows inactive.
Password reset deletes all Redis refresh tokens and deactivates all sessions/devices for the user.
JWT access-token revocation remains in-memory; Redis currently covers rate limits, email verification tokens, and refresh-token state.
```

Start with `AUTH_MODULE.md` for architecture and `AUTH_API_POSTMAN.md` for manual testing.
