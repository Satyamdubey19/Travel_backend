# Auth Module Documentation

This document explains the active authentication APIs, how auth works internally, how the frontend uses it, and which database fields are involved.

## Source Files

```text
app/api/auth/*                         API route handlers
modules/auth/controllers/auth.controller.ts
modules/auth/services/auth.service.ts
modules/auth/types/auth.ts
lib/auth.ts                            NextAuth config
lib/rate-limit.ts                      Redis-backed rate limiter with memory fallback
lib/redis.ts                           shared lazy Redis client
lib/hash.ts                            secure random token + SHA-256 hash
lib/mail.ts                            verification, login, reset emails
services/redis.service.ts              Redis auth state helpers
prisma/schema.prisma                   User, Host, UserProfile models
```

Important note: `src/modules/auth/*` exists but is currently empty. The active auth implementation is under `app/api/auth`, `modules/auth`, `controllers`, and `services`.

## Auth Concepts

The app supports two auth systems working together:

```text
Custom auth
  -> email/password register and login
  -> bcrypt password hashing
  -> JWT session token stored in httpOnly cookie named token
  -> raw refresh token stored in httpOnly cookie named refreshToken
  -> hashed refresh token metadata stored in Redis when REDIS_URL is configured
  -> RefreshToken, Session, UserDevice, LoginAttempt, and SecurityEvent rows for auth state/audit
  -> maximum 3 active devices per user

NextAuth
  -> credentials provider support
  -> Google OAuth support
  -> JWT session strategy
  -> session is also checked by /api/auth/me
```

The custom session cookie is preferred by most app code. If it is missing or invalid, `/api/auth/me` falls back to NextAuth session data.

## Cookie And Token Rules

Custom login creates a JWT with this payload:

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "role": "USER"
}
```

Token details:

```text
Cookie name: token
Cookie options: httpOnly, sameSite=lax, path=/, maxAge=7 days
Secure flag: true only in production
JWT expiry: 7 days
JWT secret priority: JWT_ACCESS_SECRET -> JWT_SECRET -> NEXTAUTH_SECRET
```

Credential login also creates a raw refresh token for the browser and stores only its SHA-256 hash server-side.

```text
Cookie name: refreshToken
Cookie options: httpOnly, sameSite=lax, path=/, maxAge=30 days
Redis key: gethotels:auth:refresh:<tokenHash>
Redis user index: gethotels:auth:refresh:user:<userId>
Stored metadata: userId, deviceId, deviceName, ipAddress, userAgent, createdAt
TTL: 30 days
Database row: RefreshToken.tokenHash, deviceId, deviceName, ipAddress, userAgent, isRevoked, expiresAt
Logout and password reset delete matching Redis refresh-token keys and revoke database rows.
```

Device identity is tracked in an httpOnly `deviceId` cookie. The server chooses device id in this order:

```text
1. X-Device-Id header
2. deviceId cookie
3. generated UUID
```

Because the cookie is `httpOnly`, frontend JavaScript cannot read the JWT directly. The frontend checks the session by calling `GET /api/auth/me`.

## User Response Shape

Most auth endpoints return this user shape:

```json
{
  "user": {
    "id": "uuid",
    "name": "User Name",
    "email": "user@example.com",
    "phone": "9999999999",
    "businessName": "Travel Co",
    "role": "USER",
    "isHost": false,
    "isHostApproved": false,
    "provider": "credentials"
  }
}
```

Roles:

```text
USER
HOST
ADMIN
```

Signup accepts user and host intent only. Public host signup creates a `USER` account plus a pending `Host` profile; it does not grant `HOST` role. Admin accounts cannot be created from public signup.

## Complete Auth API List

### 1. Register

```text
POST /api/auth/register
```

Creates a user account, hashes the password, sends an email verification link, and creates a pending host profile when requested. Registration does not sign the user in; the user must verify email before login.

Request for normal user:

```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9999999999",
  "password": "secret123",
  "role": "user"
}
```

Request for host:

```json
{
  "name": "Rahul Sharma",
  "email": "host@example.com",
  "phone": "9999999999",
  "password": "secret123",
  "role": "host",
  "businessName": "Rahul Travels"
}
```

Success `201`:

```json
{
  "user": {},
  "message": "Registration successful. Please verify your email before logging in."
}
```

Validation and errors:

```text
Name is required
Valid email is required
Password must be at least 6 characters
Business name is required for host signup
Email already exists
Admin accounts cannot be created from signup
```

Internal flow:

```text
request body
  -> normalize email and role
  -> validate signup input
  -> reject duplicate email
  -> bcrypt.hash(password, 12)
  -> generate raw verification token
  -> store SHA-256 hashed verification token in Redis
  -> fall back to User.verificationToken when Redis is not configured
  -> set verification expiry to 24 hours
  -> create User with role USER
  -> create pending Host profile if signup requested host
  -> email raw verification token link
  -> return sanitized user
