import assert from "node:assert/strict";
import test from "node:test";
import { authLoginRecoveryPath, safeAuthCallbackPath } from "@/modules/auth/services/auth-redirect";

test("Google handoff callback paths stay inside the public application", () => {
  assert.equal(safeAuthCallbackPath("/host"), "/host");
  assert.equal(safeAuthCallbackPath("//external.example"), "/");
  assert.equal(safeAuthCallbackPath("https://external.example"), "/");
  assert.equal(safeAuthCallbackPath("/api/admin/dashboard"), "/");
  assert.equal(safeAuthCallbackPath("/_next/data"), "/");
});

test("Google handoff recovery uses controlled login error codes", () => {
  assert.equal(
    authLoginRecoveryPath("/host", "GOOGLE_SIGNIN_FAILED"),
    "/login?callbackUrl=%2Fhost&error=GOOGLE_SIGNIN_FAILED",
  );
});
