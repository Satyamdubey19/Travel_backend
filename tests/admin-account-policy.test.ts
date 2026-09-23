import assert from "node:assert/strict"
import test from "node:test"
import { assertAdminAccountStatusChange } from "../modules/admin/services/admin-account-policy"

const base = {
  actorId: "admin-a",
  targetId: "user-b",
  targetRole: "USER" as const,
  currentStatus: "ACTIVE" as const,
  nextStatus: "SUSPENDED" as const,
  reason: "Repeated safety-policy violations",
  activeAdminCount: 2,
}

test("admin account policy requires a reason for restrictions", () => {
  assert.throws(() => assertAdminAccountStatusChange({ ...base, reason: "" }), /reason is required/)
})

test("admin cannot restrict their own account", () => {
  assert.throws(() => assertAdminAccountStatusChange({ ...base, targetId: base.actorId }), /your own admin account/)
})

test("last active admin cannot be restricted", () => {
  assert.throws(() => assertAdminAccountStatusChange({ ...base, targetRole: "ADMIN", activeAdminCount: 1 }), /last active admin/)
})

test("ordinary restriction and reactivation are allowed", () => {
  assert.doesNotThrow(() => assertAdminAccountStatusChange(base))
  assert.doesNotThrow(() => assertAdminAccountStatusChange({ ...base, nextStatus: "ACTIVE", reason: undefined }))
})
