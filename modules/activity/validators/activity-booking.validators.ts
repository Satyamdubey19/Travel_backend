import { z } from "zod"

export const createActivityBookingSchema = z.object({
  slotId: z.string().uuid(),
  guestCount: z.coerce.number().int().min(1).max(20),
  contactName: z.string().trim().min(2).max(100),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().min(8).max(20),
  specialRequests: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
})

export const activityPaymentOrderSchema = z.object({ bookingId: z.string().uuid() })

export const activityPaymentVerificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(200),
  razorpay_payment_id: z.string().trim().min(1).max(200),
  razorpay_signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
})

export const cancelActivityBookingSchema = z.object({ reason: z.string().trim().min(5).max(500) })

export type CreateActivityBookingInput = z.infer<typeof createActivityBookingSchema>
export type ActivityPaymentVerificationInput = z.infer<typeof activityPaymentVerificationSchema>
