import assert from "node:assert/strict";
import test from "node:test";
import { authErrorResponse } from "@/modules/auth/services/auth-error";

test("authentication infrastructure failures do not expose implementation details", () => {
  const result = authErrorResponse(
    Object.assign(new Error("Prisma query failed for PasswordResetToken"), { code: "P2021" }),
    400,
    "Unable to send a password-reset link right now. Please try again shortly.",
  );

  assert.deepEqual(result, {
    status: 503,
    message: "Unable to send a password-reset link right now. Please try again shortly.",
  });
});

test("authentication errors retain deliberate client-safe messages and status codes", () => {
  assert.deepEqual(
    authErrorResponse(Object.assign(new Error("Incorrect email or password"), { statusCode: 401 })),
    { status: 401, message: "Incorrect email or password" },
  );
});
