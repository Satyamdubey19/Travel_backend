import assert from "node:assert/strict"
import test from "node:test"
import { calculateRefundAmount, calculateRefundPercent } from "../modules/tour/services/tour-cancellation-policy"

const now = new Date("2026-09-10T00:00:00.000Z")

test("refund policy honors every time boundary", () => {
  assert.equal(calculateRefundPercent(new Date("2026-10-11T00:00:01.000Z"), now), 100)
  assert.equal(calculateRefundPercent(new Date("2026-10-10T00:00:00.000Z"), now), 75)
  assert.equal(calculateRefundPercent(new Date("2026-09-25T00:00:00.000Z"), now), 75)
  assert.equal(calculateRefundPercent(new Date("2026-09-17T00:00:00.000Z"), now), 50)
  assert.equal(calculateRefundPercent(new Date("2026-09-11T00:00:00.000Z"), now), 0)
  assert.equal(calculateRefundPercent(new Date("2026-09-10T23:59:59.000Z"), now), 0)
})

test("refund amount supports whole and single-traveler cancellation", () => {
  assert.equal(calculateRefundAmount(12000, 3, 50, false), 6000)
  assert.equal(calculateRefundAmount(12000, 3, 50, true), 2000)
  assert.equal(calculateRefundAmount(999.99, 2, 75, true), 375)
})

test("refund amount rejects invalid financial inputs", () => {
  assert.throws(() => calculateRefundAmount(-1, 1, 50, false), /Invalid booking amount/)
  assert.throws(() => calculateRefundAmount(1000, 0, 50, false), /Invalid traveler count/)
  assert.throws(() => calculateRefundAmount(1000, 1, 101, false), /Invalid refund percentage/)
})
