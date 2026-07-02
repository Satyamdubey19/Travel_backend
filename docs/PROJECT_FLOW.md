# Backend Project Flow

This document describes how the Travels backend is structured, how requests move through the system, and how the main business workflows operate.

## Runtime Overview

The backend is a Next.js API application with Prisma-backed persistence, authentication, booking logic, payment integration, upload support, email utilities, workers, and socket support.

```text
Frontend on http://localhost:3000
  -> /api/* requests
  -> frontend rewrite
  -> backend on http://localhost:4000/api/*
  -> route handler
  -> controller/service
  -> Prisma/PostgreSQL and external services
```

The backend development server runs on port `4000`.

```bash
npm run dev
```

## Main Technologies

- Next.js App Router API route handlers.
- TypeScript.
- Prisma ORM with PostgreSQL.
- Redis/ioredis for shared rate limiting and auth token state when `REDIS_URL` is configured.
- NextAuth and custom auth endpoints.
- bcrypt for password hashing.
- jsonwebtoken for token support.
- Razorpay for payments.
- Cloudinary and upload middleware for media.
- Resend/SMTP mail helpers.
- Socket.IO for real-time chat/notifications.
- BullMQ/ioredis-style worker structure for background jobs.
- Zod validators for request payload validation.

## Directory Roles

```text
app/api/       Next.js API routes
controllers/   Request-level controller logic
modules/       Feature modules grouped by domain
services/      Business logic and integrations
lib/           Shared clients and helpers
middleware/    Upload and request middleware
prisma/        Database schema, migrations, and seed script
workers/       Background workers
src/           Express-style/server architecture, queues, gateways, docs
types/         Shared TypeScript types
validators/    Shared validation schemas
emails/        Email templates
docs/auth/     Auth API, Postman, QA, and adversarial testing documentation
docs/modules/  Module-level API and workflow documentation
```

The project currently contains both `app/api` route handlers and a larger `src/` modular backend structure. The active Next.js API surface is under `app/api`.

## Request Lifecycle

```text
HTTP request
  -> app/api/.../route.ts
  -> parse params/query/body
  -> authenticate user if needed
  -> validate payload
  -> call controller or service
  -> Prisma transaction or query
  -> external provider if needed
  -> return NextResponse JSON
```

Common response patterns:

```text
Success: { data } or direct resource payload
Error:   { error: "message" } or { message: "message" }
```

## Environment Variables

The backend reads private configuration from `.env`.

Required or commonly used variables:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENCAGE_API_KEY
LOCATION_API_KEY
GROQ_API_KEY
RESEND_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_URL
SMTP_HOST
SMTP_PORT
EMAIL_USER
EMAIL_PASS
EMAIL_FROM
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
CRON_SECRET
CORS_ORIGIN
PORT
```

Do not commit `.env`. Keep `.env.example` placeholder-only.

## Database Model Overview

The core schema is in `prisma/schema.prisma`.

### User And Access Models

```text
User
UserProfile
UserTravelPreference
RefreshToken
Session
OtpVerification
PasswordResetToken
LoginAttempt
UserDevice
EmailChangeRequest
SecurityEvent
AdminProfile
Host
KycApplication
AuditLog
ModerationLog
```

Redis-backed auth state:

```text
gethotels:rate-limit:*             shared endpoint rate-limit counters
gethotels:auth:email-verify:*      hashed email verification token by normalized email
gethotels:auth:refresh:*           hashed refresh-token metadata
gethotels:auth:refresh:user:*      per-user refresh-token hash index
```

Refresh-token hashes are also persisted in PostgreSQL for audit and fallback. Redis is used for fast shared auth state when configured.

Roles:

```text
USER
HOST
ADMIN
```

Account states:

```text
PENDING
ACTIVE
SUSPENDED
REJECTED
BANNED
DELETED
```

### Listing Models

```text
Amenity
Tour
TourItineraryDay
Activity
ActivitySlot
Rental
Post
```

Listing moderation states:

```text
DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
REJECTED
ARCHIVED
```

### Booking And Payment Models

```text
Booking
BookingTimeline
Payment
Coupon
CouponRedemption
TourBooking
TourTraveler
WaitlistQueue
TourCancellation
Refund
ActivityBooking
ActivityPayment
RentalBooking
Payout
```

### Social, Chat, And Wishlist Models

```text
WishlistItem
Review
Notification
TourParticipant
TourJoinRequest
TourChatRoom
TourMessage
TourMessageSeen
TravelerReport
TourWaitlist
```

## API Route Map

### Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/login/replace-device
POST /api/auth/logout
GET  /api/auth/me
PATCH /api/auth/me
GET  /api/auth/devices
POST /api/auth/devices/logout
GET  /api/auth/verify
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/google-login
GET/POST /api/auth/[...nextauth]
```

