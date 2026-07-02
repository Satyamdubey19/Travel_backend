type HttpMethod = "get" | "post" | "put" | "patch" | "delete"

type Schema = Record<string, unknown>
type Operation = Record<string, unknown>

type RouteDefinition = {
  path: string
  method: HttpMethod
  tag: string
  summary: string
  description?: string
  auth?: boolean
  admin?: boolean
  query?: string[]
  body?: string
  multipart?: boolean
  responses?: Record<string, unknown>
}

const json = "application/json"

const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const successResponse = (description = "Successful response", schema: Schema = schemaRef("ApiResponse")) => ({
  description,
  content: {
    [json]: {
      schema,
    },
  },
})

const errorResponse = (description: string) => ({
  description,
  content: {
    [json]: {
      schema: schemaRef("ErrorResponse"),
    },
  },
})

const requestBody = (schema: Schema, required = true) => ({
  required,
  content: {
    [json]: {
      schema,
    },
  },
})

const multipartRequestBody = (schema: Schema) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema,
    },
  },
})

const listQueryParams = ["page", "limit", "search", "status", "sortBy", "sortOrder"]

const routeDefinitions: RouteDefinition[] = [
  { path: "/activity", method: "get", tag: "Activities", summary: "List activities", query: ["scope"] },
  { path: "/activity", method: "post", tag: "Activities", summary: "Create an activity", auth: true, body: "ActivityInput" },
  { path: "/activity/{id}", method: "get", tag: "Activities", summary: "Get an activity" },
  { path: "/activity/{id}", method: "put", tag: "Activities", summary: "Update an activity", auth: true, body: "ActivityInput" },
  { path: "/activity/{id}", method: "delete", tag: "Activities", summary: "Delete an activity", auth: true },

  { path: "/admin/dashboard", method: "get", tag: "Admin", summary: "Get admin dashboard metrics", auth: true, admin: true },
  { path: "/admin/bookings", method: "get", tag: "Admin", summary: "List bookings for admin review", auth: true, admin: true, query: listQueryParams },
  { path: "/admin/bookings/{id}", method: "patch", tag: "Admin", summary: "Update a booking as admin", auth: true, admin: true, body: "AdminBookingUpdate" },
  { path: "/admin/users", method: "get", tag: "Admin", summary: "List users", auth: true, admin: true, query: listQueryParams },
  { path: "/admin/users/{id}", method: "patch", tag: "Admin", summary: "Update a user account status", auth: true, admin: true, body: "AdminAccountUpdate" },
  { path: "/admin/hosts", method: "get", tag: "Admin", summary: "List hosts", auth: true, admin: true, query: listQueryParams },
  { path: "/admin/hosts/{id}", method: "patch", tag: "Admin", summary: "Update a host account status", auth: true, admin: true, body: "AdminAccountUpdate" },
  { path: "/admin/kyc", method: "get", tag: "Admin", summary: "List KYC submissions", auth: true, admin: true, query: listQueryParams },
  { path: "/admin/kyc/{id}", method: "patch", tag: "Admin", summary: "Approve or reject a KYC submission", auth: true, admin: true, body: "AdminKycDecision" },
  { path: "/admin/listings", method: "get", tag: "Admin", summary: "List travel listings", auth: true, admin: true, query: listQueryParams },
  { path: "/admin/listings/{type}/{id}", method: "patch", tag: "Admin", summary: "Update a listing moderation state", auth: true, admin: true, body: "AdminListingUpdate" },
  { path: "/admin/posts", method: "get", tag: "Admin", summary: "List social posts for moderation", auth: true, admin: true, query: listQueryParams },
  { path: "/admin/payouts", method: "get", tag: "Admin", summary: "List host payouts", auth: true, admin: true, query: listQueryParams },
  { path: "/admin/payouts/{id}", method: "patch", tag: "Admin", summary: "Update a payout", auth: true, admin: true, body: "AdminPayoutUpdate" },

  { path: "/ai", method: "post", tag: "AI", summary: "Create an AI travel assistant response", body: "AiPrompt" },

  { path: "/auth/register", method: "post", tag: "Auth", summary: "Register a user", body: "RegisterRequest", responses: { "201": successResponse("User registered", schemaRef("AuthResponse")) } },
  { path: "/auth/{nextauth}", method: "get", tag: "Auth", summary: "NextAuth handler", description: "Catch-all NextAuth route for providers, callbacks, CSRF, and session endpoints." },
  { path: "/auth/{nextauth}", method: "post", tag: "Auth", summary: "NextAuth handler", description: "Catch-all NextAuth route for provider callbacks and session actions." },
  { path: "/auth/login", method: "post", tag: "Auth", summary: "Login with email and password", body: "LoginRequest", responses: { "200": successResponse("Authenticated", schemaRef("AuthResponse")) } },
  { path: "/auth/login/replace-device", method: "post", tag: "Auth", summary: "Login after replacing an existing device session", body: "ReplaceDeviceLoginRequest", responses: { "200": successResponse("Authenticated", schemaRef("AuthResponse")) } },
  { path: "/auth/google-login", method: "get", tag: "Auth", summary: "Complete Google OAuth login redirect", query: ["token", "email", "name"] },
  { path: "/auth/logout", method: "post", tag: "Auth", summary: "Logout current session", auth: true },
  { path: "/auth/me", method: "get", tag: "Auth", summary: "Get the authenticated user", auth: true, responses: { "200": successResponse("Authenticated user", schemaRef("User")) } },
  { path: "/auth/me", method: "patch", tag: "Auth", summary: "Update the authenticated user", auth: true, body: "UpdateMeRequest" },
  { path: "/auth/devices", method: "get", tag: "Auth", summary: "List authenticated user devices", auth: true },
  { path: "/auth/devices/logout", method: "post", tag: "Auth", summary: "Logout a specific device", auth: true, body: "LogoutDeviceRequest" },
  { path: "/auth/forgot-password", method: "post", tag: "Auth", summary: "Request a password reset email", body: "ForgotPasswordRequest" },
  { path: "/auth/reset-password", method: "post", tag: "Auth", summary: "Reset password using email token", body: "ResetPasswordRequest" },
  { path: "/auth/verify", method: "get", tag: "Auth", summary: "Verify an email address", query: ["email", "token"] },

  { path: "/cron/expire-bookings", method: "get", tag: "Cron", summary: "Expire stale bookings", auth: true },
  { path: "/cron/expire-bookings", method: "post", tag: "Cron", summary: "Expire stale bookings", auth: true },
  { path: "/docs", method: "get", tag: "Documentation", summary: "Open Swagger UI" },
  { path: "/openapi", method: "get", tag: "Documentation", summary: "Get the OpenAPI JSON document" },
  { path: "/forgot-password", method: "post", tag: "Legacy Auth", summary: "Legacy password reset request", body: "ForgotPasswordRequest", deprecated: true } as RouteDefinition,
  { path: "/reset-password", method: "post", tag: "Legacy Auth", summary: "Legacy reset password endpoint", body: "ResetPasswordRequest", deprecated: true } as RouteDefinition,
  { path: "/verify", method: "get", tag: "Legacy Auth", summary: "Legacy email verification endpoint", query: ["email", "token"], deprecated: true } as RouteDefinition,

  { path: "/location/ip", method: "get", tag: "Location", summary: "Resolve city from request IP address" },
  { path: "/location/gps", method: "get", tag: "Location", summary: "Resolve city from GPS coordinates", query: ["lat", "lng"] },

  { path: "/my-bookings", method: "get", tag: "Bookings", summary: "List bookings for the authenticated user", auth: true },

  { path: "/rental", method: "get", tag: "Rentals", summary: "List rentals", query: ["scope"] },
  { path: "/rental", method: "post", tag: "Rentals", summary: "Create a rental", auth: true, body: "RentalInput" },
  { path: "/rental/{id}", method: "get", tag: "Rentals", summary: "Get a rental" },
  { path: "/rental/{id}", method: "put", tag: "Rentals", summary: "Update a rental", auth: true, body: "RentalInput" },
  { path: "/rental/{id}", method: "delete", tag: "Rentals", summary: "Delete a rental", auth: true },

  { path: "/tour", method: "get", tag: "Tours", summary: "List tours", query: ["scope"] },
  { path: "/tour", method: "post", tag: "Tours", summary: "Create a tour", auth: true, body: "TourInput" },
  { path: "/tour/{id}", method: "get", tag: "Tours", summary: "Get a tour by ID or slug" },
  { path: "/tour/{id}", method: "put", tag: "Tours", summary: "Update a tour", auth: true, body: "TourInput" },
  { path: "/tour/{id}", method: "delete", tag: "Tours", summary: "Delete a tour", auth: true },
  { path: "/tour/{id}/announcements", method: "get", tag: "Tour Operations", summary: "List tour announcements" },
  { path: "/tour/{id}/announcements", method: "post", tag: "Tour Operations", summary: "Create a tour announcement", auth: true, body: "TourAnnouncementInput" },
  { path: "/tour/{id}/batches", method: "get", tag: "Tour Operations", summary: "List tour batches" },
  { path: "/tour/{id}/batches", method: "post", tag: "Tour Operations", summary: "Create a tour batch", auth: true, body: "TourBatchInput" },
  { path: "/tour/{id}/booking", method: "post", tag: "Tour Booking", summary: "Create a tour booking", auth: true, body: "TourBookingRequest" },
  { path: "/tour/{id}/booking-intents", method: "post", tag: "Tour Booking", summary: "Create a tour booking intent", auth: true, body: "CreateTourBookingIntent" },
  { path: "/tour/{id}/chat", method: "get", tag: "Tour Chat", summary: "List tour chat messages", auth: true, query: ["scope"] },
  { path: "/tour/{id}/chat", method: "post", tag: "Tour Chat", summary: "Send a tour chat message", auth: true, body: "ChatMessageInput", query: ["scope"] },
  { path: "/tour/{id}/documents", method: "get", tag: "Tour Operations", summary: "List tour documents", query: ["scope"] },
  { path: "/tour/{id}/documents", method: "post", tag: "Tour Operations", summary: "Create a tour document", auth: true, body: "TourDocumentInput" },
  { path: "/tour/{id}/join-request", method: "post", tag: "Tour Joining", summary: "Request to join a tour", auth: true, body: "JoinRequestInput" },
  { path: "/tour/{id}/join-request/{requestId}", method: "patch", tag: "Tour Joining", summary: "Approve or reject a join request", auth: true, body: "JoinRequestDecision" },
  { path: "/tour/{id}/participants", method: "get", tag: "Tour Operations", summary: "List tour participants", auth: true },
  { path: "/tour/{id}/payment/order", method: "post", tag: "Payments", summary: "Create a Razorpay order for a tour booking", auth: true, body: "TourPaymentOrderRequest" },
  { path: "/tour/{id}/payment/verify", method: "post", tag: "Payments", summary: "Verify a tour payment", auth: true, body: "TourPaymentVerifyRequest" },
  { path: "/tour/{id}/reviews", method: "get", tag: "Reviews", summary: "List reviews for a tour" },
  { path: "/tour/{id}/reviews", method: "post", tag: "Reviews", summary: "Create a review for a completed tour", auth: true, body: "ReviewInput", responses: { "201": successResponse("Review created") } },
  { path: "/tour/{id}/validate-traveler", method: "post", tag: "Tour Booking", summary: "Validate traveler uniqueness for a tour", body: "ValidateTravelerRequest" },
  { path: "/tour/{id}/waitlist", method: "post", tag: "Tour Operations", summary: "Join a tour waitlist", auth: true, body: "WaitlistRequest" },
  { path: "/tour-bookings/{bookingId}/cancel", method: "post", tag: "Tour Booking", summary: "Cancel a tour booking or traveler", auth: true, body: "CancelTourBooking" },
  { path: "/tour-bookings/{bookingId}/travelers", method: "post", tag: "Tour Booking", summary: "Add travelers to an existing tour booking", auth: true, body: "AddTourTravelers" },

  { path: "/upload", method: "post", tag: "Uploads", summary: "Upload an image to Cloudinary", auth: true, multipart: true, body: "ImageUploadRequest" },

  { path: "/wishlist", method: "get", tag: "Wishlist", summary: "Get current user's wishlist", auth: true },
  { path: "/wishlist", method: "post", tag: "Wishlist", summary: "Add an item to wishlist", auth: true, body: "WishlistAddRequest" },
  { path: "/wishlist", method: "delete", tag: "Wishlist", summary: "Remove an item from wishlist", auth: true, body: "WishlistRemoveRequest" },
]

