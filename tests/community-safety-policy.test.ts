import assert from "node:assert/strict"
import test from "node:test"
import { validateBlock, validateMessageReport, validateReportDecision } from "../modules/community/services/community-safety-policy"

test("blocking rejects self and malformed targets", () => {
  assert.equal(validateBlock("user-a", "user-b"), "user-b")
  assert.throws(() => validateBlock("user-a", "user-a"), /cannot block yourself/)
  assert.throws(() => validateBlock("user-a", {}), /traveler is required/)
})

test("message reports require a supported reason and bounded context", () => {
  assert.deepEqual(validateMessageReport({ reason: "harassment", details: "Repeated threatening messages" }), {
    reason: "HARASSMENT",
    details: "Repeated threatening messages",
  })
  assert.throws(() => validateMessageReport({ reason: "other" }), /explain/)
  assert.throws(() => validateMessageReport({ reason: "not-a-reason" }), /supported/)
  assert.throws(() => validateMessageReport({ reason: "HARASSMENT", details: "short" }), /between 10/)
})

test("message moderation transitions are ordered and auditable", () => {
  assert.deepEqual(validateReportDecision("OPEN", { status: "in_review", resolutionNotes: "Assigned to safety desk" }), {
    status: "IN_REVIEW",
    resolutionNotes: "Assigned to safety desk",
  })
  assert.throws(() => validateReportDecision("ACTIONED", { status: "DISMISSED", resolutionNotes: "This is long enough to otherwise be accepted." }), /cannot move/)
  assert.throws(() => validateReportDecision("OPEN", { status: "ACTIONED", resolutionNotes: "Too short" }), /between 30/)
})