Detailed auth docs live in:

```text
docs/auth/AUTH_MODULE.md
docs/auth/AUTH_API_POSTMAN.md
docs/auth/AUTH_QA_SECURITY_AUDIT.md
docs/auth/AUTH_ADVERSARIAL_TESTING.md
```

Module-level docs live in:

```text
docs/modules/ADMIN.md
docs/modules/LISTINGS.md
docs/modules/TOURS.md
docs/modules/TOUR_BOOKING.md
docs/modules/HOST.md
docs/modules/BOOKINGS.md
docs/modules/WISHLIST.md
docs/modules/NOTIFICATIONS.md
docs/modules/UTILITY.md
docs/modules/JOBS.md
```

### Location

```text
GET /api/location/ip
GET /api/location/gps?lat=...&lng=...
```

### Tours

```text
GET  /api/tour
POST /api/tour
GET  /api/tour/[id]
PATCH/PUT /api/tour/[id]
DELETE /api/tour/[id]
POST /api/tour/[id]/booking
POST /api/tour/[id]/booking-intents
GET/POST /api/tour/[id]/batches
GET/POST /api/tour/[id]/participants
GET/POST /api/tour/[id]/chat
GET/POST /api/tour/[id]/announcements
GET/POST /api/tour/[id]/documents
POST /api/tour/[id]/join-request
PATCH /api/tour/[id]/join-request/[requestId]
POST /api/tour/[id]/payment/order
POST /api/tour/[id]/payment/verify
GET/POST /api/tour/[id]/reviews
POST /api/tour/[id]/validate-traveler
POST /api/tour/[id]/waitlist
```

### Tour Bookings

```text
POST /api/tour-bookings/[bookingId]/travelers
POST /api/tour-bookings/[bookingId]/cancel
```

### User Bookings And Wishlist

```text
GET /api/my-bookings
GET/POST/DELETE /api/wishlist
```

### Activities

```text
GET  /api/activity
POST /api/activity
GET  /api/activity/[id]
PATCH/PUT /api/activity/[id]
DELETE /api/activity/[id]
```

### Rentals

```text
GET  /api/rental
POST /api/rental
GET  /api/rental/[id]
PATCH/PUT /api/rental/[id]
DELETE /api/rental/[id]
```

### Uploads And AI

```text
POST /api/upload
POST /api/ai
```

### Admin

```text
GET /api/admin/dashboard
GET /api/admin/users
PATCH /api/admin/users/[id]
GET /api/admin/hosts
PATCH /api/admin/hosts/[id]
GET /api/admin/kyc
PATCH /api/admin/kyc/[id]
GET /api/admin/listings
PATCH /api/admin/listings/[type]/[id]
GET /api/admin/bookings
PATCH /api/admin/bookings/[id]
GET /api/admin/payouts
PATCH /api/admin/payouts/[id]
GET/PATCH /api/admin/posts
```

### Cron

```text
POST /api/cron/expire-bookings
```

## Auth Flow

### Register

```text
POST /api/auth/register
  -> validate name/email/phone/password/role
  -> require trusted Origin/Referer
  -> apply Redis-backed rate limit by IP and email
  -> check duplicate user
  -> hash password
  -> generate raw email verification token
  -> store SHA-256 hashed verification token in Redis with 24 hour TTL
  -> fall back to User.verificationToken fields if Redis is not configured
  -> create PENDING User with role USER
  -> create pending Host profile if host signup was requested
  -> send email verification link
  -> record SecurityEvent
  -> do not issue auth cookie
  -> return sanitized user
```

