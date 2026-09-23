export type AccountAuthenticationState = {
  deletedAt?: Date | null
  isBanned?: boolean | null
  isActive?: boolean | null
  status?: string | null
}

export type CredentialLoginState = AccountAuthenticationState & {
  isEmailVerified?: boolean | null
  lockedUntil?: Date | null
}

export type HostAuthorizationState = {
  role?: string | null
  isActive?: boolean | null
  isApproved?: boolean | null
  isVerified?: boolean | null
}

export function accountAuthenticationBlockReason(account: AccountAuthenticationState) {
  if (account.deletedAt || account.isBanned || account.isActive === false || account.status === "SUSPENDED" || account.status === "BANNED" || account.status === "DELETED" || account.status === "REJECTED") {
    return "Account is not allowed to authenticate"
  }

  return null
}

export function accountCanAuthenticate(account: AccountAuthenticationState) {
  return accountAuthenticationBlockReason(account) === null
}

export function accountCanVerifyEmail(account: AccountAuthenticationState) {
  return !account.deletedAt && !account.isBanned && account.isActive !== false && account.status !== "DELETED" && account.status !== "BANNED"
}

/**
 * A failed password check must never expose whether an account exists, is
 * verified, or is restricted. Account-specific recovery guidance is only safe
 * to return after a correct password has been supplied.
 */
export function credentialLoginBlockReason(
  account: CredentialLoginState,
  passwordIsValid: boolean,
  now = Date.now(),
) {
  if (!passwordIsValid) return "Incorrect email or password"

  const accountReason = accountAuthenticationBlockReason(account)
  if (accountReason) return accountReason

  if (account.lockedUntil && account.lockedUntil.getTime() > now) {
    return "Account is temporarily locked. Try again later."
  }

  if (!account.isEmailVerified || account.status === "PENDING") return "Please verify your email before logging in"

  return null
}

export function hasApprovedHostAccess(host: HostAuthorizationState | null | undefined) {
  return Boolean(host?.role === "HOST" && host.isActive && host.isApproved && host.isVerified)
}
