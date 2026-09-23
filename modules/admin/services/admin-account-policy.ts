type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" | "BANNED" | "DELETED"

export function assertAdminAccountStatusChange(input: {
  actorId: string
  targetId: string
  targetRole: "USER" | "HOST" | "ADMIN"
  currentStatus: AccountStatus
  nextStatus: AccountStatus
  reason?: string
  activeAdminCount: number
}) {
  if (input.actorId === input.targetId && input.nextStatus !== "ACTIVE") {
    throw Object.assign(new Error("You cannot suspend or delete your own admin account"), { statusCode: 409 })
  }
  if (input.nextStatus !== "ACTIVE" && !input.reason?.trim()) {
    throw Object.assign(new Error("A reason is required to restrict an account"), { statusCode: 400 })
  }
  if (input.targetRole === "ADMIN" && input.currentStatus === "ACTIVE" && input.nextStatus !== "ACTIVE" && input.activeAdminCount <= 1) {
    throw Object.assign(new Error("The last active admin account cannot be restricted"), { statusCode: 409 })
  }
}