```

### 2. Login

```text
POST /api/auth/login
```

Authenticates by email and password, requires an active and verified account, optionally checks a requested role, sends a login alert email, sets the `token` cookie, and sets a hashed-refresh-token backed `refreshToken` cookie.
Login enforces a maximum of 3 active devices per user.

Request:

```json
{
  "email": "rahul@example.com",
  "password": "secret123"
}
```

Request with role check:

```json
{
  "email": "host@example.com",
  "password": "secret123",
  "type": "HOST"
}
```

Success `200`:

```json
{
  "user": {}
}
```

Errors:

```text
Incorrect email or password
This account does not have host access
This account does not have admin access
Please verify your email before logging in
Account is temporarily locked. Try again later.
JWT secret is not configured
DEVICE_LIMIT_REACHED
```

Device limit response `409`:

```json
{
  "error": "DEVICE_LIMIT_REACHED",
  "message": "Maximum device limit reached",
  "devices": [
    {
      "id": "device-id",
      "deviceId": "device-id",
      "deviceName": "Chrome Windows",
      "browser": "Chrome",
      "os": "Windows",
      "ipAddress": "127.0.0.1",
      "lastSeenAt": "2026-06-14T10:00:00.000Z",
      "isCurrent": false
    }
  ]
}
```

Internal flow:

```text
normalize email
  -> find User by email
  -> require password field
  -> reject inactive, banned, deleted, or non-ACTIVE users
  -> reject active lockouts
  -> reject unverified email
  -> bcrypt.compare(password, stored hash)
  -> record failed attempt and apply lockout thresholds on bad password
  -> build auth user with Host info
  -> check requested role if type is provided
  -> reset failedLoginAttempts and lockedUntil
  -> resolve current device id/name/browser/os/ip/user-agent
  -> if current device is active, update it and allow login
  -> if fewer than 3 active devices exist, create UserDevice and Session
  -> if 3 other active devices exist, return 409 and do not create token/session
  -> create LoginAttempt and SecurityEvent rows
  -> create Session row
  -> create raw refresh token and store tokenHash metadata in Redis
  -> store RefreshToken row
  -> store Redis active-device key auth:device:{userId}:{deviceId}
  -> send login email
  -> create JWT
  -> set httpOnly token, refreshToken, and deviceId cookies
  -> return user
```

Role check behavior:

```text
type=HOST  -> user must have host capability
type=USER  -> any non-admin account is allowed
type=ADMIN -> user role must be ADMIN
```

### 3. Current User

```text
GET /api/auth/me
```

Returns the current authenticated user.

Auth source order:

```text
1. Custom token cookie
2. NextAuth session
```

Success `200`:

```json
{
  "user": {}
}
```

Unauthorized `401`:

```json
{
  "error": "Unauthorized"
}
```

Internal flow:

```text
read cookie token
  -> verify JWT
  -> load User by token id
  -> return sanitized user
  -> if cookie fails, read NextAuth server session
  -> load DB user by session user id when possible
  -> return user or 401
```

### 4. Device Sessions

```text
GET /api/auth/devices
```

Returns active devices for the current user.

Success `200`:

```json
[
  {
    "id": "device-id",
    "deviceId": "device-id",
    "deviceName": "Chrome Windows",
    "browser": "Chrome",
    "os": "Windows",
    "ipAddress": "127.0.0.1",
    "lastSeenAt": "2026-06-14T10:00:00.000Z",
    "isCurrent": true
  }
]
```

```text
POST /api/auth/devices/logout
```

Logs out a selected active device that belongs to the current user.

Request:

```json
{
  "deviceId": "device-id"
}
```

Internal flow:

```text
authenticate current user
  -> verify selected device belongs to user and isActive=true
  -> revoke matching RefreshToken row
  -> delete Redis refresh-token and auth:device keys
  -> deactivate Session rows for device
  -> mark UserDevice inactive
  -> record DEVICE_FORCE_LOGOUT
