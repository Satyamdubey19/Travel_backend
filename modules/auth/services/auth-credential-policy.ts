export type CredentialReauthenticationState = {
  provider?: string | null
  hasPassword: boolean
  passwordIsValid: boolean
}

export function credentialReauthenticationFailure(state: CredentialReauthenticationState) {
  if (!state.hasPassword || (state.provider && state.provider !== "credentials")) {
    return { message: "Change your password through your sign-in provider", statusCode: 400 }
  }
  if (!state.passwordIsValid) {
    return { message: "Current password is incorrect", statusCode: 401 }
  }
  return null
}
