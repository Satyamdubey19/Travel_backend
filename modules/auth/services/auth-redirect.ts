export type AuthRecoveryCode = "DEVICE_LIMIT_REACHED" | "GOOGLE_SIGNIN_FAILED";

export function safeAuthCallbackPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/api") || value.startsWith("/_next")) {
    return "/";
  }
  return value;
}

export function authLoginRecoveryPath(
  callbackPath: string | null | undefined,
  error?: AuthRecoveryCode,
) {
  const params = new URLSearchParams({ callbackUrl: safeAuthCallbackPath(callbackPath) });
  if (error) params.set("error", error);
  return `/login?${params.toString()}`;
}
