export type SessionTokenTiming = {
  iat?: number
  issuedAtMs?: number
}

/**
 * Access-token invalidation must be precise enough for a password-reset or
 * email-change flow followed immediately by a new login. JWT's `iat` field is
 * expressed in seconds, so new tokens also carry a signed millisecond claim.
 *
 * A legacy token that lacks both claims is never accepted after a persisted
 * account-wide invalidation event.
 */
export function isSessionTokenInvalidated(
  token: SessionTokenTiming,
  invalidatedAt?: Date | null,
) {
  if (!invalidatedAt) return false

  if (typeof token.issuedAtMs === "number") {
    return token.issuedAtMs <= invalidatedAt.getTime()
  }

  if (typeof token.iat === "number") {
    return token.iat * 1000 <= invalidatedAt.getTime()
  }

  return true
}
