import assert from "node:assert/strict"
import test from "node:test"
import { BrevoEmailError, isBrevoSenderConfigured, parseBrevoSender, sendBrevoEmail } from "@/lib/brevo"

function withEnvironment(values: Record<string, string | undefined>, callback: () => Promise<void>) {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return callback().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}

test("Brevo sender parsing accepts a verified display-name address and rejects placeholders", () => {
  assert.deepEqual(parseBrevoSender('Travels Pro <mailer@example.com>'), {
    name: "Travels Pro",
    email: "mailer@example.com",
  })
  assert.equal(isBrevoSenderConfigured("your-verified-domain.example"), false)
  assert.equal(isBrevoSenderConfigured("Travels Pro <onboarding@your-verified-domain.example>"), false)
  assert.equal(isBrevoSenderConfigured("Travels Pro <not-an-email>"), false)
})

test("Brevo email delivery sends the documented payload without exposing the API key", async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init })
    return new Response(JSON.stringify({ messageId: "<brevo-message-id>" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  try {
    await withEnvironment({
      BREVO_API_KEY: "xkeysib-test-only",
      BREVO_FROM_EMAIL: "Travels Pro <mailer@example.com>",
      BREVO_API_URL: "https://api.example.test/v3/smtp/email",
    }, async () => {
      const result = await sendBrevoEmail({
        to: { email: "traveler@example.com", name: "Traveler" },
        subject: "Verification",
        htmlContent: "<p>Verify</p>",
        textContent: "Verify",
        tags: ["auth"],
        headers: { idempotencyKey: "delivery-123" },
      })
      assert.equal(result.messageId, "<brevo-message-id>")
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, "https://api.example.test/v3/smtp/email")
    assert.equal(requests[0].init?.headers && (requests[0].init?.headers as Record<string, string>)["api-key"], "xkeysib-test-only")
    const body = JSON.parse(String(requests[0].init?.body)) as Record<string, unknown>
    assert.deepEqual(body.sender, { name: "Travels Pro", email: "mailer@example.com" })
    assert.deepEqual(body.to, [{ email: "traveler@example.com", name: "Traveler" }])
    assert.deepEqual(body.headers, { idempotencyKey: "delivery-123" })
    assert.equal(JSON.stringify(body).includes("xkeysib-test-only"), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Brevo provider failures are reduced to bounded status and code", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: "invalid_parameter",
    message: "private recipient and secret details must not escape",
  }), { status: 400 })) as typeof fetch
  try {
    await withEnvironment({
      BREVO_API_KEY: "xkeysib-test-only",
      BREVO_FROM_EMAIL: "mailer@example.com",
      BREVO_API_URL: "https://api.example.test/v3/smtp/email",
    }, async () => {
      await assert.rejects(
        () => sendBrevoEmail({ to: "traveler@example.com", subject: "Test", textContent: "Test" }),
        (error: unknown) => {
          assert.ok(error instanceof BrevoEmailError)
          assert.equal(error.providerStatus, 400)
          assert.equal(error.providerCode, "invalid_parameter")
          assert.equal(error.message.includes("private recipient"), false)
          return true
        },
      )
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
