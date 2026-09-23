import assert from "node:assert/strict"
import test from "node:test"
import { activityBookingKey, assertAdvanceActivityDate, calculateActivityBookingTotal } from "../modules/activity/services/activity-booking-policy"

test("activity idempotency keys are isolated by user and activity", () => {
  assert.notEqual(activityBookingKey("u1", "a1", "retry-key"), activityBookingKey("u2", "a1", "retry-key"))
  assert.notEqual(activityBookingKey("u1", "a1", "retry-key"), activityBookingKey("u1", "a2", "retry-key"))
  assert.equal(activityBookingKey("u1", "a1", "retry-key"), activityBookingKey("u1", "a1", "retry-key"))
})

test("activity total is server-calculated and rounded", () => {
  assert.equal(calculateActivityBookingTotal(999.995, 2), 1999.99)
  assert.throws(() => calculateActivityBookingTotal(-1, 2), /Invalid activity price/)
  assert.throws(() => calculateActivityBookingTotal(500, 0), /Invalid guest count/)
})

test("activity checkout enforces an advance-booking cutoff", () => {
  const now = new Date(2026, 8, 10, 15, 0, 0)
  assert.throws(() => assertAdvanceActivityDate(new Date(2026, 8, 10), now), /Same-day or past/)
  assert.doesNotThrow(() => assertAdvanceActivityDate(new Date(2026, 8, 11), now))
})