### Login

```text
POST /api/auth/login
  -> require trusted Origin/Referer
  -> apply Redis-backed rate limit by IP and email/IP
  -> find user by email
  -> run dummy bcrypt compare for missing users
  -> reject banned, inactive, deleted, or non-ACTIVE users
  -> reject locked accounts
  -> require verified email
  -> compare bcrypt password
  -> record failed LoginAttempt and update lockout counters on bad password
  -> check requested role if provided
  -> reset lockout counters on success
  -> resolve device from X-Device-Id, deviceId cookie, or generated UUID
  -> if current device is already active, allow login and update lastSeenAt
  -> if fewer than 3 active devices exist, create the device session
  -> if 3 other active devices exist, return 409 DEVICE_LIMIT_REACHED with active device list and do not issue tokens
  -> create LoginAttempt, SecurityEvent, and Session rows
  -> generate access JWT and raw refresh token
  -> store SHA-256 hashed refresh token metadata in Redis with 30 day TTL
  -> store active device marker auth:device:{userId}:{deviceId} in Redis
  -> store matching RefreshToken row with device metadata
  -> issue httpOnly token, refreshToken, and deviceId cookies
  -> return user with role and host info
```

### Device Limit And Replacement

```text
Maximum active devices per user: 3

GET /api/auth/devices
  -> authenticate current user
  -> return active UserDevice rows
  -> mark current request device with isCurrent=true

POST /api/auth/devices/logout
  -> authenticate current user
  -> validate selected device belongs to user and is active
  -> revoke matching RefreshToken row
  -> delete Redis refresh-token and active-device keys
  -> deactivate Session rows for selected device
  -> mark UserDevice inactive
  -> record DEVICE_FORCE_LOGOUT

POST /api/auth/login/replace-device
  -> validate email/password like normal login
  -> validate deviceToLogout belongs to the same user and is active
  -> logout selected device
  -> create session for current device
  -> issue token, refreshToken, and deviceId cookies
  -> record DEVICE_REPLACED and DEVICE_LOGIN
```

Device identification priority:

```text
1. X-Device-Id header
2. deviceId cookie
3. generated UUID stored in httpOnly deviceId cookie
```

Google OAuth bridge uses the same device/session creator. If the user already has 3 active devices and the Google login is from a new device, `/api/auth/google-login` redirects to `/login?error=DEVICE_LIMIT_REACHED` instead of issuing cookies.

### Email Verification

```text
GET /api/auth/verify?email=...&token=...
  -> apply Redis-backed rate limit by IP
  -> normalize email
  -> load user by email
  -> hash submitted token
  -> compare against Redis email verification token first
  -> fall back to User.verificationToken fields for older links
  -> mark user email verified and ACTIVE
  -> delete Redis verification token
  -> clear legacy verification fields
  -> mark related Host row verified
```

### Current User

```text
GET /api/auth/me
  -> read auth cookie/session/token
  -> verify token signature, expiry, revocation, and user invalidation state
  -> load user and host relation
  -> reject missing, deleted, banned, inactive, or non-ACTIVE users
  -> return user payload
```

### Logout

```text
POST /api/auth/logout
  -> require trusted Origin/Referer
  -> revoke current JWT in process memory
  -> delete current refresh token from Redis
  -> delete Redis active-device key
  -> mark current UserDevice inactive
  -> deactivate Session rows for current device
  -> revoke matching RefreshToken row
  -> clear token and refreshToken cookies
  -> return success
```

### Password Reset

```text
POST /api/auth/forgot-password
  -> normalize email
  -> return generic message for missing/unusable accounts
  -> create PasswordResetToken with SHA-256 tokenHash and 1 hour expiry
  -> keep legacy User reset fields for backwards compatibility
  -> send reset email

POST /api/auth/reset-password
  -> hash submitted token and find unused PasswordResetToken
  -> reject expired or used token
  -> mark token used atomically
  -> update password
  -> delete all user refresh tokens from Redis
  -> revoke RefreshToken rows
  -> deactivate sessions
  -> invalidate current JWT sessions in process memory
```

