export const communityReportReasons = [
  "HARASSMENT",
  "HATE_OR_ABUSE",
  "SEXUAL_CONTENT",
  "THREAT_OR_SAFETY",
  "SCAM_OR_SPAM",
  "PRIVACY_VIOLATION",
  "OTHER",
] as const

export const communityReportStatuses = ["OPEN", "IN_REVIEW", "ACTIONED", "DISMISSED"] as const

export type CommunityReportReasonValue = typeof communityReportReasons[number]
export type CommunityReportStatusValue = typeof communityReportStatuses[number]

function policyError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

export function validateBlock(blockerId: string, blockedId: unknown) {
  const targetId = typeof blockedId === "string" ? blockedId.trim() : ""
  if (!targetId) throw policyError("A traveler is required")
  if (targetId === blockerId) throw policyError("You cannot block yourself")
  return targetId
}

export function validateMessageReport(input: { reason?: unknown; details?: unknown }) {
  const reason = typeof input.reason === "string" ? input.reason.trim().toUpperCase() : ""
  if (!communityReportReasons.includes(reason as CommunityReportReasonValue)) {
    throw policyError("Choose a supported report reason")
  }

  const details = typeof input.details === "string" ? input.details.trim() : ""
  if (details && (details.length < 10 || details.length > 2000)) {
    throw policyError("Report details must be between 10 and 2000 characters")
  }
  if (reason === "OTHER" && details.length < 10) {
    throw policyError("Please explain the reason for this report")
  }
  return { reason: reason as CommunityReportReasonValue, details: details || null }
}

export function validateReportDecision(
  current: CommunityReportStatusValue,
  input: { status?: unknown; resolutionNotes?: unknown },
) {
  const status = typeof input.status === "string" ? input.status.trim().toUpperCase() : ""
  if (!communityReportStatuses.includes(status as CommunityReportStatusValue)) {
    throw policyError("Choose a supported moderation status")
  }
  const next = status as CommunityReportStatusValue
  const allowed: Record<CommunityReportStatusValue, CommunityReportStatusValue[]> = {
    OPEN: ["IN_REVIEW", "ACTIONED", "DISMISSED"],
    IN_REVIEW: ["ACTIONED", "DISMISSED"],
    ACTIONED: [],
    DISMISSED: [],
  }
  if (!allowed[current].includes(next)) {
    throw policyError(`A ${current.toLowerCase().replaceAll("_", " ")} report cannot move to ${next.toLowerCase().replaceAll("_", " ")}`, 409)
  }

  const resolutionNotes = typeof input.resolutionNotes === "string" ? input.resolutionNotes.trim() : ""
  const minimum = next === "IN_REVIEW" ? 10 : 30
  if (resolutionNotes.length < minimum || resolutionNotes.length > 2000) {
    throw policyError(`Moderation notes must be between ${minimum} and 2000 characters`)
  }
  return { status: next, resolutionNotes }
}
