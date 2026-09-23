import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { requiredEnv } from "@/lib/env"

function key() {
  return createHash("sha256").update(requiredEnv("KYC_ENCRYPTION_KEY")).digest()
}

export function encryptSensitiveField(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const ciphertext = Buffer.concat([cipher.update(value.trim(), "utf8"), cipher.final()])
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`
}

export function decryptSensitiveField(value: string) {
  if (!value.startsWith("enc:v1:")) return value
  const [, , iv, tag, ciphertext] = value.split(":")
  if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted field")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
}

export function maskIdentityNumber(value: string) {
  const clean = value.replace(/\s+/g, "")
  return `${"•".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`
}
