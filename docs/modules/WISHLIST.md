# Wishlist Module Documentation

## Purpose

The wishlist module lets authenticated users save and remove tours, rentals, and activities.

## Source Files

```text
app/api/wishlist/route.ts
controllers/wishlist.controller.ts
modules/wishlist/controllers/wishlist.controller.ts
services/wishlist.service.ts
modules/wishlist/services/wishlist.service.ts
```

## Auth

Wishlist endpoints require an authenticated user. Controllers support custom `token` cookie and NextAuth session lookup.

## Endpoints

```text
GET    /api/wishlist
POST   /api/wishlist
DELETE /api/wishlist
```

## Supported Targets

```text
TOUR
RENTAL
ACTIVITY
```

## Flow

```text
GET /api/wishlist
  -> authenticate user
  -> list wishlist items for user
  -> return saved items

POST /api/wishlist
  -> authenticate user
  -> parse target and targetId
  -> upsert wishlist item
  -> return created item with 201

DELETE /api/wishlist
  -> authenticate user
  -> parse target and targetId
  -> delete matching wishlist item
  -> return deletion result
```

## Example Add Request

```json
{
  "target": "TOUR",
  "targetId": "tour-id-or-slug"
}
```

## Testing Notes

```text
Unauthenticated GET/POST/DELETE should return 401.
Invalid target should return 400.
Adding the same target twice should not create duplicates.
Deleting a missing item should return a stable result.
Wishlist should only return the current user's items.
```