### Host Activation

```text
PATCH /api/auth/me
  -> require trusted Origin/Referer
  -> update user profile fields
  -> optionally create or update pending Host profile
  -> does not grant HOST role
  -> return updated user
```

## Location Flow

### GPS

```text
GET /api/location/gps?lat=...&lng=...
  -> validate lat/lng
  -> read OPENCAGE_API_KEY
  -> call OpenCage reverse geocoding
  -> return city/town/village/county/state
  -> fallback: Current Location
```

### IP

```text
GET /api/location/ip
  -> read x-forwarded-for, x-real-ip, cf-connecting-ip
  -> fallback to 8.8.8.8
  -> call ipapi.co
  -> return city/region/country
  -> fallback: India
```

Both routes return status `200` with a fallback city when external geolocation fails, so the frontend can keep rendering.

## Tour Booking Intent Flow

The main tour group booking logic lives in `services/tour-booking-engine.service.ts`.

```text
POST /api/tour/[id]/booking-intents
  -> authenticate user
  -> validate contact and traveler payload
  -> find tour by id or slug
  -> confirm tour is ACTIVE
  -> start serializable Prisma transaction
  -> load departure batch if selected
  -> reject cancelled or missing batch
  -> check traveler duplicates for the tour
  -> calculate available seats
  -> calculate unit price
  -> subtotal = unit price * traveler count
  -> taxes = subtotal * 12%
  -> total = subtotal + taxes
  -> if enough seats:
       status = PENDING
       traveler status = PENDING
     else:
       status = WAITLISTED
       traveler status = WAITLISTED
  -> create TourBooking
  -> insert TourTraveler rows
  -> create WaitlistQueue row if waitlisted
  -> write AuditLog
  -> return booking id, code, status, counts, amount, waitlist data
```

Important rules:

- Tour must exist.
- Tour must be active and open for booking.
- Departure batch must exist unless using the base tour departure.
- Cancelled batches cannot be booked.
- Traveler duplicates are rejected.
- Transaction isolation is `Serializable` to avoid seat race conditions.
- Pending bookings expire after 15 minutes.
- Waitlist entries expire after 3 days.

## Traveler Duplicate Flow

Traveler identity helpers live in:

```text
services/tour-traveler-duplicate.service.ts
lib/traveler-normalization.ts
lib/traveler-identity.ts
```

Duplicate protection uses normalized identity signals such as:

- Normalized full name.
- Age or date of birth.
- Email and phone.
- Aadhaar hash and last four digits where provided.

Final duplicate protection happens on the backend, even if the frontend performs pre-validation.

## Add Travelers Flow

```text
POST /api/tour-bookings/[bookingId]/travelers
  -> authenticate user
  -> verify booking belongs to user
  -> check duplicates
  -> inspect batch or tour availability
  -> insert travelers as PENDING or WAITLISTED
  -> queue waitlist if seats are unavailable
  -> return added count and status
```

## Cancellation And Refund Flow

```text
POST /api/tour-bookings/[bookingId]/cancel
  -> authenticate user
  -> verify booking ownership
  -> load tour start date
  -> calculate refund percentage
  -> create TourCancellation
  -> cancel one traveler or whole booking
  -> create Refund row if refund amount > 0
  -> return refund percent and amount
```

Refund percentage rules:

```text
Less than 24 hours before start: 0%
More than 30 days before start: 100%
15 to 30 days before start: 75%
7 to 14 days before start: 50%
Less than 7 days before start: 0%
```

## Payment Flow

Payment-related route groups:

```text
/api/tour/[id]/payment/order
/api/tour/[id]/payment/verify
```

Expected flow:

```text
Frontend submits booking intent
  -> backend returns bookingId and totalAmount
  -> frontend asks backend to create Razorpay order
  -> backend creates provider order using RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
  -> frontend opens Razorpay checkout
  -> Razorpay returns payment id, order id, signature
  -> frontend sends verification payload
  -> backend verifies signature
  -> backend marks payment success
  -> backend confirms booking/travelers and reserves seats
```