function pathParameters(path: string) {
  return Array.from(path.matchAll(/{([^}]+)}/g)).map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }))
}

function queryParameters(names: string[] = []) {
  return names.map((name) => ({
    name,
    in: "query",
    required: false,
    schema: querySchema(name),
  }))
}

function querySchema(name: string) {
  if (["page", "limit"].includes(name)) return { type: "integer", minimum: 1 }
  if (["lat", "lng"].includes(name)) return { type: "number" }
  if (name === "scope") return { type: "string", enum: ["public", "host", "participant"] }
  if (name === "sortOrder") return { type: "string", enum: ["asc", "desc"] }
  return { type: "string" }
}

function operationId(route: RouteDefinition) {
  const cleanPath = route.path
    .replace(/^\//, "")
    .replace(/{([^}]+)}/g, "by-$1")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
  return `${route.method}${cleanPath.charAt(0).toUpperCase()}${cleanPath.slice(1)}`
}

function routeOperation(route: RouteDefinition): Operation {
  const bodySchema = route.body ? schemaRef(route.body) : undefined
  const responses = {
    "200": successResponse(),
    "400": errorResponse("Bad request"),
    ...(route.auth ? { "401": errorResponse("Unauthorized") } : {}),
    ...(route.admin ? { "403": errorResponse("Forbidden") } : {}),
    "404": errorResponse("Not found"),
    "429": errorResponse("Too many requests"),
    "500": errorResponse("Internal server error"),
    ...route.responses,
  }

  return {
    tags: [route.tag],
    summary: route.summary,
    description: route.description,
    operationId: operationId(route),
    deprecated: "deprecated" in route ? true : undefined,
    security: route.auth ? [{ bearerAuth: [] }, { cookieAuth: [] }] : undefined,
    parameters: [...pathParameters(route.path), ...queryParameters(route.query)],
    requestBody: route.multipart
      ? multipartRequestBody(bodySchema ?? schemaRef("ImageUploadRequest"))
      : bodySchema
        ? requestBody(bodySchema)
        : undefined,
    responses,
  }
}

