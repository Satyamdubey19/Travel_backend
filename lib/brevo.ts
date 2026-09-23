type BrevoSender = {
  email: string
  name?: string
}

type BrevoRecipient = {
  email: string
  name?: string
}

export type BrevoEmailInput = {
  to: string | BrevoRecipient | Array<string | BrevoRecipient>
  subject: string
  htmlContent?: string
  textContent?: string
  tags?: string[]
  headers?: Record<string, string>
}

type BrevoErrorPayload = {
  code?: unknown
  message?: unknown
}

const defaultBrevoEndpoint = "https://api.brevo.com/v3/smtp/email"

function supplied(value: string | undefined): value is string {
  const normalized = value?.trim()
  if (!normalized) return false
  const lower = normalized.toLowerCase()
  return !lower.startsWith("your_")
    && !lower.startsWith("your-")
    && !lower.startsWith("replace_with_")
    && !lower.startsWith("replace-with-")
    && !lower.includes("your-verified-domain.example")
}

export function parseBrevoSender(value: string | undefined): BrevoSender | null {
  const normalized = value?.trim()
  if (!normalized || !supplied(normalized)) return null

  const angleMatch = normalized.match(/^(.*?)\s*<([^<>]+)>$/)
  const name = angleMatch?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2")
  const email = (angleMatch?.[2] ?? normalized).trim()
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) return null

  return {
    email,
    ...(name ? { name: name.slice(0, 160) } : {}),
  }
}

export function isBrevoSenderConfigured(value: string | undefined) {
  return parseBrevoSender(value) !== null
}

export class BrevoEmailError extends Error {
  readonly providerStatus?: number
  readonly providerCode?: string
  readonly statusCode = 503

  constructor(message: string, details?: { providerStatus?: number; providerCode?: string }) {
    super(message)
    this.name = "BrevoEmailError"
    this.providerStatus = details?.providerStatus
    this.providerCode = details?.providerCode
  }
}

function normalizeRecipients(input: BrevoEmailInput["to"]): BrevoRecipient[] {
  const values = Array.isArray(input) ? input : [input]
  return values.map((recipient) => {
    if (typeof recipient === "string") return { email: recipient }
    return {
      email: recipient.email,
      ...(recipient.name ? { name: recipient.name } : {}),
    }
  })
}

function providerCode(value: unknown) {
  if (typeof value !== "string") return undefined
  return value.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) || undefined
}

export async function sendBrevoEmail(input: BrevoEmailInput) {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const sender = parseBrevoSender(process.env.BREVO_FROM_EMAIL)
  if (!supplied(apiKey) || !sender) {
    throw new BrevoEmailError("Brevo email delivery is not configured")
  }

  const endpoint = process.env.BREVO_API_URL?.trim() || defaultBrevoEndpoint
  let parsedEndpoint: URL
  try {
    parsedEndpoint = new URL(endpoint)
  } catch {
    throw new BrevoEmailError("Brevo email endpoint is invalid")
  }
  if (parsedEndpoint.protocol !== "https:") {
    throw new BrevoEmailError("Brevo email endpoint must use HTTPS")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(parsedEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: normalizeRecipients(input.to),
        subject: input.subject,
        ...(input.htmlContent ? { htmlContent: input.htmlContent } : {}),
        ...(input.textContent ? { textContent: input.textContent } : {}),
        ...(input.tags?.length ? { tags: input.tags.slice(0, 20) } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      }),
      signal: controller.signal,
    })

    const raw = await response.text()
    let payload: BrevoErrorPayload = {}
    try {
      payload = JSON.parse(raw) as BrevoErrorPayload
    } catch {
      // Brevo should return JSON, but keep non-JSON provider failures generic.
    }

    if (!response.ok) {
      if (process.env.NODE_ENV !== "production" && (apiKey.includes("development-mock") || process.env.ENABLE_DEV_MOCK_EMAIL === "true")) {
        const recipients = normalizeRecipients(input.to).map((r) => r.email).join(", ")
        console.log(`[Dev Mailer] Live provider rejected (${response.status}); mock fallback dispatched to ${recipients} | Subject: ${input.subject}`)
        const linkMatch = input.htmlContent?.match(/href="([^"]+)"/i) || input.textContent?.match(/https?:\/\/[^\s]+/i)
        if (linkMatch) console.log(`[Dev Mailer] Action Link: ${linkMatch[1] || linkMatch[0]}`)
        return { messageId: `<mock-dev-${Date.now()}@travelspro.in>` }
      }
      throw new BrevoEmailError("Brevo rejected the email", {
        providerStatus: response.status,
        providerCode: providerCode(payload.code),
      })
    }

    let messageId: string | undefined
    if (payload && typeof (payload as { messageId?: unknown }).messageId === "string") {
      messageId = String((payload as { messageId: string }).messageId).slice(0, 200)
    }
    return { messageId }
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && (apiKey.includes("development-mock") || process.env.ENABLE_DEV_MOCK_EMAIL === "true")) {
      const recipients = normalizeRecipients(input.to).map((r) => r.email).join(", ")
      console.log(`[Dev Mailer] Live provider error; mock fallback dispatched to ${recipients} | Subject: ${input.subject}`)
      const linkMatch = input.htmlContent?.match(/href="([^"]+)"/i) || input.textContent?.match(/https?:\/\/[^\s]+/i)
      if (linkMatch) console.log(`[Dev Mailer] Action Link: ${linkMatch[1] || linkMatch[0]}`)
      return { messageId: `<mock-dev-${Date.now()}@travelspro.in>` }
    }
    if (error instanceof BrevoEmailError) throw error
    throw new BrevoEmailError(error instanceof Error && error.name === "AbortError" ? "Brevo request timed out" : "Brevo request failed")
  } finally {
    clearTimeout(timeout)
  }
}
