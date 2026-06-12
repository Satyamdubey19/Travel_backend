# Auth API Postman Testing Guide

This document lists every active auth endpoint and explains how to test it in Postman.

## Base Setup

Backend base URL:

```text
http://localhost:4000
```

Postman environment variable:

```text
base_url = http://localhost:4000
```

Common headers for JSON requests:

```text
Content-Type: application/json
Accept: application/json
Origin: http://localhost:4000
```

Important cookie behavior:

```text
Login sets an httpOnly cookie named token.
Register does not set a login cookie; email verification is required before login.
Postman stores this cookie automatically in its cookie jar.
After login, protected routes like GET /api/auth/me should work without manually copying a token.
```

Required backend env values:

```text
DATABASE_URL
JWT_ACCESS_SECRET or JWT_SECRET or NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:4000
RESEND_API_KEY optional for email sending
GOOGLE_CLIENT_ID optional for Google OAuth
GOOGLE_CLIENT_SECRET optional for Google OAuth
```

Recommended test order:

```text
1. Register user
2. Verify email
3. Login
4. Get current user
5. Update profile
6. Logout
7. Forgot password
8. Reset password
9. Register host
10. Verify host email
11. Confirm host cannot log in as HOST until approved/promoted
12. Become host from normal user creates pending Host profile only
```

