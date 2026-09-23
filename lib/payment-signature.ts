import { createHmac, timingSafeEqual } from "node:crypto"

export function hasValidHmacSha256(rawBody: string, signature: string, secrets: string[]) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const actual = Buffer.from(signature, "hex")
  return secrets.filter(Boolean).some(secret => {
    const expected = createHmac("sha256", secret).update(rawBody).digest()
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })
}
