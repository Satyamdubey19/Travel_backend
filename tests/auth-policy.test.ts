import assert from "node:assert/strict"
import test from "node:test"
import {
  accountAuthenticationBlockReason,
  accountCanAuthenticate,
  accountCanVerifyEmail,
  credentialLoginBlockReason,
  hasApprovedHostAccess,
} from "@/modules/auth/services/auth-policy"

test("account authentication only permits active, non-banned accounts", () => {
  assert.equal(accountCanAuthenticate({ status: "ACTIVE", isActive: true, isBanned: false }), true)
  assert.equal(accountAuthenticationBlockReason({ status: "SUSPENDED", isActive: true }), "Account is not allowed to authenticate")
  assert.equal(accountCanAuthenticate({ isActive: false }), false)
  assert.equal(accountCanAuthenticate({ isBanned: true }), false)
  assert.equal(accountCanAuthenticate({ deletedAt: new Date() }), false)
})

test("email verification never revives a banned or deleted account", () => {
  assert.equal(accountCanVerifyEmail({ status: "PENDING", isActive: true }), true)
  assert.equal(accountCanVerifyEmail({ status: "BANNED", isActive: true }), false)
  assert.equal(accountCanVerifyEmail({ status: "DELETED", isActive: true }), false)
  assert.equal(accountCanVerifyEmail({ isBanned: true }), false)
})

test("invalid credentials never reveal account verification, lock, or restriction state", () => {
  const lockedUntil = new Date("2030-01-01T00:00:00.000Z")
  const now = new Date("2029-01-01T00:00:00.000Z").getTime()

  assert.equal(credentialLoginBlockReason({ status: "PENDING", isEmailVerified: false }, false, now), "Incorrect email or password")
  assert.equal(credentialLoginBlockReason({ status: "SUSPENDED", isEmailVerified: true }, false, now), "Incorrect email or password")
  assert.equal(credentialLoginBlockReason({ status: "ACTIVE", isEmailVerified: true, lockedUntil }, false, now), "Incorrect email or password")
})

test("correct credentials receive only the relevant account recovery guidance", () => {
  const lockedUntil = new Date("2030-01-01T00:00:00.000Z")
  const now = new Date("2029-01-01T00:00:00.000Z").getTime()

  assert.equal(credentialLoginBlockReason({ status: "SUSPENDED", isEmailVerified: true }, true, now), "Account is not allowed to authenticate")
  assert.equal(credentialLoginBlockReason({ status: "ACTIVE", isEmailVerified: true, lockedUntil }, true, now), "Account is temporarily locked. Try again later.")
  assert.equal(credentialLoginBlockReason({ status: "PENDING", isEmailVerified: false }, true, now), "Please verify your email before logging in")
  assert.equal(credentialLoginBlockReason({ status: "ACTIVE", isEmailVerified: false }, true, now), "Please verify your email before logging in")
})

test("host workspace access requires server role and every approval predicate", () => {
  assert.equal(hasApprovedHostAccess({ role: "HOST", isActive: true, isApproved: true, isVerified: true }), true)
  assert.equal(hasApprovedHostAccess({ role: "USER", isActive: true, isApproved: true, isVerified: true }), false)
  assert.equal(hasApprovedHostAccess({ role: "HOST", isActive: true, isApproved: false, isVerified: true }), false)
  assert.equal(hasApprovedHostAccess({ role: "HOST", isActive: false, isApproved: true, isVerified: true }), false)
  assert.equal(hasApprovedHostAccess(null), false)
})