## Endpoint Summary

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PATCH /api/auth/me
POST /api/auth/logout
GET  /api/auth/verify?email=...&token=...
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/google-login
GET  /api/auth/[...nextauth]
POST /api/auth/[...nextauth]
```

Legacy aliases:

```text
POST /api/forgot-password
POST /api/reset-password
GET  /api/verify?token=...
```

Use the `/api/auth/*` versions for new testing.

## 1. Register User

```text
Method: POST
URL: {{base_url}}/api/auth/register
```

Body:

```json
{
  "name": "Rahul Sharma",
  "email": "rahul.postman@example.com",
  "phone": "9000000001",
  "password": "secret123",
  "role": "user"
}
```

Expected status:

```text
201 Created
```

Expected response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Rahul Sharma",
    "email": "rahul.postman@example.com",
    "phone": "9000000001",
    "businessName": null,
    "role": "USER",
    "isHost": false,
    "isHostApproved": false,
    "provider": "credentials"
  },
  "message": "Registration successful. Please verify your email before logging in."
}
```

Postman check:

```text
Open Cookies for localhost.
You should not see a token cookie from registration.
Use the email verification link, then login to receive token.
```

Common error:

```json
{
  "error": "Email already exists"
}
```

## 2. Register Host

```text
Method: POST
URL: {{base_url}}/api/auth/register
```

Body:

```json
{
  "name": "Host User",
  "email": "host.postman@example.com",
  "phone": "9000000002",
  "password": "secret123",
  "role": "host",
  "businessName": "Postman Travels"
}
```

Expected status:

```text
201 Created
```

Expected response role:

```json
{
  "user": {
    "role": "USER",
    "isHost": false,
    "businessName": "Postman Travels"
  }
}
```

Host signup behavior:

```text
Public host signup creates a USER account plus a pending Host profile.
It does not grant HOST access. Admin/KYC approval or a backend promotion flow must grant HOST later.
```

Common error:

```json
{
  "error": "Business name is required for host signup"
}
```

## 3. Login

```text
Method: POST
URL: {{base_url}}/api/auth/login
```

Body:

```json
{
  "email": "rahul.postman@example.com",
  "password": "secret123"
}
```

Expected status:

```text
200 OK
```

Expected response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Rahul Sharma",
    "email": "rahul.postman@example.com",
    "role": "USER",
    "isHost": false,
    "isHostApproved": false,
    "provider": "credentials"
  }
}
```

Postman check:

```text
The response sets/updates the token cookie.
Do not add Authorization header manually.
```

Common error:

```json
{
  "error": "Incorrect email or password"
}
```

Unverified account error:

```json
{
  "error": "Please verify your email before logging in"
}
```

## 4. Login With Role Check

Use this when testing host or admin login screens.

```text
Method: POST
URL: {{base_url}}/api/auth/login
```

Host body:

```json
{
  "email": "host.postman@example.com",
  "password": "secret123",
  "type": "HOST"
}
```

Admin body:

```json
{
  "email": "admin@example.com",
  "password": "admin-password",
  "type": "ADMIN"
}
```

Expected status:

```text
200 OK
```

If the account does not have that role:

```json
{
  "error": "This account does not have host access"
}
```

Role check rules:

```text
type=HOST  requires host access.
type=USER  allows USER or HOST, but not ADMIN.
type=ADMIN requires ADMIN role.
```

## 5. Get Current User

```text
Method: GET
URL: {{base_url}}/api/auth/me
```

No body.

Expected status after login:

```text
200 OK
```

Expected response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Rahul Sharma",
    "email": "rahul.postman@example.com",
    "role": "USER",
    "isHost": false,
    "isHostApproved": false
  }
}
```

Expected status without valid cookie:

```text
401 Unauthorized
```

Expected unauthorized response:

```json
{
  "error": "Unauthorized"
}
```

Postman troubleshooting:

```text
If this returns 401 after login, open Postman Cookies and confirm token exists for localhost.
If token exists but still fails, check JWT_ACCESS_SECRET / JWT_SECRET / NEXTAUTH_SECRET.
```

## 6. Update Current User Profile

```text
Method: PATCH
URL: {{base_url}}/api/auth/me
```

This endpoint requires the login cookie.

Body:

```json
{
  "name": "Rahul S",
  "email": "rahul.postman@example.com",
  "phone": "9000000001",
  "location": "Jaipur",
  "bio": "Testing profile update from Postman",
  "dateOfBirth": "1995-01-20",
  "gender": "MALE",
  "nationality": "Indian",
  "address": "Jaipur, Rajasthan",
  "emergencyContactName": "Amit Sharma",
  "emergencyContactPhone": "9000000099",
  "website": "https://example.com",
  "instagram": "rahul_travels",
  "twitter": "rahul_travels",
  "travelStyle": "Adventure",
  "preferredCurrency": "INR",
  "preferredLanguage": "English",
  "dietaryPreferences": "Vegetarian",
  "passportNumber": "P1234567",
  "frequentFlyerNumber": "FF123456"
}
```

Expected status:

```text
200 OK
```

Expected response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Rahul S",
    "email": "rahul.postman@example.com",
    "phone": "9000000001",
    "role": "USER"
  }
}
```

Common errors:

```json
{
  "error": "Unauthorized"
}
```

```json
{
  "error": "Email is already in use"
}
```

## 7. Become Host

```text
Method: PATCH
URL: {{base_url}}/api/auth/me
```

This creates or updates a pending Host profile for the currently logged-in user. It does not grant HOST role.

Body:

```json
{
  "name": "Rahul S",
  "email": "rahul.postman@example.com",
  "phone": "9000000001",
  "businessName": "Rahul Postman Travels",
  "activateHost": true
}
```

Expected status:

```text
200 OK
```

Expected response:

```json
{
  "user": {
    "role": "USER",
    "isHost": false,
    "businessName": "Rahul Postman Travels"
  }
}
```

Postman check:

```text
The token cookie may be refreshed, but role remains USER.
Call GET /api/auth/me again to confirm role is not HOST until approval/promotion.
```

## 8. Logout

```text
Method: POST
URL: {{base_url}}/api/auth/logout
```

No body.

Expected status:

```text
200 OK
```

Expected response:

```json
{
  "message": "Logged out"
}
```

Postman check:

```text
After logout, GET /api/auth/me should return 401.
```

## 9. Forgot Password

```text
Method: POST
URL: {{base_url}}/api/auth/forgot-password
```

Body:

```json
{
  "email": "rahul.postman@example.com"
}
```

Expected status:

```text
201 Created
```

Expected response:

```json
{
  "message": "If that email exists, a reset link has been sent."
}
```

Security behavior:

```text
The same response is returned even if the email does not exist.
This prevents user email discovery.
```

How to get reset token for testing:

```text
If RESEND_API_KEY is configured, check the email inbox for the reset link.
The reset link looks like:
http://localhost:4000/reset-password?email=rahul.postman%40example.com&token=RAW_TOKEN
Copy token from that URL.
```

## 10. Reset Password

```text
Method: POST
URL: {{base_url}}/api/auth/reset-password
```

Body:

```json
{
  "email": "rahul.postman@example.com",
  "token": "paste-raw-token-from-reset-email",
  "password": "newSecret123"
}
```

Expected status:

```text
200 OK
```

Expected response:

```json
{
  "message": "Password reset successful"
}
```

After success:

```text
Use POST /api/auth/login with the new password.
```

Common errors:

```json
{
  "error": "Invalid reset token"
}
```

```json
{
  "error": "Reset token has expired"
}
```

## 11. Verify Email

```text
Method: GET
URL: {{base_url}}/api/auth/verify?email=rahul.postman@example.com&token=paste-raw-token-from-email
```

Expected status:

```text
200 OK
```

Expected response:

```json
{
  "user": {
    "id": "uuid",
    "email": "rahul.postman@example.com",
    "role": "USER"
  },
  "message": "Email verified successfully"
}
```

How to get verification token for testing:

```text
If RESEND_API_KEY is configured, check the signup email.
The verification link looks like:
http://localhost:4000/api/auth/verify?token=RAW_TOKEN&email=rahul.postman%40example.com
Copy email and token into Postman.
```

Common errors:

```json
{
  "error": "Invalid verification link"
}
```

```json
{
  "error": "Verification link has expired"
}
```

Important:

```text
Do not test new verification with /api/verify?token=...
That route is legacy and does not match the current hashed-token verification flow.
```

## 12. Google Login Bridge

```text
Method: GET
URL: {{base_url}}/api/auth/google-login
```

This endpoint is not normally tested as a direct Postman JSON request. It requires an existing NextAuth Google browser session.

Expected browser flow:

```text
Frontend calls signIn("google", { callbackUrl: "/api/auth/google-login" })
  -> Google OAuth completes
  -> NextAuth creates session
  -> /api/auth/google-login reads session
  -> backend creates/updates User
  -> backend sets custom token cookie
  -> redirects to app home
```

Direct Postman result without session:

```text
Redirects to /login
```

## 13. NextAuth Catch-All

```text
GET  /api/auth/[...nextauth]
POST /api/auth/[...nextauth]
```

These routes are managed internally by NextAuth.

Examples:

```text
GET {{base_url}}/api/auth/providers
GET {{base_url}}/api/auth/session
GET {{base_url}}/api/auth/csrf
```

Postman can call these for debugging, but normal application auth testing should use:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PATCH /api/auth/me
POST /api/auth/logout
```

## Postman Collection Checklist

Create a Postman collection named:

```text
GetHotels Auth APIs
```

Add these requests:

```text
Auth / Register User
Auth / Register Host
Auth / Login User
Auth / Login Host
Auth / Me
Auth / Update Profile
Auth / Become Host
Auth / Logout
Auth / Forgot Password
Auth / Reset Password
Auth / Verify Email
Auth / Google Login Bridge
NextAuth / Providers
NextAuth / Session
NextAuth / CSRF
```

Collection variables:

```text
base_url = http://localhost:4000
user_email = rahul.postman@example.com
user_password = secret123
host_email = host.postman@example.com
host_password = secret123
reset_token = paste_token_here
verify_token = paste_token_here
```

## Quick Test Script Ideas

For register/login/me requests, add this Postman test:

```js
pm.test("Status is success", function () {
  pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

pm.test("Response has user", function () {
  const json = pm.response.json();
  pm.expect(json.user).to.be.an("object");
  pm.expect(json.user.email).to.be.a("string");
});
```

For logout:

```js
pm.test("Logged out", function () {
  pm.response.to.have.status(200);
  const json = pm.response.json();
  pm.expect(json.message).to.eql("Logged out");
});
```

For unauthorized `/api/auth/me`:

```js
pm.test("Unauthorized without cookie", function () {
  pm.response.to.have.status(401);
});
```

## Troubleshooting

### `JWT secret is not configured`

Add one of these to backend `.env`:

```text
JWT_ACCESS_SECRET=your-dev-secret
JWT_SECRET=your-dev-secret
NEXTAUTH_SECRET=your-dev-secret
```

Restart backend after editing `.env`.

### `GET /api/auth/me` Returns 401 After Login

Check:

```text
Postman cookie jar has token for localhost.
Backend was not restarted with a different JWT secret.
You are calling the same host that created the cookie.
```

For example, a cookie from `localhost` may not be sent to `127.0.0.1`.

### Duplicate Email Or Phone

Use a new email/phone in the request body:

```text
rahul.postman+1@example.com
9000000011
```

### Password Reset Email Not Received

Check:

```text
RESEND_API_KEY is configured.
RESEND_FROM_EMAIL or EMAIL_FROM is valid.
Backend logs do not show "Skipping auth email".
```

### Google Login In Postman

Google login is browser/session based. Use the frontend browser flow for end-to-end testing.
