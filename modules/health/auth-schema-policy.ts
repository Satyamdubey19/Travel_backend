export type AuthSchemaState = {
  refreshTokenHash: boolean;
  passwordResetTokenTable: boolean;
  passwordResetTokenHash: boolean;
  sessionDeviceId: boolean;
  userDeviceRefreshTokenHash: boolean;
  userSessionInvalidatedAt: boolean;
  emailChangeRequestTable: boolean;
  emailChangeRequestHash: boolean;
  emailChangeRequestComplete: boolean;
};

export function isAuthSchemaReady(state: AuthSchemaState) {
  return Object.values(state).every(Boolean);
}
