type Environment = Record<string, string | undefined>

import { isBrevoSenderConfigured } from "@/lib/brevo"

function supplied(value: string | undefined) {
  const normalized = value?.trim()
  return Boolean(normalized && !normalized.startsWith("your_") && !normalized.startsWith("replace_with_"))
}

/**
 * Verification and password recovery are only complete when an email can be
 * dispatched. This deliberately has no development bypass: a local success
 * response without a delivery path produces an account nobody can verify.
 */
export function isAuthEmailDeliveryConfigured(environment: Environment = process.env) {
  return supplied(environment.BREVO_API_KEY) && isBrevoSenderConfigured(environment.BREVO_FROM_EMAIL)
}

export class AuthEmailDeliveryError extends Error {
  readonly code = "AUTH_EMAIL_UNAVAILABLE"
  readonly statusCode = 503

  constructor() {
    super("Email delivery is temporarily unavailable. Please try again later.")
    this.name = "AuthEmailDeliveryError"
  }
}

export function assertAuthEmailDeliveryConfigured(environment: Environment = process.env) {
  if (!isAuthEmailDeliveryConfigured(environment)) throw new AuthEmailDeliveryError()
}

/** Do not expose a provider response, sender address, or configuration detail. */
export function authEmailDeliveryFailure() {
  return new AuthEmailDeliveryError()
}
