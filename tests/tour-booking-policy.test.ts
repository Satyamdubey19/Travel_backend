import assert from "node:assert/strict"
import test from "node:test"
import { calculateRefundPercent } from "@/modules/tour/services/tour-booking-engine.service"
import { createTourBookingIntentSchema } from "@/modules/tour/validators/tour-booking.validators"

test("refund policy has clear India-MVP boundary conditions", () => {
  const now = new Date("2026-01-01T12:00:00.000Z")
  assert.equal(calculateRefundPercent(new Date("2026-02-05T12:00:00.000Z"), now), 100)
  assert.equal(calculateRefundPercent(new Date("2026-01-21T12:00:00.000Z"), now), 75)
  assert.equal(calculateRefundPercent(new Date("2026-01-10T12:00:00.000Z"), now), 50)
  assert.equal(calculateRefundPercent(new Date("2026-01-02T11:59:00.000Z"), now), 0)
})

test("booking intent rejects empty traveler data before it reaches a transaction", () => {
  assert.throws(() => createTourBookingIntentSchema.parse({ contactName: "A", contactEmail: "a@example.com", contactPhone: "9999999999", travelers: [] }))
})

test("booking intent requires an explicit risk acknowledgement", () => {
  const input = {
    contactName: "Traveler Name",
    contactEmail: "traveler@example.com",
    contactPhone: "9999999999",
    travelers: [{ fullName: "Traveler Name", age: 25, aadhaar: "234567890123" }],
  }
  assert.throws(() => createTourBookingIntentSchema.parse(input))
  assert.doesNotThrow(() => createTourBookingIntentSchema.parse({ ...input, riskAcknowledged: true }))
})