Private Razorpay keys must only exist in backend `.env`.

## Admin Moderation Flow

Admin routes manage platform operations.

```text
Admin frontend
  -> /api/admin/*
  -> verify ADMIN role
  -> query or mutate target entity
  -> create moderation/audit log
  -> return updated state
```

Moderated entities include:

```text
USER
HOST
TOUR
RENTAL
ACTIVITY
KYC
BOOKING
PAYOUT
REVIEW
```

Typical status flow for listings:

```text
DRAFT
  -> PENDING_REVIEW
  -> ACTIVE or REJECTED
  -> PAUSED or ARCHIVED
```

Typical KYC flow:

```text
NOT_SUBMITTED
  -> PENDING
  -> APPROVED or REJECTED
```

## Host Flow

```text
User registers or becomes host
  -> Host profile is created
  -> Host submits KYC
  -> Admin reviews KYC
  -> Host creates listing
  -> Listing enters PENDING_REVIEW
  -> Admin approves listing
  -> Listing becomes ACTIVE
  -> Users book listing
  -> Host manages bookings, travelers, reviews, payouts
```

Host-related domains:

```text
Host
KycApplication
Tour
Rental
Activity
Booking
Payout
Review
```

## Booking Expiry Flow

Pending booking records can expire if payment is not completed before their expiry time.
The cron route and booking expiration service mark stale pending bookings as cancelled.

## Activity Flow

Activity domain uses:

```text
Activity
ActivitySlot
ActivityBooking
ActivityBookingGuest
ActivityBookingTimeline
ActivityPayment
```

Expected activity booking flow:

```text
User selects activity
  -> chooses slot/date/time
  -> submits guest details
  -> backend validates slot availability
  -> creates ActivityBooking
  -> starts payment
  -> confirms booking after payment verification
```

## Rental Flow

Rental domain supports vehicle or item rentals through:

```text
Rental
RentalBooking
```

Expected flow:

```text
Host creates rental listing
  -> admin approves listing
  -> user selects rental and dates
  -> backend checks availability
  -> booking/payment flow runs
```

## Wishlist Flow

```text
GET /api/wishlist
  -> return current user's saved items

POST /api/wishlist
  -> validate target and target id
  -> upsert WishlistItem by user and target

DELETE /api/wishlist
  -> remove item by target
```

Supported targets:

```text
TOUR
RENTAL
ACTIVITY
```

## Upload Flow

```text
POST /api/upload
  -> receive multipart file
  -> validate file constraints
  -> upload to Cloudinary/storage provider
  -> return public URL
```

Used by:

- Listing images.
- KYC documents.
- Tour documents.
- Chat images.
- Profile images.

## Email Flow

Email helpers live under:

```text
lib/mail.ts
lib/resend.ts
emails/
services/email/
workers/tour-email.worker.ts
src/external/email/
```

Common email events:

- Signup verification.
- Password reset.
- Booking confirmation.
- Payment success.
- Refund updates.
- Host/KYC approval or rejection.
- Tour transaction notifications.

Expected async pattern:

```text
Domain service changes state
  -> enqueue or call email service
  -> worker/template renders email
  -> provider sends message
```

## Real-Time Flow

Socket-related files:

```text
lib/socket-server.ts
src/realtime/socket.ts
src/realtime/chat.gateway.ts
src/realtime/booking.gateway.ts
src/realtime/notification.gateway.ts
src/realtime/events.ts
```

Expected chat flow:

```text
Client connects socket
  -> authenticates user
  -> joins tour room
  -> sends message
  -> backend persists TourMessage
  -> backend updates TourChatRoom last message
  -> backend broadcasts message
  -> clients mark messages seen
```

Expected notification flow:

```text
Domain event
  -> Notification row
  -> socket broadcast to user/host/admin
  -> frontend notification state updates
```

## Background Job Flow

Job and scheduler files live under:

```text
src/jobs/queues/
src/jobs/schedulers/
src/jobs/workers/
workers/
```

Background responsibilities:

