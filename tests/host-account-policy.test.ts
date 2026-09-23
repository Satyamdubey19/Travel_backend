import assert from "node:assert/strict"
import test from "node:test"
import { resolveHostAccountUpdate } from "@/modules/admin/services/host-account-policy"

const approvedHost = { isApproved: true, isVerified: true, kycStatus: "APPROVED" }

test("host activation is unavailable until the KYC review is fully approved", () => {
  assert.throws(
    () => resolveHostAccountUpdate("ACTIVE", { isApproved: false, isVerified: true, kycStatus: "APPROVED" }, "USER"),
    { message: "Host must pass KYC before activation" },
  )
  assert.throws(
    () => resolveHostAccountUpdate("ACTIVE", { isApproved: true, isVerified: false, kycStatus: "APPROVED" }, "USER"),
    { message: "Host must pass KYC before activation" },
  )
  assert.throws(
    () => resolveHostAccountUpdate("ACTIVE", { isApproved: true, isVerified: true, kycStatus: "PENDING" }, "USER"),
    { message: "Host must pass KYC before activation" },
  )
})

test("only an approved host recovery restores the HOST role and workspace state", () => {
  assert.deepEqual(resolveHostAccountUpdate("ACTIVE", approvedHost, "USER"), {
    hostIsActive: true,
    userStatus: "ACTIVE",
    userRole: "HOST",
    invalidateSession: false,
  })
  assert.deepEqual(resolveHostAccountUpdate("SUSPENDED", approvedHost, "HOST"), {
    hostIsActive: false,
    userStatus: "SUSPENDED",
    userRole: "HOST",
    invalidateSession: true,
  })
})
