# Bookings Module Documentation

## Purpose

The bookings module exposes authenticated user booking history and shared booking ownership helpers. Tour booking creation and payment flows are documented in `TOUR_BOOKING.md`.

## Source Files

```text
app/api/my-bookings/route.ts
app/api/host/bookings/route.ts
app/api/host/bookings/[bookingId]/route.ts
modules/booking/controllers/my-bookings.controller.ts
modules/booking/services/my-bookings.service.ts
modules/booking/services/host-booking.service.ts
modules/booking/services/expire-bookings.service.ts
modules/booking/services/coupon.service.ts
```

## Auth

```text
GET /api/my-bookings
GET /api/my-bookings/[type]/[id]
  -> custom token cookie first
  -> fallback to NextAuth session
  -> require user id
```

## Endpoints

```text
GET /api/my-bookings
```

Related tour booking endpoints:

```text
POST /api/tour/[id]/booking-intents
POST /api/tour-bookings/[bookingId]/travelers
POST /api/tour-bookings/[bookingId]/cancel
POST /api/tour/[id]/payment/order
POST /api/tour/[id]/payment/verify
POST /api/webhooks/razorpay
```

Host endpoints:

```text
GET /api/host/bookings?type=all|tour|activity|rental&status=...
PATCH /api/host/bookings
GET /api/host/bookings/[bookingId]?type=tour|activity|rental
```

## Flow

```text
GET /api/my-bookings
  -> authenticate user
  -> query unified booking history
  -> group or normalize tour/activity/rental bookings where supported
  -> return { success: true, data: bookings }
```

## Booking Ownership Rule

```text
Every booking read or mutation must verify booking.userId matches the authenticated user id unless the route is explicitly host/admin scoped.
Host booking reads and changes require the tour, activity or rental booking's hostId to match the authenticated approved host.
Hosts cannot confirm payment; only provider-verified flows may confirm a paid booking.
Host completion/no-show is date-gated. Cancellation and no-show require a recorded reason; paid cancellation creates or preserves a refund-review record and notifies the traveler.
```

## Testing Notes

```text
Unauthenticated request should return 401.
User should only see own bookings.
User should not read or mutate another user's booking id.
Expired unpaid bookings should not appear as active/confirmed.
Cancelled bookings should show cancellation/refund state where available.
```

## Related Jobs

```text
POST /api/cron/expire-bookings
modules/booking/services/expire-bookings.service.ts
src/jobs/schedulers/booking-expiry.scheduler.ts
```
