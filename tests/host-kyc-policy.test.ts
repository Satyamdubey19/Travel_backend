import assert from "node:assert/strict"
import test from "node:test"
import { decryptSensitiveField, encryptSensitiveField, maskIdentityNumber } from "@/lib/field-encryption"
import { hostKycSchema } from "@/modules/host/services/host-kyc.service"
import { resolveKycDecision } from "@/modules/host/services/kyc-policy"

test("identity values are encrypted with authenticated encryption and masked", () => {
  const previous = process.env.KYC_ENCRYPTION_KEY
  process.env.KYC_ENCRYPTION_KEY = "local-test-only-key-with-more-than-thirty-two-characters"
  try {
    const encrypted = encryptSensitiveField("123456789012")
    assert.notEqual(encrypted, "123456789012")
    assert.match(encrypted, /^enc:v1:/)
    assert.equal(decryptSensitiveField(encrypted), "123456789012")
    assert.equal(maskIdentityNumber("123456789012"), "••••••••9012")
  } finally {
    if (previous === undefined) delete process.env.KYC_ENCRYPTION_KEY
    else process.env.KYC_ENCRYPTION_KEY = previous
  }
})

test("host KYC validation enforces adult age, Aadhaar format, and private asset references", () => {
  const base = {
    firstName: "Aarav",
    lastName: "Sharma",
    dateOfBirth: "1995-04-12",
    nationality: "Indian",
    idType: "aadhaar",
    idNumber: "123456789012",
    idFrontImage: "travels-pro/kyc/host/front.pdf",
  }
  assert.equal(hostKycSchema.parse(base).idType, "aadhaar")
  assert.throws(() => hostKycSchema.parse({ ...base, idNumber: "1234" }))
  assert.throws(() => hostKycSchema.parse({ ...base, dateOfBirth: new Date().toISOString().slice(0, 10) }))
  assert.throws(() => hostKycSchema.parse({ ...base, idFrontImage: "https://public.example/id.jpg" }))
})

test("KYC decisions require reasons and make resubmission explicit", () => {
  assert.deepEqual(resolveKycDecision({ action: "approve" }), {
    status: "APPROVED",
    rejectionReason: null,
    resubmissionAllowed: false,
  })
  assert.throws(() => resolveKycDecision({ action: "reject" }), /reason/i)
  assert.equal(resolveKycDecision({ action: "request_changes", rejectionReason: "Upload a clearer image" }).resubmissionAllowed, true)
})