```

```text
POST /api/auth/login/replace-device
```

Used after normal login returns `DEVICE_LIMIT_REACHED`.

Request:

```json
{
  "email": "rahul@example.com",
  "password": "secret123",
  "deviceToLogout": "device-id"
}
```

Internal flow:

```text
validate credentials
  -> verify deviceToLogout belongs to that user and is active
  -> logout selected device
  -> create current device session
  -> issue token, refreshToken, and deviceId cookies
  -> record DEVICE_REPLACED, DEVICE_LOGIN, and LOGIN_SUCCESS
```

### 5. Update Current User / Become Host

```text
PATCH /api/auth/me
```

Updates the authenticated user's profile fields. It can also create or update a pending host profile by sending `activateHost: true`, but it does not grant `HOST` role.

Request:

```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9999999999",
  "location": "Jaipur",
  "bio": "Frequent traveler",
  "dateOfBirth": "1995-01-20",
  "gender": "MALE",
  "nationality": "Indian",
  "address": "Jaipur, Rajasthan",
  "emergencyContactName": "Amit",
  "emergencyContactPhone": "8888888888",
  "website": "https://example.com",
  "instagram": "rahul",
  "twitter": "rahul",
  "travelStyle": "Adventure",
  "preferredCurrency": "INR",
  "preferredLanguage": "English",
  "dietaryPreferences": "Veg",
  "passportNumber": "P1234567",
  "frequentFlyerNumber": "FF123"
}
```

Become host request:

```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9999999999",
  "businessName": "Rahul Travels",
  "activateHost": true
}
```

Success `200`:

```json
{
  "user": {}
}
```

Errors:

```text
Unauthorized
Invalid session user
User not found
Email is already in use
```

Internal flow:

```text
read NextAuth session user id
  -> fallback to custom token cookie
  -> validate user exists
  -> normalize and check email uniqueness
  -> update User name/email/phone
  -> if activateHost=true, upsert Host profile
  -> upsert UserProfile with profile/preferences data
  -> if host intent was submitted, refresh token cookie and delete NextAuth session cookie
  -> return sanitized user
```

When `activateHost` is true, the user role remains unchanged. A `Host` row is created or updated as a pending host profile. Admin/KYC approval must promote or enable host access separately.

### 6. Logout

```text
POST /api/auth/logout
```

Deletes the custom `token` cookie.
It also deletes the matching Redis refresh-token entry, revokes the database `RefreshToken` row, deactivates `Session` rows for the current device, and marks the current `UserDevice` inactive.

Success `200`:

```json
{
  "message": "Logged out"
}
```

Frontend also calls NextAuth `signOut({ redirect: false })` to clear any NextAuth session.

### 7. Verify Email

```text
GET /api/auth/verify?email=user@example.com&token=raw-token
```

Verifies the signup email.

Success `200`:

```json
{
  "user": {},
  "message": "Email verified successfully"
}
```

Errors:

```text
Invalid verification link
Verification link has expired
```

Internal flow:

```text
read email and token from query
  -> normalize email
  -> find User
  -> SHA-256 hash query token
  -> compare with Redis verification token first
  -> fall back to User.verificationToken and verificationExpiry for older links
  -> set isEmailVerified=true
  -> clear verificationToken and verificationExpiry
  -> delete Redis verification token
  -> mark matching Host rows isVerified=true
  -> return user
```

### 8. Forgot Password

```text
POST /api/auth/forgot-password
```

Creates a password reset token and sends a reset link when the email exists. The response is intentionally the same whether or not the email exists.

Request:

```json
{
  "email": "rahul@example.com"
}
```

Success `201`:

```json
{
  "message": "If that email exists, a reset link has been sent."
}
```

Internal flow:

```text
normalize email
  -> find User by email
  -> if not found, return generic success
  -> generate raw reset token
  -> store SHA-256 hashed reset token
  -> set reset expiry to 1 hour
  -> email reset link:
     NEXTAUTH_URL/reset-password?email=...&token=...
