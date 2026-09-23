import assert from "node:assert/strict"
import test from "node:test"
import {
  assertAuthEmailDeliveryConfigured,
  isAuthEmailDeliveryConfigured,
} from "@/lib/auth-email-policy"

test("required verification and recovery email delivery never has a success-without-mail configuration", () => {
  assert.equal(isAuthEmailDeliveryConfigured({}), false)
  assert.equal(isAuthEmailDeliveryConfigured({ BREVO_API_KEY: "your_brevo_key" }), false)
  assert.equal(isAuthEmailDeliveryConfigured({ BREVO_API_KEY: "development-key", BREVO_FROM_EMAIL: "Travels Pro <accounts@example.com>" }), true)
  assert.equal(isAuthEmailDeliveryConfigured({ NODE_ENV: "production", BREVO_API_KEY: "production-key" }), false)
  assert.equal(isAuthEmailDeliveryConfigured({ NODE_ENV: "production", BREVO_API_KEY: "production-key", BREVO_FROM_EMAIL: "Travels Pro <accounts@example.com>" }), true)
})

test("missing mandatory auth email delivery is a controlled service-unavailable failure", () => {
  assert.throws(
    () => assertAuthEmailDeliveryConfigured({}),
    (error: unknown) => Boolean(
      error
      && typeof error === "object"
      && "statusCode" in error
      && (error as { statusCode?: unknown }).statusCode === 503,
    ),
  )
})
