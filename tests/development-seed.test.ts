import assert from "node:assert/strict"
import test from "node:test"
import { getDevelopmentSeedConfig } from "@/lib/development-seed"

const validEnvironment = {
  DATABASE_URL: "postgresql://seed-user:seed-password@localhost:5432/travels_seed",
  ALLOW_DEVELOPMENT_SEED: "true",
  DEV_SEED_USER_PASSWORD: "development-user-password",
  DEV_SEED_ADMIN_EMAIL: "admin@example.test",
  DEV_SEED_ADMIN_PASSWORD: "development-admin-password",
}

test("development seed data requires explicit opt-in and supplied credentials", () => {
  assert.throws(() => getDevelopmentSeedConfig({ DATABASE_URL: validEnvironment.DATABASE_URL }), /ALLOW_DEVELOPMENT_SEED/)
  assert.throws(() => getDevelopmentSeedConfig({ ...validEnvironment, DEV_SEED_ADMIN_PASSWORD: "short" }), /DEV_SEED_ADMIN_EMAIL/)
  assert.throws(() => getDevelopmentSeedConfig({ ...validEnvironment, DATABASE_URL: "" }), /DATABASE_URL/)
})

test("development seed data is unavailable in production", () => {
  assert.throws(() => getDevelopmentSeedConfig({ ...validEnvironment, NODE_ENV: "production" }), /disabled in production/)
})

test("development seed data returns only explicitly supplied values", () => {
  assert.deepEqual(getDevelopmentSeedConfig(validEnvironment), {
    connectionString: validEnvironment.DATABASE_URL,
    userPassword: validEnvironment.DEV_SEED_USER_PASSWORD,
    adminEmail: validEnvironment.DEV_SEED_ADMIN_EMAIL,
    adminPassword: validEnvironment.DEV_SEED_ADMIN_PASSWORD,
  })
})
