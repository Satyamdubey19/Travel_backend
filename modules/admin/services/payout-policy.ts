type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"

const allowedTransitions: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ["PROCESSING", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  FAILED: ["PROCESSING"],
  COMPLETED: [],
}

export function assertPayoutTransition(input: {
  currentStatus: PayoutStatus
  nextStatus: PayoutStatus
  transactionId?: string
  failureReason?: string
}) {
  if (input.currentStatus === input.nextStatus) return
  if (!allowedTransitions[input.currentStatus].includes(input.nextStatus)) {
    throw Object.assign(new Error(`Payout cannot move from ${input.currentStatus.toLowerCase()} to ${input.nextStatus.toLowerCase()}`), { statusCode: 409 })
  }
  if (input.nextStatus === "COMPLETED" && !input.transactionId?.trim()) {
    throw Object.assign(new Error("Transaction ID is required to complete a payout"), { statusCode: 400 })
  }
  if (input.nextStatus === "FAILED" && !input.failureReason?.trim()) {
    throw Object.assign(new Error("Failure reason is required"), { statusCode: 400 })
  }
}
