import { z } from "zod"

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates")

export const createRentalBookingSchema = z.object({
  pickupDate: dateOnly,
  returnDate: dateOnly,
  pickupTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time").optional(),
  withHelmet: z.boolean().optional().default(false),
  contactName: z.string().trim().min(2).max(100),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().min(8).max(20),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
})

export const rentalPaymentOrderSchema = z.object({ bookingId: z.string().uuid() })

export const rentalPaymentVerificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(200),
  razorpay_payment_id: z.string().trim().min(1).max(200),
  razorpay_signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
})

export const cancelRentalBookingSchema = z.object({ reason: z.string().trim().min(5).max(500) })

export type CreateRentalBookingInput = z.infer<typeof createRentalBookingSchema>
export type RentalPaymentVerificationInput = z.infer<typeof rentalPaymentVerificationSchema>
