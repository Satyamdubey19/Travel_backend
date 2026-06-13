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
Refresh tokens and password-reset tokens are stored only as SHA-256 hashes.
Login attempts are persisted and repeated failures lock the account temporarily.
Public host signup creates a USER plus pending Host profile, not HOST role.
PATCH /api/auth/me with activateHost=true does not grant HOST role.
Auth mutations require trusted Origin or Referer.
Login, register, reset, forgot-password, verify, update, and logout have in-memory rate limits.
Logout revokes the current access token in memory and revokes the matching refresh token in the database.
Password reset revokes all refresh tokens and deactivates active sessions for the user.
JWT access-token revocation remains in-memory and must move to Redis/database for multi-instance production.
```

Start with `AUTH_MODULE.md` for architecture and `AUTH_API_POSTMAN.md` for manual testing.
