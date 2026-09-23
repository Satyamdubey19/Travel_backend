import assert from "node:assert/strict"
import test from "node:test"
import { assertRefundApproval, assertRefundExecution, assertRefundRejection } from "@/modules/admin/services/refund-policy"

test("refund approval cannot exceed the captured request and is review-only", () => {
  assert.doesNotThrow(() => assertRefundApproval("REVIEW_PENDING", 5000, 3500))
  assert.throws(() => assertRefundApproval("REVIEW_PENDING", 5000, 5001), /cannot exceed/)
  assert.throws(() => assertRefundApproval("COMPLETED", 5000, 1000), /cannot be approved/)
})

test("refund rejection requires an auditable reason", () => {
  assert.doesNotThrow(() => assertRefundRejection("REVIEW_PENDING", "Outside published policy"))
  assert.throws(() => assertRefundRejection("REVIEW_PENDING", "no"), /reason/)
  assert.throws(() => assertRefundRejection("APPROVED", "Changed decision"), /cannot be rejected/)
})

test("refund execution requires approval evidence and captured payment", () => {
  assert.doesNotThrow(() => assertRefundExecution("APPROVED", 2500, "pay_123"))
  assert.doesNotThrow(() => assertRefundExecution("FAILED", 2500, "pay_123"))
  assert.throws(() => assertRefundExecution("REVIEW_PENDING", 2500, "pay_123"), /cannot execute/)
  assert.throws(() => assertRefundExecution("APPROVED", 2500, null), /payment reference/)
})
