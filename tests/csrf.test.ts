import assert from "node:assert/strict"
import test from "node:test"
import { isCsrfExemptPath, isPublicAuthEndpoint, isTrustedMutationOrigin } from "@/lib/csrf"

test("safe reads do not require an origin", () => {
  assert.equal(isTrustedMutationOrigin(new Request("https://api.example.in/api/tours")), true)
})

test("mutations reject absent and hostile origins", () => {
  assert.equal(isTrustedMutationOrigin(new Request("https://api.example.in/api/tours", { method: "POST" })), false)
  assert.equal(isTrustedMutationOrigin(new Request("https://api.example.in/api/tours", { method: "POST", headers: { origin: "https://evil.example" } })), false)
})

test("mutations accept the same origin", () => {
  assert.equal(isTrustedMutationOrigin(new Request("https://api.example.in/api/tours", { method: "POST", headers: { origin: "https://api.example.in" } })), true)
})

test("only signed or framework-managed integrations are exempt", () => {
  assert.equal(isCsrfExemptPath("/api/auth/callback/google"), true)
  assert.equal(isCsrfExemptPath("/api/cron/expire-bookings"), true)
  assert.equal(isCsrfExemptPath("/api/tour/123"), false)
})

test("NextAuth public endpoints remain reachable before first-party login", () => {
  for (const path of [
    "/api/auth/providers",
    "/api/auth/session",
    "/api/auth/csrf",
    "/api/auth/signin/google",
    "/api/auth/callback/google",
    "/api/auth/google-login",
    "/api/auth/verify",
  ]) {
    assert.equal(isPublicAuthEndpoint(path), true, path)
  }
  assert.equal(isPublicAuthEndpoint("/api/auth/me"), false)
  assert.equal(isPublicAuthEndpoint("/api/admin/dashboard"), false)
})
