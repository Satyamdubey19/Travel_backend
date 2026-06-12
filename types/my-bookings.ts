export type BookingCategory = "TOUR" | "RENTAL" | "ACTIVITY"

export interface UnifiedBookingRecord {
  id: string
  bookingCode: string
  bookingType: BookingCategory
  status: string
  totalAmount: number
  currency: string
  createdAt: string
  startDate: string | null
  endDate: string | null
  title: string
  subtitle: string
  location: string | null
  href: string
  paymentStatus: string | null
}
