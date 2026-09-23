import assert from "node:assert/strict"
import test from "node:test"
import {
  getMissingProductionEnvironmentVariables,
  isSuppliedEnvironmentValue,
  productionRequiredEnvironmentVariables,
  requiredEnv,
  validateProductionEnvironment,
} from "@/lib/env"

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]))
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    run()
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test("requiredEnv rejects absent and placeholder secrets", () => {
  withEnv({ TEST_REQUIRED_SECRET: undefined }, () => assert.throws(() => requiredEnv("TEST_REQUIRED_SECRET")))
  withEnv({ TEST_REQUIRED_SECRET: "replace_with_secure_value" }, () => assert.throws(() => requiredEnv("TEST_REQUIRED_SECRET")))
  withEnv({ TEST_REQUIRED_SECRET: "a-real-value" }, () => assert.equal(requiredEnv("TEST_REQUIRED_SECRET"), "a-real-value"))
})

test("production validation fails closed when mandatory configuration is absent", () => {
  withEnv({ NODE_ENV: "production", DATABASE_URL: undefined }, () => assert.throws(validateProductionEnvironment, /DATABASE_URL/))
})

test("configuration preflight reports only missing variable names", () => {
  const complete = Object.fromEntries(productionRequiredEnvironmentVariables.map((name) => [name, "configured-value"]))
  complete.REDIS_URL = "rediss://default:password@example.upstash.io:6379"
  assert.deepEqual(getMissingProductionEnvironmentVariables(complete), [])
  assert.deepEqual(getMissingProductionEnvironmentVariables({ ...complete, REDIS_URL: "your_redis_url" }), ["REDIS_URL"])
  assert.deepEqual(getMissingProductionEnvironmentVariables({ ...complete, REDIS_URL: "https://example.upstash.io" }), ["REDIS_URL"])
  assert.deepEqual(getMissingProductionEnvironmentVariables({ ...complete, REDIS_URL: "rediss://default:password@example.upstash.io:6379" }), [])
  assert.equal(isSuppliedEnvironmentValue(undefined), false)
  assert.equal(isSuppliedEnvironmentValue("replace_with_value"), false)
  assert.equal(isSuppliedEnvironmentValue("configured-value"), true)
})
