import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import { hasValidHmacSha256 } from "@/lib/payment-signature"

test("payment webhook verification uses the exact raw body", () => {
  const secret = "test-webhook-secret"
  const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1"}}}}'
  const signature = createHmac("sha256", secret).update(body).digest("hex")
  assert.equal(hasValidHmacSha256(body, signature, [secret]), true)
  assert.equal(hasValidHmacSha256(`${body} `, signature, [secret]), false)
  assert.equal(hasValidHmacSha256(body, "not-a-signature", [secret]), false)
})
