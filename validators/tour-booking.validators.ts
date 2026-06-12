import { z } from "zod"
import { isValidAadhaar } from "@/lib/traveler-normalization"

export const travelerStatusSchema = z.enum(["CONFIRMED", "WAITLISTED", "CANCELLED", "REJECTED", "PENDING"])

export const tourTravelerSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  age: z.coerce.number().int().min(0).max(120).optional(),
  dob: z.string().optional(),
  aadhaar: z.string().trim().refine(isValidAadhaar, "Enter a valid 12-digit Aadhaar number"),
  gender: z.string().trim().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().min(6).max(30).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  country: z.string().trim().max(80).optional(),
  foodPreference: z.string().trim().max(120).optional(),
  medicalNotes: z.string().trim().max(1000).optional(),
  bloodGroup: z.string().trim().max(12).optional(),
  idType: z.string().trim().max(60).optional(),
  idUploadUrl: z.string().url().optional().or(z.literal("")),
  relation: z.string().trim().max(80).optional(),
  seatPreference: z.string().trim().max(80).optional(),
  status: travelerStatusSchema.optional(),
}).refine((value) => value.age !== undefined || Boolean(value.dob), {
  message: "Enter age or date of birth",
  path: ["age"],
})

export const createTourBookingIntentSchema = z.object({
  departureBatchId: z.string().optional(),
  travelers: z.array(tourTravelerSchema).min(1).max(20),
  contactName: z.string().trim().min(2),
  contactEmail: z.string().email(),
  contactPhone: z.string().trim().min(6).max(30),
  specialRequests: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
})

export const addTourTravelersSchema = z.object({
  travelers: z.array(tourTravelerSchema).min(1).max(20),
  inviteMode: z.enum(["DIRECT", "INVITE_LINK"]).default("DIRECT"),
})

export const cancelTourBookingSchema = z.object({
  travelerId: z.string().optional(),
  reason: z.string().trim().max(1000).optional(),
})

export const validateTourTravelerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(0).max(120).optional(),
  dob: z.string().optional(),
  aadhaar: z.string().trim().refine(isValidAadhaar, "Enter a valid 12-digit Aadhaar number"),
}).refine((value) => value.age !== undefined || Boolean(value.dob), {
  message: "Enter age or date of birth",
  path: ["age"],
})

export type TourTravelerInput = z.infer<typeof tourTravelerSchema>
export type CreateTourBookingIntentInput = z.infer<typeof createTourBookingIntentSchema>
export type AddTourTravelersInput = z.infer<typeof addTourTravelersSchema>
export type CancelTourBookingInput = z.infer<typeof cancelTourBookingSchema>
export type ValidateTourTravelerInput = z.infer<typeof validateTourTravelerSchema>
