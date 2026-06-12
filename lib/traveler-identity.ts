import { createHmac, timingSafeEqual } from "crypto"
export { aadhaarLast4, isValidAadhaar, maskAadhaar, normalizeAadhaar, normalizeTravelerName } from "@/lib/traveler-normalization"
import { normalizeAadhaar } from "@/lib/traveler-normalization"

function aadhaarSecret() {
  const secret = process.env.AADHAAR_HASH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || process.env.DATABASE_URL
  if (!secret) {
    throw new Error("Aadhaar hashing secret is not configured")
  }
  return secret
}

export function hashAadhaar(aadhaar: string) {
  const normalized = normalizeAadhaar(aadhaar)
  if (!/^\d{12}$/.test(normalized)) {
    throw new Error("Aadhaar must be 12 digits")
  }
  return createHmac("sha256", aadhaarSecret()).update(normalized).digest("hex")
}

export function safeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
