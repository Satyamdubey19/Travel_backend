# Tour Booking Module Documentation

## Purpose

The tour booking module handles group booking intent creation, traveler addition, traveler duplicate checks, waitlisting, cancellation, refund calculation, and tour payment order/verification.

## Source Files

```text
app/api/tour/[id]/booking-intents/route.ts
app/api/tour/[id]/booking/route.ts
app/api/tour-bookings/[bookingId]/travelers/route.ts
app/api/tour-bookings/[bookingId]/cancel/route.ts
app/api/tour/[id]/payment/order/route.ts
app/api/tour/[id]/payment/verify/route.ts
controllers/tour-booking-engine.controller.ts
modules/tour/controllers/tour-booking-engine.controller.ts
services/tour-booking-engine.service.ts
services/tour-traveler-duplicate.service.ts
services/tour-operations.service.ts
lib/traveler-normalization.ts
lib/traveler-identity.ts
lib/razorpay.ts
```

## Auth

Tour booking mutation endpoints require an authenticated user.

```text
custom token cookie
  -> getUserFromSessionToken
  -> user id

fallback NextAuth session
  -> session.user.id
```

## Endpoints

```text
POST /api/tour/[id]/booking-intents
POST /api/tour/[id]/booking
POST /api/tour-bookings/[bookingId]/travelers
POST /api/tour-bookings/[bookingId]/cancel
POST /api/tour/[id]/payment/order
POST /api/tour/[id]/payment/verify
POST /api/tour/[id]/validate-traveler
POST /api/tour/[id]/waitlist
```

## Booking Intent Flow

```text
POST /api/tour/[id]/booking-intents
  -> authenticate user
  -> rate limit by user/ip
  -> validate contact and traveler payload
  -> find tour by id or slug
  -> confirm tour is ACTIVE/open
  -> start serializable Prisma transaction
  -> load departure batch if selected
  -> reject cancelled/missing batch
  -> check traveler duplicates
  -> calculate available seats
  -> calculate unit price, subtotal, taxes, total
  -> create PENDING booking if seats available
  -> create WAITLISTED booking if seats unavailable
  -> insert TourTraveler rows
  -> create WaitlistQueue row if waitlisted
  -> write audit log where implemented
  -> return booking id/code/status/amount/waitlist data
```

## Add Travelers Flow

```text
POST /api/tour-bookings/[bookingId]/travelers
  -> authenticate user
  -> verify booking belongs to user
  -> validate travelers
  -> check duplicate identity
  -> inspect tour/batch availability
  -> add travelers as PENDING or WAITLISTED
  -> return updated booking/traveler data
```

## Cancel Booking Flow

```text
POST /api/tour-bookings/[bookingId]/cancel
  -> authenticate user
  -> verify booking ownership
  -> load booking/tour/traveler state
  -> calculate refund policy
  -> create cancellation record
  -> update booking/traveler statuses
  -> create Refund row if applicable
  -> return cancellation/refund summary
```

Refund policy documented in `PROJECT_FLOW.md`:

```text
More than 30 days before start: 100%
15 to 30 days before start: 75%
7 to 14 days before start: 50%
Less than 7 days before start: 0%
Less than 24 hours before start: 0%
```

## Payment Flow

```text
POST /api/tour/[id]/payment/order
  -> authenticate user
  -> verify booking/tour context
  -> create Razorpay order
  -> return provider order details

POST /api/tour/[id]/payment/verify
  -> authenticate user
  -> verify Razorpay signature
  -> update payment status
  -> confirm booking/travelers
  -> reserve seats/inventory
  -> return payment confirmation
```

## Traveler Duplicate Flow

Duplicate protection uses normalized traveler identity signals:

```text
full name
age or date of birth
email
phone
Aadhaar hash/last four when provided
```

Final duplicate protection must happen on the backend even if the frontend pre-validates.

## Response Shapes

```json
{ "success": true, "data": {} }
```

```json
{ "error": "Unauthorized" }
```

```json
{ "error": "This traveler is already registered for this tour." }
```

## Testing Notes

```text
Unauthenticated booking intent should return 401.
Inactive/missing tour should return 404 or conflict-style error.
Cancelled batch should not be bookable.
Duplicate traveler should be rejected.
Booking should become WAITLISTED when seats unavailable.
Adding travelers should enforce ownership.
Cancellation should enforce ownership.
Payment verification must reject invalid signature.
Concurrent booking intents should not oversell seats.
```

## Known Risks / Follow-Ups

```text
Keep serializable transactions for seat assignment.
Payment confirmation must be idempotent.
Cancellation and refund creation must be idempotent.
Sensitive identity values should remain hashed where possible.
```
