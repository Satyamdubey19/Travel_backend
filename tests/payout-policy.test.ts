import assert from "node:assert/strict"
import test from "node:test"
import { assertPayoutTransition } from "../modules/admin/services/payout-policy"

test("payout completion requires processing state and transaction evidence", () => {
  assert.throws(() => assertPayoutTransition({ currentStatus: "PENDING", nextStatus: "COMPLETED", transactionId: "bank-ref" }), /cannot move/)
  assert.throws(() => assertPayoutTransition({ currentStatus: "PROCESSING", nextStatus: "COMPLETED" }), /Transaction ID/)
  assert.doesNotThrow(() => assertPayoutTransition({ currentStatus: "PROCESSING", nextStatus: "COMPLETED", transactionId: "bank-ref" }))
})

test("failed payouts require a reason and may be retried", () => {
  assert.throws(() => assertPayoutTransition({ currentStatus: "PROCESSING", nextStatus: "FAILED" }), /Failure reason/)
  assert.doesNotThrow(() => assertPayoutTransition({ currentStatus: "PROCESSING", nextStatus: "FAILED", failureReason: "Beneficiary rejected" }))
  assert.doesNotThrow(() => assertPayoutTransition({ currentStatus: "FAILED", nextStatus: "PROCESSING" }))
})

test("completed payouts are terminal", () => {
  assert.throws(() => assertPayoutTransition({ currentStatus: "COMPLETED", nextStatus: "PROCESSING" }), /cannot move/)
})
