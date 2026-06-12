export type EmailJobName =
  | "booking-confirmation"
  | "waitlist-confirmation"
  | "waitlist-promotion"
  | "payment-success"
  | "payment-failure"
  | "cancellation-confirmation"
  | "refund-processed"
  | "tour-cancelled"
  | "host-announcement"
  | "new-member-added"
  | "waitlist-expired"

export type EmailJobPayload = {
  to: string
  subject: string
  preview: string
  ctaUrl?: string
  ctaLabel?: string
  lines: string[]
  metadata?: Record<string, unknown>
}
