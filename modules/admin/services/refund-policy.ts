export function assertRefundApproval(currentStatus: string, requestedAmount: number, approvedAmount: number) {
  if (currentStatus !== "REVIEW_PENDING") throw Object.assign(new Error(`Refund cannot be approved from ${currentStatus.toLowerCase()}`), { statusCode: 409 })
  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) throw Object.assign(new Error("Approved amount must be greater than zero"), { statusCode: 400 })
  if (approvedAmount > requestedAmount) throw Object.assign(new Error("Approved amount cannot exceed the paid amount"), { statusCode: 400 })
}

export function assertRefundRejection(currentStatus: string, reason?: string) {
  if (currentStatus !== "REVIEW_PENDING") throw Object.assign(new Error(`Refund cannot be rejected from ${currentStatus.toLowerCase()}`), { statusCode: 409 })
  if (!reason?.trim() || reason.trim().length < 5) throw Object.assign(new Error("A rejection reason of at least 5 characters is required"), { statusCode: 400 })
}

export function assertRefundExecution(currentStatus: string, approvedAmount: number | null, providerPaymentId?: string | null) {
  if (!["APPROVED", "FAILED"].includes(currentStatus)) throw Object.assign(new Error(`Refund cannot execute from ${currentStatus.toLowerCase()}`), { statusCode: 409 })
  if (!providerPaymentId) throw Object.assign(new Error("Captured provider payment reference is missing"), { statusCode: 409 })
  if (!approvedAmount || approvedAmount <= 0) throw Object.assign(new Error("Approved amount is missing"), { statusCode: 409 })
}