function buildPaths() {
  return routeDefinitions.reduce<Record<string, Record<string, Operation>>>((paths, route) => {
    paths[route.path] = paths[route.path] ?? {}
    paths[route.path][route.method] = routeOperation(route)
    return paths
  }, {})
}

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Travels Pro API",
    version: "1.0.0",
    description:
      "Production OpenAPI contract for the active Next.js API routes under /api. Protected operations accept a bearer token or the app session cookie.",
    contact: {
      name: "Travels Pro Engineering",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Current deployment",
    },
    {
      url: "http://localhost:4000/api",
      description: "Local development",
    },
  ],
  tags: [
    { name: "Auth", description: "Authentication, sessions, profile, and devices" },
    { name: "Legacy Auth", description: "Backward compatible auth endpoints" },
    { name: "Admin", description: "Administrative dashboards and moderation" },
    { name: "Tours", description: "Tour listings and host tour management" },
    { name: "Tour Booking", description: "Tour booking engine and traveler management" },
    { name: "Tour Operations", description: "Batches, waitlists, documents, participants, and announcements" },
    { name: "Tour Joining", description: "Join request workflow" },
    { name: "Tour Chat", description: "Tour participant and host messaging" },
    { name: "Payments", description: "Razorpay order and verification endpoints" },
    { name: "Reviews", description: "Tour reviews" },
    { name: "Rentals", description: "Rental listings" },
    { name: "Activities", description: "Activity listings" },
    { name: "Wishlist", description: "User wishlist management" },
    { name: "Bookings", description: "Unified user booking history" },
    { name: "Uploads", description: "Image upload endpoints" },
    { name: "Location", description: "Location detection helpers" },
    { name: "AI", description: "AI travel assistance" },
    { name: "Cron", description: "Scheduled maintenance endpoints" },
    { name: "Documentation", description: "Swagger UI and OpenAPI document endpoints" },
  ],
  paths: buildPaths(),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        additionalProperties: true,
        properties: {
          success: { type: "boolean" },
          data: {},
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
          message: { type: "string" },
          issues: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["USER", "HOST", "ADMIN"] },
          phone: { type: "string" },
          avatar: { type: "string", format: "uri" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", minLength: 2 },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, format: "password" },
          phone: { type: "string" },
          type: { type: "string", enum: ["user", "host"] },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
          type: { type: "string", enum: ["user", "host", "admin"] },
        },
      },
      ReplaceDeviceLoginRequest: {
        allOf: [
          schemaRef("LoginRequest"),
          {
            type: "object",
            properties: {
              deviceToLogout: { type: "string" },
            },
          },
        ],
      },
      AuthResponse: {
        type: "object",
        properties: {
          user: schemaRef("User"),
          token: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      ForgotPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["email", "token", "password"],
        properties: {
          email: { type: "string", format: "email" },
          token: { type: "string" },
          password: { type: "string", minLength: 8, format: "password" },
        },
      },
      UpdateMeRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          avatar: { type: "string", format: "uri" },
          activateHost: { type: "boolean" },
        },
      },
      LogoutDeviceRequest: {
        type: "object",
        required: ["deviceId"],
        properties: {
          deviceId: { type: "string" },
        },
      },
      AdminAccountUpdate: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BLOCKED", "APPROVED", "REJECTED"] },
          reason: { type: "string" },
        },
      },
      AdminBookingUpdate: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "REFUNDED"] },
          reason: { type: "string" },
          overrideReason: { type: "string" },
        },
      },
      AdminKycDecision: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["approve", "reject"] },
          status: { type: "string", enum: ["APPROVED", "REJECTED", "PENDING"] },
          rejectionReason: { type: "string" },
          reason: { type: "string" },
        },
      },
      AdminListingUpdate: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] },
          reason: { type: "string" },
          isActive: { type: "boolean" },
          title: { type: "string" },
          rooms: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      },
      AdminPayoutUpdate: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED"] },
          transactionId: { type: "string" },
          failureReason: { type: "string" },
          notes: { type: "string" },
        },
      },
      ListingBaseInput: {
        type: "object",
        additionalProperties: true,
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          city: { type: "string" },
          country: { type: "string" },
          price: { type: "number" },
          images: { type: "array", items: { type: "string", format: "uri" } },
          isActive: { type: "boolean" },
        },
      },
      TourInput: {
        allOf: [
          schemaRef("ListingBaseInput"),
          {
            type: "object",
            properties: {
              startDate: { type: "string", format: "date-time" },
              endDate: { type: "string", format: "date-time" },
              duration: { type: "string" },
              maxParticipants: { type: "integer" },
              languages: { type: "array", items: { type: "string" } },
              itinerary: { type: "array", items: schemaRef("ItineraryItem") },
            },
          },
        ],
      },
      ItineraryItem: {
        type: "object",
        properties: {
          day: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          meals: { type: "array", items: { type: "string" } },
          accommodation: { type: "string" },
        },
      },
      RentalInput: {
        allOf: [
          schemaRef("ListingBaseInput"),
          {
            type: "object",
            properties: {
              rooms: { type: "array", items: { type: "object", additionalProperties: true } },
              amenities: { type: "array", items: { type: "string" } },
              propertyType: { type: "string" },
            },
          },
        ],
      },
      ActivityInput: {
        allOf: [
          schemaRef("ListingBaseInput"),
          {
            type: "object",
            properties: {
              category: { type: "string" },
              duration: { type: "string" },
              maxGuests: { type: "integer" },
              includes: { type: "array", items: { type: "string" } },
            },
          },
        ],
      },
      Traveler: {
        type: "object",
        required: ["fullName", "age", "gender", "aadhaar"],
        properties: {
          fullName: { type: "string", minLength: 2 },
          age: { type: "integer", minimum: 1 },
          gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] },
          aadhaar: { type: "string", minLength: 12, maxLength: 12 },
          phone: { type: "string" },
          email: { type: "string", format: "email" },
          status: { type: "string", enum: ["CONFIRMED", "WAITLISTED", "CANCELLED", "REJECTED", "PENDING"] },
        },
      },
      TourBookingRequest: {
        type: "object",
        properties: {
          batchId: { type: "string" },
          travelers: { type: "array", items: schemaRef("Traveler") },
          couponCode: { type: "string" },
          notes: { type: "string" },
        },
      },
      CreateTourBookingIntent: {
        type: "object",
        properties: {
          batchId: { type: "string" },
          travelers: { type: "array", items: schemaRef("Traveler") },
          couponCode: { type: "string" },
        },
      },
      AddTourTravelers: {
        type: "object",
        required: ["travelers"],
        properties: {
          travelers: { type: "array", minItems: 1, items: schemaRef("Traveler") },
        },
      },
      CancelTourBooking: {
        type: "object",
        properties: {
          travelerId: { type: "string" },
          reason: { type: "string" },
        },
      },
      ValidateTravelerRequest: schemaRef("Traveler"),
      TourBatchInput: {
        type: "object",
        properties: {
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          capacity: { type: "integer", minimum: 1 },
          price: { type: "number" },
        },
      },
      WaitlistRequest: {
        type: "object",
        properties: {
          batchId: { type: "string" },
          seatsRequested: { type: "integer", minimum: 1 },
        },
      },
      TourAnnouncementInput: {
        type: "object",
        properties: {
          title: { type: "string" },
          message: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          isPinned: { type: "boolean" },
        },
      },
      TourDocumentInput: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string", format: "uri" },
          documentType: { type: "string" },
          visibility: { type: "string", enum: ["public", "participant", "host"] },
        },
      },
      JoinRequestInput: {
        type: "object",
        properties: {
          introduction: { type: "string" },
        },
      },
      JoinRequestDecision: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["approve", "reject"] },
        },
      },
      ChatMessageInput: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", minLength: 1 },
        },
      },
      TourPaymentOrderRequest: {
        type: "object",
        required: ["bookingId"],
        properties: {
          bookingId: { type: "string" },
        },
      },
      TourPaymentVerifyRequest: {
        type: "object",
        required: ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"],
        properties: {
          bookingId: { type: "string" },
          razorpay_order_id: { type: "string" },
          razorpay_payment_id: { type: "string" },
          razorpay_signature: { type: "string" },
        },
      },
      ReviewInput: {
        type: "object",
        required: ["rating", "comment"],
        properties: {
          rating: { type: "integer", minimum: 1, maximum: 5 },
          comment: { type: "string", minLength: 1 },
        },
      },
      WishlistAddRequest: {
        type: "object",
        required: ["target"],
        properties: {
          target: { type: "string", enum: ["tour", "rental", "activity"] },
          tourId: { type: "string" },
          tourSlug: { type: "string" },
          rentalId: { type: "string" },
          activityId: { type: "string" },
        },
      },
      WishlistRemoveRequest: {
        type: "object",
        properties: {
          id: { type: "string" },
          target: { type: "string", enum: ["tour", "rental", "activity"] },
          tourId: { type: "string" },
          rentalId: { type: "string" },
          activityId: { type: "string" },
        },
      },
      ImageUploadRequest: {
        type: "object",
        required: ["file"],
        properties: {
          file: {
            type: "string",
            format: "binary",
            description: "Image file. Supported MIME types: image/jpeg, image/png, image/webp.",
          },
        },
      },
      AiPrompt: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
          context: { type: "object", additionalProperties: true },
        },
      },
    },
  },
} as const

export type OpenApiDocument = typeof openApiDocument
