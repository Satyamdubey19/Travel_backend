import assert from "node:assert/strict"
import test from "node:test"
import { calculateRentalDays, calculateRentalTotal, parseRentalDate, rentalBookingKey } from "@/modules/rental/services/rental-booking-policy"

test("rental idempotency keys are scoped to traveler and listing", () => {
  assert.notEqual(rentalBookingKey("user-a", "rental-a", "same-client-key"), rentalBookingKey("user-b", "rental-a", "same-client-key"))
  assert.notEqual(rentalBookingKey("user-a", "rental-a", "same-client-key"), rentalBookingKey("user-a", "rental-b", "same-client-key"))
})

test("rental dates use an exclusive return date and reject invalid ranges", () => {
  const pickup = parseRentalDate("2026-10-10")
  const returns = parseRentalDate("2026-10-13")
  assert.equal(calculateRentalDays(pickup, returns, new Date("2026-10-01T12:00:00Z")), 3)
  assert.throws(() => calculateRentalDays(returns, pickup, new Date("2026-10-01T12:00:00Z")), /Return date/)
  assert.throws(() => parseRentalDate("2026-02-30"), /Invalid rental date/)
})

test("rental totals are calculated only from server price and duration", () => {
  assert.equal(calculateRentalTotal(1499.99, 3), 4499.97)
  assert.throws(() => calculateRentalTotal(-1, 2), /Invalid rental price/)
  assert.throws(() => calculateRentalTotal(1000, 0), /Invalid rental duration/)
})
