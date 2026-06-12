import type { TourTravelerInput } from "@/validators/tour-booking.validators"

export type TourBookingStatus = "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "FAILED" | "EXPIRED"
export type TourPaymentStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "REFUNDED"
export type TourWaitlistStatus = "WAITLISTED" | "PROMOTED" | "EXPIRED" | "DECLINED"

export type TourBookingIntentResult = {
  bookingId: string
  bookingCode: string
  status: TourBookingStatus
  paymentStatus: TourPaymentStatus
  travelersCount: number
  confirmedCount: number
  waitlistedCount: number
  totalAmount: number
  currency: string
  waitlist?: {
    id: string
    position: number
    groupSize: number
    expiresAt: string | null
  }
}

export type TourBookingWizardStep =
  | "departure"
  | "primary"
  | "travelers"
  | "documents"
  | "medical"
  | "review"
  | "payment"
  | "confirmation"

export type TourBookingWizardState = {
  tourId?: string
  tourSlug?: string
  departureBatchId?: string
  travelers: TourTravelerInput[]
  activeStep: TourBookingWizardStep
  bookingId?: string
  bookingCode?: string
}
