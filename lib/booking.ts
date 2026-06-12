import api, { getApiErrorMessage } from "@/lib/axios"

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'NO_SHOW'

export interface BookingRoom {
  quantity: number
  Room: {
    name: string
    pricePerNight: number | null
  } | null
}

export interface BookingRecord {
  id: string
  bookingCode: string
  status: BookingStatus
  checkIn: string
  checkOut: string
  totalAmount: number
  createdAt: string
  Hotel: {
    id: string
    title: string
    city: string | null
  } | null
  BookingRoom: BookingRoom[]
  Payment: { status: string }[]
}

export async function fetchUserBookings(): Promise<BookingRecord[]> {
  // Profile pages use this helper to load the signed-in user's bookings.
  const { data } = await api.get('/booking')
  return Array.isArray(data.data) ? data.data : []
}

export async function fetchBookingById(id: string): Promise<BookingRecord> {
  // Keep booking detail fetch logic in one place for client components.
  const { data } = await api.get(`/booking/${id}`)
  return data.data
}

export async function cancelUserBooking(id: string, reason?: string): Promise<void> {
  // Cancelling is sent as a status update because the API owns the booking rules.
  try {
    await api.patch(`/booking/${id}`, { status: 'CANCELLED', cancellationReason: reason })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to cancel booking'))
  }
}
