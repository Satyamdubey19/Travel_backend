import assert from "node:assert/strict"
import test from "node:test"
import { readCookie, requireChatMessage, requireTourKey, SocketRateLimiter } from "../lib/socket-security"

test("socket auth reads only the named cookie and safely decodes it", () => {
  assert.equal(readCookie("deviceId=other; token=signed%2Ejwt%2Evalue; refreshToken=secret", "token"), "signed.jwt.value")
  assert.equal(readCookie("not-token=value", "token"), null)
  assert.equal(readCookie(undefined, "token"), null)
})

test("tour keys reject objects, path traversal, and oversized values", () => {
  assert.equal(requireTourKey("safe-tour_2026"), "safe-tour_2026")
  assert.throws(() => requireTourKey({ toString: () => "tour" }), /valid tour/)
  assert.throws(() => requireTourKey("../admin"), /valid tour/)
  assert.throws(() => requireTourKey("x".repeat(161)), /valid tour/)
})

test("chat messages are trimmed and constrained", () => {
  assert.equal(requireChatMessage("  Hello group  "), "Hello group")
  assert.throws(() => requireChatMessage("   "), /required/)
  assert.throws(() => requireChatMessage("x".repeat(2001)), /too long/)
})

test("socket rate limits are isolated and resettable", () => {
  const limiter = new SocketRateLimiter()
  assert.equal(limiter.consume("socket:message", 2, 1_000, 1_000), true)
  assert.equal(limiter.consume("socket:message", 2, 1_000, 1_100), true)
  assert.equal(limiter.consume("socket:message", 2, 1_000, 1_200), false)
  assert.equal(limiter.consume("other:message", 2, 1_000, 1_200), true)
  limiter.clear("socket:")
  assert.equal(limiter.consume("socket:message", 2, 1_000, 1_200), true)
})
