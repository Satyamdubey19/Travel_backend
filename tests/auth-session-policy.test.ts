import assert from "node:assert/strict"
import test from "node:test"
import { isSessionTokenInvalidated } from "@/modules/auth/services/auth-session-policy"

test("session tokens use their signed millisecond issue time after account invalidation", () => {
  const invalidatedAt = new Date("2026-09-12T12:00:00.500Z")

  assert.equal(isSessionTokenInvalidated({ issuedAtMs: invalidatedAt.getTime() - 1 }, invalidatedAt), true)
  assert.equal(isSessionTokenInvalidated({ issuedAtMs: invalidatedAt.getTime() }, invalidatedAt), true)
  assert.equal(isSessionTokenInvalidated({ issuedAtMs: invalidatedAt.getTime() + 1 }, invalidatedAt), false)
})

test("legacy JWT timing is rejected conservatively after account invalidation", () => {
  const invalidatedAt = new Date("2026-09-12T12:00:00.500Z")

  assert.equal(isSessionTokenInvalidated({ iat: 1_789_213_599 }, invalidatedAt), true)
  assert.equal(isSessionTokenInvalidated({}, invalidatedAt), true)
  assert.equal(isSessionTokenInvalidated({}, null), false)
})
