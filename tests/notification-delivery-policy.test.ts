import assert from "node:assert/strict"
import test from "node:test"
import {
  NOTIFICATION_MAX_ATTEMPTS,
  canReplayNotificationDelivery,
  notificationBackoffMs,
  notificationFailureStatus,
  sanitizeDeliveryError,
} from "../modules/notification/services/notification-delivery-policy"

test("notification delivery uses bounded exponential backoff", () => {
  assert.equal(notificationBackoffMs(1), 60_000)
  assert.equal(notificationBackoffMs(2), 120_000)
  assert.equal(notificationBackoffMs(3), 240_000)
  assert.equal(notificationBackoffMs(99), 6 * 60 * 60 * 1000)
})

test("notification delivery dead-letters only at the attempt limit", () => {
  assert.equal(notificationFailureStatus(NOTIFICATION_MAX_ATTEMPTS - 1), "FAILED")
  assert.equal(notificationFailureStatus(NOTIFICATION_MAX_ATTEMPTS), "DEAD_LETTER")
})

test("delivery errors are single-line and bounded before persistence", () => {
  const sanitized = sanitizeDeliveryError(new Error(`provider\nsecret\t${"x".repeat(600)}`))
  assert.equal(sanitized.includes("\n"), false)
  assert.equal(sanitized.includes("\t"), false)
  assert.equal(sanitized.length, 500)
})

test("only failed delivery states are eligible for an audited replay", () => {
  assert.equal(canReplayNotificationDelivery("FAILED"), true)
  assert.equal(canReplayNotificationDelivery("DEAD_LETTER"), true)
  assert.equal(canReplayNotificationDelivery("PENDING"), false)
  assert.equal(canReplayNotificationDelivery("PROCESSING"), false)
  assert.equal(canReplayNotificationDelivery("DELIVERED"), false)
})
