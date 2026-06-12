# Utility API Module Documentation

## Purpose

Utility APIs support uploads, geolocation, AI responses, and legacy auth aliases.

## Source Files

```text
app/api/upload/route.ts
app/api/location/ip/route.ts
app/api/location/gps/route.ts
app/api/ai/route.ts
app/api/forgot-password/route.ts
app/api/reset-password/route.ts
app/api/verify/route.ts
lib/cloudinary.ts
lib/resend.ts
middleware/multer.ts
```

## Upload Endpoint

```text
POST /api/upload
```

Flow:

```text
multipart/form-data request
  -> read uploaded file
  -> require file
  -> validate image type
  -> enforce 10 MB max size
  -> upload to Cloudinary/storage
  -> return { url }
```

Testing:

```text
No file -> 400
Unsupported type -> 400
File over 10 MB -> 400
Valid image -> 200 with url
```

## Location Endpoints

```text
GET /api/location/ip
GET /api/location/gps?lat=...&lng=...
```

GPS flow:

```text
validate lat/lng
  -> call OpenCage reverse geocoding when configured
  -> return detected city
  -> fallback to Current Location
```

IP flow:

```text
read forwarded/client IP headers
  -> call IP geolocation provider
  -> return city/region/country
  -> fallback to India
```

Design note:

```text
Location routes intentionally return fallback 200 responses when providers fail so frontend search can keep rendering.
```

## AI Endpoint

```text
POST /api/ai
```

Flow:

```text
parse prompt/message payload
  -> call configured AI provider/service
  -> return response
```

Testing:

```text
Missing payload should return validation error if enforced.
Provider key missing should fail safely.
Provider failure should return a controlled error.
```

## Legacy Auth Aliases

```text
POST /api/forgot-password
POST /api/reset-password
GET  /api/verify?token=...
```

Status:

```text
/api/forgot-password and /api/reset-password delegate to current auth controllers.
/api/verify is legacy and does not match the current hashed-token email verification flow.
Use /api/auth/verify?email=...&token=... for current verification.
```

Follow-up:

```text
Remove /api/verify or make it redirect/delegate to /api/auth/verify with the required email parameter.
```
