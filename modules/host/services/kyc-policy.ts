export type KycDecisionInput = {
  action?: string
  rejectionReason?: string
}

export function resolveKycDecision(input: KycDecisionInput) {
  if (!input.action || !["approve", "reject", "request_changes", "resubmission_required"].includes(input.action)) {
    throw Object.assign(new Error("Choose approve, reject, or request changes"), { statusCode: 400 })
  }
  const approved = input.action === "approve"
  const rejectionReason = input.rejectionReason?.trim()
  if (!approved && !rejectionReason) {
    throw Object.assign(new Error("A clear reason is required when KYC is not approved"), { statusCode: 400 })
  }
  return {
    status: approved ? "APPROVED" as const : "REJECTED" as const,
    rejectionReason: approved ? null : rejectionReason,
    resubmissionAllowed: input.action === "request_changes" || input.action === "resubmission_required",
  }
}
