# Notifications Module Documentation

## Purpose

The notification module supports in-app notifications, email/event fanout, and real-time notification delivery.

## Source Files

```text
modules/notification/*
src/modules/notifications/*
src/realtime/notification.gateway.ts
src/realtime/events.ts
src/jobs/queues/notification.queue.ts
lib/socket-server.ts
lib/mail.ts
workers/*
```

## Current API Surface

The repository contains notification services, gateway structures, and queue files. A dedicated active `app/api/notifications` route group is not currently part of the main route map.

Notification behavior is triggered by domain events such as:

```text
booking created/confirmed/cancelled
payment success/failure
refund updates
host/KYC approval or rejection
tour chat or operational updates
waitlist movement
```

## Expected Flow

```text
domain service changes state
  -> create Notification row where implemented
  -> enqueue notification/email job where implemented
  -> realtime gateway broadcasts event to target user/host/admin
  -> frontend notification state updates
```

## Real-Time Components

```text
src/realtime/socket.ts
src/realtime/notification.gateway.ts
src/realtime/chat.gateway.ts
src/realtime/booking.gateway.ts
```

## Testing Notes

```text
Domain event creates correct notification payload.
Notification only goes to intended user/host/admin.
Socket broadcast uses the correct room/user channel.
Duplicate domain events are idempotent or safely duplicated according to policy.
Email provider failures do not roll back critical domain state unless required.
```

## Known Risks / Follow-Ups

```text
Add active API route docs if notification list/read endpoints are introduced.
Add event schema docs for socket payloads.
Add retry/dead-letter behavior for queued notification jobs.
```
