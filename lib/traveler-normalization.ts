export function normalizeTravelerName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export function normalizeAadhaar(aadhaar: string) {
  return aadhaar.replace(/\D/g, "")
}

export function isValidAadhaar(aadhaar: string) {
  return /^\d{12}$/.test(normalizeAadhaar(aadhaar))
}

export function maskAadhaar(aadhaar: string) {
  const normalized = normalizeAadhaar(aadhaar)
  const last4 = normalized.slice(-4)
  return last4 ? `XXXX-XXXX-${last4}` : ""
}

export function aadhaarLast4(aadhaar: string) {
  return normalizeAadhaar(aadhaar).slice(-4)
}