```

### 9. Reset Password

```text
POST /api/auth/reset-password
```

Validates the password reset token and updates the password.

Request:

```json
{
  "email": "rahul@example.com",
  "token": "raw-token-from-email",
  "password": "newSecret123"
}
```

Success `200`:

```json
{
  "message": "Password reset successful"
}
```

Errors:

```text
Invalid reset token
Reset token has expired
```

Internal flow:

```text
normalize email
  -> find User
  -> find unused PasswordResetToken by SHA-256 token hash
  -> reject expired or already-used token
  -> bcrypt.hash(new password, 12)
  -> mark token used
  -> update password and clear legacy reset fields
  -> delete all user refresh tokens from Redis
  -> revoke RefreshToken rows
  -> deactivate sessions
  -> mark all UserDevice rows inactive
  -> invalidate in-memory JWT sessions
```

### 10. Google Login Bridge

```text
GET /api/auth/google-login
```

This route expects a valid NextAuth Google session. It creates or updates the matching DB user, creates the custom JWT cookie, then redirects to the app home URL.
It also creates the same refresh-token and device session used by credential login, so the 3-device limit applies to Google login too.

Success behavior:

```text
valid NextAuth session
  -> handleGoogleAuth()
  -> resolve current device
  -> enforce max 3 active devices
  -> set custom token, refreshToken, and deviceId cookies
  -> redirect to NEXTAUTH_URL or http://localhost:3000
```

Failure behavior:

```text
missing Google session/email
  -> redirect to /login
device limit reached
  -> redirect to /login?error=DEVICE_LIMIT_REACHED
```

The frontend starts this flow with:

```ts
signIn("google", { callbackUrl: "/api/auth/google-login" })
```

### 11. NextAuth Catch-All

```text
GET  /api/auth/[...nextauth]
POST /api/auth/[...nextauth]
```

Handled by `NextAuth(authOptions)`.

Configured providers:

```text
Credentials
Google
```

Session config:

```text
strategy: jwt
maxAge: 7 days
signIn page: /login
```

Credentials provider calls the same auth service:

```text
authorizeCredentials()
  -> LoginUser()
  -> bcrypt password check
  -> role check
  -> return sanitized user to NextAuth
```

Google provider calls:

```text
handleGoogleAuth()
  -> require Google profile email_verified=true
  -> create User if missing
  -> update provider/providerId when needed
  -> set isEmailVerified=true
  -> send signup/login email
