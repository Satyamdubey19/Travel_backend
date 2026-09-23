export const NOTIFICATION_MAX_ATTEMPTS = 5
export const NOTIFICATION_LOCK_TIMEOUT_MS = 15 * 60 * 1000

export function notificationBackoffMs(attempt: number) {
  const normalizedAttempt = Math.max(1, Math.trunc(attempt))
  return Math.min(60 * 60 * 1000 * 6, 60 * 1000 * 2 ** (normalizedAttempt - 1))
}

export function notificationFailureStatus(attempt: number) {
  return attempt >= NOTIFICATION_MAX_ATTEMPTS ? "DEAD_LETTER" as const : "FAILED" as const
}

export function canReplayNotificationDelivery(status: string) {
  return status === "FAILED" || status === "DEAD_LETTER"
}

export function sanitizeDeliveryError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown delivery error"
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500)
}