- Expire unpaid bookings.
- Send emails.
- Process refunds.
- Process waitlist promotions.
- Process contests.
- Run payout schedules.

Cron route:

```text
POST /api/cron/expire-bookings
```

This should be protected with `CRON_SECRET`.

## Error Handling Strategy

Backend routes should:

1. Validate inputs before writing.
2. Return `400` for invalid payloads.
3. Return `401` for missing auth.
4. Return `403` for insufficient role.
5. Return `404` for missing resources.
6. Return `409` for conflicts such as duplicates or unavailable inventory.
7. Return `500` only for unexpected failures.

Frontend expects a response body with:

```text
{ "error": "message" }
```

or:

```text
{ "message": "message" }
```

## Local Development Flow

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env
```

Run database migrations:

```bash
npx prisma migrate dev
```

Generate Prisma client if needed:

```bash
npx prisma generate
```

Seed data if needed:

```bash
npm run seed
```

Start backend:

```bash
npm run dev
```

Backend URL:

```text
http://localhost:4000
```

## Production Flow

1. Configure production `DATABASE_URL`.
2. Configure production `REDIS_URL` for shared rate limits, verification tokens, and refresh-token state.
3. Configure auth secrets and OAuth credentials.
4. Configure payment, email, storage, AI, and location provider credentials.
5. Run Prisma migration deployment.
6. Build backend.
7. Start backend on configured port.
8. Point frontend `BACKEND_API_URL` to the backend origin.
9. Configure cron jobs for booking expiration and scheduled workers.
10. Monitor logs for payment, booking, auth, Redis, and email failures.

## Security Rules

- Never commit `.env`.
- Never put real secrets in `.env.example`.
- Keep OAuth, database, Cloudinary, Razorpay, Resend, Groq, and SMTP credentials in backend environment only.
- Verify payment signatures on backend only.
- Validate booking ownership before returning or mutating booking data.
- Enforce role checks for host and admin routes.
- Keep `REDIS_URL` configured in production so rate limits and refresh-token state survive process restarts and work across instances.
- Use transactions for inventory, payment confirmation, seat assignment, waitlist, and cancellation.
- Store sensitive identity values as hashes where possible.

## Common Failure Points

### Frontend Gets ECONNREFUSED On Port 4000

Cause:

```text
Backend is not running on port 4000.
```

Fix:

```bash
npm run dev
```

### GitHub Blocks Push

Cause:

```text
Committed secrets in .env.example or source files.
```

Fix:

```text
Replace secrets with placeholders, amend or rewrite commit, then push again.
Rotate leaked credentials.
```

### GPS Location Returns Fallback

Causes:

- Missing `OPENCAGE_API_KEY`.
- External geocoding provider failed.
- Invalid coordinates.

Fallback:

```text
Current Location
```

### IP Location Returns India

Causes:

- External IP provider failed.
- Localhost/private IP cannot be geolocated.

Fallback:

```text
India
```

### Prisma Errors

Common causes:

- `DATABASE_URL` missing.
- Prisma client not generated.
- Migrations not applied.
- Schema and database are out of sync.

Fix:

```bash
npx prisma generate
npx prisma migrate dev
```

## Ownership Map

```text
Auth                 app/api/auth, modules/auth, services/auth.service.ts
Admin                app/api/admin, modules/admin, services/admin.service.ts
Tours                app/api/tour, modules/tour, services/tour.service.ts
Tour booking engine  services/tour-booking-engine.service.ts
Traveler duplicate   services/tour-traveler-duplicate.service.ts
Activities           app/api/activity, modules/activity, services/activity.service.ts
Rentals              app/api/rental, modules/rental, services/rental.service.ts
Bookings             modules/booking, services/my-bookings.service.ts
Payments             lib/razorpay.ts, src/modules/payments
Wishlist             app/api/wishlist, modules/wishlist
Uploads              app/api/upload, middleware/multer.ts, lib/cloudinary.ts
Email                lib/mail.ts, lib/resend.ts, services/email, workers
Realtime             lib/socket-server.ts, src/realtime
Database             prisma/schema.prisma, prisma/migrations
```