```

## Legacy Alias Routes

These routes still exist:

```text
POST /api/forgot-password
POST /api/reset-password
GET  /api/verify?token=...
```

`/api/forgot-password` and `/api/reset-password` call the same controller as the `/api/auth/*` versions.

`/api/verify` is legacy and should not be used for the current email verification flow. The current signup stores a hashed verification token in Redis when configured and expects `/api/auth/verify?email=...&token=...`.

## Frontend Auth Flow

Frontend files:

```text
Travels_frontend/contexts/AuthContext.tsx
Travels_frontend/components/auth/LoginForm.tsx
Travels_frontend/components/auth/SignupForm.tsx
Travels_frontend/components/auth/HostSignupForm.tsx
Travels_frontend/lib/axios.ts
```

Axios is configured as:

```ts
baseURL: "/api"
withCredentials: true
```

### Session Hydration

```text
app loads
  -> AuthContext reads localStorage.user
  -> temporary user is shown if present
  -> GET /api/auth/me
  -> backend user replaces local user
  -> if backend unavailable and local user exists, keep local user
  -> if no local user and API fails, user=null
```

### Frontend Login

```text
LoginForm
  -> login(email, password, expectedRole?)
  -> POST /api/auth/login
  -> backend sets httpOnly token cookie
  -> response user is normalized
  -> localStorage.user is updated
  -> redirect:
       ADMIN -> /admin
       HOST  -> /host
       USER  -> /
```

### Frontend Signup

```text
SignupForm / HostSignupForm
  -> POST /api/auth/register
  -> backend creates account and sends verification email
  -> user verifies email
  -> user logs in to receive auth cookie
```

### Frontend Become Host

```text
HostSignupForm for logged-in user
  -> PATCH /api/auth/me with activateHost=true
  -> backend creates or updates pending Host profile
  -> frontend should not treat the user as HOST until backend returns role HOST
```

### Frontend Logout

```text
logout()
  -> remove localStorage.user
  -> POST /api/auth/logout
  -> next-auth signOut({ redirect: false })
```

Development fallback:

```text
AuthContext contains browser localStorage fallback accounts.
This is only a local/demo fallback when the API is unavailable.
It must not be treated as secure production authentication.
```

## Database Fields Used

### User

```text
id
name
email
password
phone
role
status
isEmailVerified
emailVerifiedAt
isPhoneVerified
phoneVerifiedAt
failedLoginAttempts
lockedUntil
verificationToken
verificationExpiry
resetToken
resetTokenExpiry
provider
providerId
lastLoginAt
isActive
isBanned
```

### Auth State And Audit Tables

```text
RefreshToken       hashed refresh-token audit/fallback rows with device metadata
Session            active browser/device sessions and last-seen metadata
PasswordResetToken one-time hashed reset tokens with expiry and usedAt
LoginAttempt       successful/failed login attempts by email and IP
OtpVerification    database OTP model reserved for register/login/reset/email/phone flows
UserDevice         known device IDs per user
EmailChangeRequest pending verified email changes
SecurityEvent      login, reset, lockout, and registration audit events
```

### Device Session Fields

```text
Session.deviceId
Session.deviceName
Session.deviceType
Session.ipAddress
Session.userAgent
Session.lastSeenAt
Session.isActive

UserDevice.deviceId
UserDevice.deviceName
UserDevice.browser
UserDevice.os
UserDevice.ipAddress
UserDevice.userAgent
UserDevice.lastSeenAt
UserDevice.isCurrent
UserDevice.isActive
UserDevice.refreshTokenHash
```

### Host

```text
id
userId
businessName
contactEmail
supportPhone
isVerified
isApproved
isActive
kycStatus
```

### UserProfile

```text
id
userId
bio
dateOfBirth
gender
address
city
preferences
```

## Security Behavior

```text
Passwords are hashed with bcrypt, 12 rounds.
Verification and reset tokens are generated with crypto.randomBytes(32).
Only hashed tokens are stored in the database.
Session JWT is stored in an httpOnly cookie.
Refresh token hashes and email verification token hashes are stored in Redis when REDIS_URL is configured.
Credential login requires verified email.
Password reset response does not reveal whether an email exists.
Public signup blocks ADMIN creation.
Public host signup creates a pending Host profile, not HOST role.
Host access requires role HOST and host authorization checks.
Admin access requires role ADMIN.
Auth mutation requests require a trusted Origin or Referer header.
Auth endpoints use Redis-backed rate limiting when REDIS_URL is configured, with process-memory fallback for local development.
```

## Environment Variables

Auth-related variables:

```text
JWT_ACCESS_SECRET
JWT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
REDIS_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL
EMAIL_FROM
```

At least one JWT secret source must be configured:

```text
JWT_ACCESS_SECRET or JWT_SECRET or NEXTAUTH_SECRET
```

Redis is strongly recommended outside local development:

```text
REDIS_URL=redis://localhost:6379
```

Without Redis, rate limits fall back to process memory, email verification tokens fall back to `User.verificationToken`, and refresh token hashes fall back to `RefreshToken` rows where implemented.

## Common Issues

### `/api/auth/me` Returns 401

Possible causes:

```text
No token cookie
Expired or invalid JWT
JWT secret changed after login
NextAuth session also missing
```

Fix:

```text
Log in again.
Check JWT_ACCESS_SECRET / JWT_SECRET / NEXTAUTH_SECRET.
Clear stale browser cookies if needed.
```

### Verification Link Fails

Use:

```text
/api/auth/verify?email=...&token=...
```

Do not use legacy:

```text
/api/verify?token=...
```

### Host Login Says No Host Access

Possible causes:

```text
User role is USER and no Host profile exists.
Host profile exists but account has not been approved/promoted to HOST.
User tried type=HOST on a normal user account.
```

Fix:

```text
Complete host onboarding and admin/KYC approval so the backend grants HOST access.
```

### Google Login Does Not Set Custom Token

Expected flow must use:

```text
signIn("google", { callbackUrl: "/api/auth/google-login" })
```

If it only completes the NextAuth flow without visiting `/api/auth/google-login`, the custom `token` cookie may not be created.
