import assert from "node:assert/strict"
import test from "node:test"
import { GET } from "@/app/api/verify/route"

test("the retired legacy verification route cannot verify an account", async () => {
  const response = await GET()

  assert.equal(response.status, 410)
  assert.deepEqual(await response.json(), {
    error: "This verification endpoint is retired. Use the link sent in your verification email.",
  })
})
