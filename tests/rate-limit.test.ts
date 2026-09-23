import assert from "node:assert/strict"
import test from "node:test"
import { isRateLimitExceeded } from "@/lib/rate-limit"

test("only rate-limiter quota responses are classified as a client throttle", () => {
  assert.equal(isRateLimitExceeded({ msBeforeNext: 1_000, remainingPoints: 0 }), true)
  assert.equal(isRateLimitExceeded(new Error("Stream is not writeable")), false)
  assert.equal(isRateLimitExceeded({ code: "ECONNREFUSED" }), false)
  assert.equal(isRateLimitExceeded(null), false)
})
