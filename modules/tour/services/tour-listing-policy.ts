export const TOUR_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const
export type TourRiskLevelValue = typeof TOUR_RISK_LEVELS[number]

type TourSafetyInput = {
  riskLevel?: string | null
  riskDisclosure?: string | null
  meetingPoint?: string | null
  eligibilityRequirements?: string[] | null
  requiredEquipment?: string[] | null
  emergencyPlan?: string | null
  minimumAge?: number | string | null
  requiresCaretaker?: boolean | null
  verifiedTravelersOnly?: boolean | null
  joinApprovalRequired?: boolean | null
}

function policyError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

function meaningful(items: string[] | null | undefined) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean)
}

export function assertTourSafetyReady(input: TourSafetyInput, options: { forApproval?: boolean } = {}) {
  const riskLevel = String(input.riskLevel ?? "").toUpperCase()
  if (!TOUR_RISK_LEVELS.includes(riskLevel as TourRiskLevelValue)) {
    throw policyError("Choose a supported tour risk level")
  }
  const disclosure = input.riskDisclosure?.trim() ?? ""
  if (disclosure.length < 40 || disclosure.length > 2_000) {
    throw policyError("Risk disclosure must contain 40 to 2000 characters")
  }
  const meetingPoint = input.meetingPoint?.trim() ?? ""
  if (meetingPoint.length < 5 || meetingPoint.length > 500) {
    throw policyError("Meeting point guidance must contain 5 to 500 characters")
  }
  const eligibility = meaningful(input.eligibilityRequirements)
  if (eligibility.length < 1 || eligibility.length > 12 || eligibility.some((item) => item.length < 3 || item.length > 200)) {
    throw policyError("Add 1 to 12 clear eligibility requirements")
  }
  const equipment = meaningful(input.requiredEquipment)
  if (equipment.length > 20 || equipment.some((item) => item.length < 2 || item.length > 200)) {
    throw policyError("Required equipment must contain at most 20 clear items")
  }
  const minimumAge = Number(input.minimumAge)
  if (!Number.isInteger(minimumAge) || minimumAge < 5 || minimumAge > 100) {
    throw policyError("Minimum age must be between 5 and 100")
  }

  if (riskLevel === "MEDIUM" || riskLevel === "HIGH" || riskLevel === "VERY_HIGH") {
    const emergencyPlan = input.emergencyPlan?.trim() ?? ""
    if (emergencyPlan.length < 80 || emergencyPlan.length > 4_000) {
      throw policyError("Medium and higher risk tours require an 80 to 4000 character emergency plan")
    }
  }
  if (riskLevel === "HIGH" || riskLevel === "VERY_HIGH") {
    if (minimumAge < 18) throw policyError("High-risk tours require a minimum age of 18")
    if (equipment.length < 1) throw policyError("High-risk tours require an equipment checklist")
    if (!input.verifiedTravelersOnly || !input.joinApprovalRequired) {
      throw policyError("High-risk tours require verified travelers and host approval for every join request")
    }
  }
  if (riskLevel === "VERY_HIGH" && !input.requiresCaretaker) {
    throw policyError("Very-high-risk tours must require an approved caretaker")
  }
  if (options.forApproval && riskLevel === "VERY_HIGH") {
    throw Object.assign(
      new Error("Very-high-risk tours cannot be published until caretaker assignment and qualification checks are implemented"),
      { statusCode: 409 },
    )
  }
}

export function ageOnDate(traveler: { age?: number; dob?: string }, referenceDate: Date) {
  if (traveler.dob) {
    const birthDate = new Date(traveler.dob)
    if (Number.isNaN(birthDate.getTime()) || birthDate >= referenceDate) return null
    let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear()
    const beforeBirthday = referenceDate.getUTCMonth() < birthDate.getUTCMonth()
      || (referenceDate.getUTCMonth() === birthDate.getUTCMonth() && referenceDate.getUTCDate() < birthDate.getUTCDate())
    if (beforeBirthday) age -= 1
    return age
  }
  return Number.isInteger(traveler.age) ? Number(traveler.age) : null
}

export function assertTravelersMeetMinimumAge(
  travelers: Array<{ age?: number; dob?: string }>,
  minimumAge: number,
  tripStart: Date,
) {
  if (travelers.some((traveler) => {
    const age = ageOnDate(traveler, tripStart)
    return age === null || age < minimumAge
  })) {
    throw Object.assign(new Error(`Every traveler must be at least ${minimumAge} on the trip start date`), { statusCode: 400 })
  }
}
