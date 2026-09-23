import assert from "node:assert/strict"
import test from "node:test"
import { readinessOutcome } from "../modules/health/health-policy"
import { isAuthSchemaReady } from "../modules/health/auth-schema-policy"

test("readiness always requires the primary database", () => {
  assert.deepEqual(readinessOutcome("unavailable", "ok", true), { ready: false, status: "not_ready" })
})

test("production readiness requires Redis", () => {
  assert.equal(readinessOutcome("ok", "unavailable", true).ready, false)
  assert.equal(readinessOutcome("ok", "not_configured", true).ready, false)
  assert.equal(readinessOutcome("ok", "ok", true).ready, true)
})

test("local readiness reports database health without requiring optional Redis", () => {
  assert.deepEqual(readinessOutcome("ok", "not_configured", false), { ready: true, status: "ready" })
})

test("readiness fails closed when secure authentication storage is incomplete", () => {
  assert.deepEqual(readinessOutcome("ok", "ok", true, "unavailable"), { ready: false, status: "not_ready" })
  assert.equal(isAuthSchemaReady({
    refreshTokenHash: true,
    passwordResetTokenTable: true,
    passwordResetTokenHash: true,
    sessionDeviceId: true,
    userDeviceRefreshTokenHash: true,
    userSessionInvalidatedAt: true,
    emailChangeRequestTable: true,
    emailChangeRequestHash: true,
    emailChangeRequestComplete: true,
  }), true)
  assert.equal(isAuthSchemaReady({
    refreshTokenHash: false,
    passwordResetTokenTable: true,
    passwordResetTokenHash: true,
    sessionDeviceId: true,
    userDeviceRefreshTokenHash: true,
    userSessionInvalidatedAt: true,
    emailChangeRequestTable: true,
    emailChangeRequestHash: true,
    emailChangeRequestComplete: false,
  }), false)
})

test("readiness fails closed when verification and recovery email delivery is unavailable", () => {
  assert.deepEqual(readinessOutcome("ok", "not_configured", false, "ok", "not_configured"), { ready: false, status: "not_ready" })
  assert.deepEqual(readinessOutcome("ok", "not_configured", false, "ok", "ok"), { ready: true, status: "ready" })
})
