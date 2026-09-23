import assert from "node:assert/strict"
import test from "node:test"
import { credentialReauthenticationFailure } from "@/modules/auth/services/auth-credential-policy"

test("sensitive credential-account changes require a valid current password", () => {
  assert.deepEqual(credentialReauthenticationFailure({ provider: "credentials", hasPassword: true, passwordIsValid: true }), null)
  assert.deepEqual(credentialReauthenticationFailure({ provider: "credentials", hasPassword: true, passwordIsValid: false }), {
    message: "Current password is incorrect",
    statusCode: 401,
  })
})

test("social or passwordless identities cannot be moved with a browser password form", () => {
  assert.deepEqual(credentialReauthenticationFailure({ provider: "google", hasPassword: false, passwordIsValid: false }), {
    message: "Change your password through your sign-in provider",
    statusCode: 400,
  })
  assert.deepEqual(credentialReauthenticationFailure({ provider: "google", hasPassword: true, passwordIsValid: true }), {
    message: "Change your password through your sign-in provider",
    statusCode: 400,
  })
})
