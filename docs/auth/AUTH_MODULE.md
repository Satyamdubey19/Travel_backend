# Auth Module Documentation

This document explains the active authentication APIs, how auth works internally, how the frontend uses it, and which database fields are involved.

## Source Files

```text
app/api/auth/*                         API route handlers
modules/auth/controllers/auth.controller.ts
modules/auth/services/auth.service.ts
modules/auth/types/auth.ts
lib/auth.ts                            NextAuth config
lib/hash.ts                            secure random token + SHA-256 hash
lib/mail.ts                            verification, login, reset emails
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
  -> store SHA-256 hashed verification token
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

Authenticates by email and password, requires an active and verified account, optionally checks a requested role, sends a login alert email, and sets the `token` cookie.

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
JWT secret is not configured
```

Internal flow:

```text
normalize email
  -> find User by email
  -> require password field
  -> reject inactive, banned, deleted, or non-ACTIVE users
  -> reject unverified email
  -> bcrypt.compare(password, stored hash)
  -> build auth user with Host info
  -> check requested role if type is provided
  -> send login email
  -> create JWT
  -> set httpOnly token cookie
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

### 4. Update Current User / Become Host

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

### 5. Logout

```text
POST /api/auth/logout
```

Deletes the custom `token` cookie.

Success `200`:

```json
{
  "message": "Logged out"
}
```

Frontend also calls NextAuth `signOut({ redirect: false })` to clear any NextAuth session.

### 6. Verify Email

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
  -> require verificationToken
  -> check verificationExpiry
  -> SHA-256 hash query token and compare with stored hash
  -> set isEmailVerified=true
  -> clear verificationToken and verificationExpiry
  -> mark matching Host rows isVerified=true
  -> return user
```

### 7. Forgot Password

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

### 8. Reset Password

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
  -> require resetToken and resetTokenExpiry
  -> reject expired token
  -> SHA-256 hash query token and compare with stored hash
  -> bcrypt.hash(new password, 12)
  -> update password
  -> clear resetToken and resetTokenExpiry
```

### 9. Google Login Bridge

```text
GET /api/auth/google-login
```

This route expects a valid NextAuth Google session. It creates or updates the matching DB user, creates the custom JWT cookie, then redirects to the app home URL.

Success behavior:

```text
valid NextAuth session
  -> handleGoogleAuth()
  -> set custom token cookie
  -> redirect to NEXTAUTH_URL or http://localhost:3000
```

Failure behavior:

```text
missing Google session/email
  -> redirect to /login
```

The frontend starts this flow with:

```ts
signIn("google", { callbackUrl: "/api/auth/google-login" })
```

### 10. NextAuth Catch-All

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

`/api/verify` is legacy and should not be used for the current email verification flow. The current signup stores a hashed verification token and expects `/api/auth/verify?email=...&token=...`.

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
Credential login requires verified email.
Password reset response does not reveal whether an email exists.
Public signup blocks ADMIN creation.
Public host signup creates a pending Host profile, not HOST role.
Host access requires role HOST and host authorization checks.
Admin access requires role ADMIN.
Auth mutation requests require a trusted Origin or Referer header.
Auth endpoints have in-memory rate limiting.
```

## Environment Variables

Auth-related variables:

```text
JWT_ACCESS_SECRET
JWT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
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
