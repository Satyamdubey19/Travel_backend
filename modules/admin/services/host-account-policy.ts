type AccountStatus = "ACTIVE" | "SUSPENDED" | "DELETED"
type AccountRole = "USER" | "HOST" | "ADMIN"

export type HostAccountState = {
  isApproved: boolean
  isVerified: boolean
  kycStatus: string
}

export function resolveHostAccountUpdate(
  requestedStatus: string,
  host: HostAccountState,
  currentRole: AccountRole,
) {
  const status = requestedStatus.toUpperCase() as AccountStatus
  if (!(["ACTIVE", "SUSPENDED", "DELETED"] as const).includes(status)) {
    throw Object.assign(new Error("Invalid account status"), { statusCode: 400 })
  }

  if (status === "ACTIVE" && (!host.isApproved || !host.isVerified || host.kycStatus !== "APPROVED")) {
    throw Object.assign(new Error("Host must pass KYC before activation"), { statusCode: 409 })
  }

  return {
    hostIsActive: status === "ACTIVE",
    userStatus: status,
    // A status recovery may restore an already approved host. It is never a
    // second route for promoting an unreviewed traveller.
    userRole: status === "ACTIVE" ? "HOST" as const : currentRole,
    invalidateSession: status !== "ACTIVE",
  }
}
