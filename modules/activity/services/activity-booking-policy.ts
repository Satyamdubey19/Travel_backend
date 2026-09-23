export function activityBookingKey(userId: string, activityId: string, clientKey: string) {
  return `${userId}:${activityId}:${clientKey}`
}

export function calculateActivityBookingTotal(unitPrice: number, guestCount: number) {
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Invalid activity price")
  if (!Number.isInteger(guestCount) || guestCount < 1) throw new Error("Invalid guest count")
  return Number((unitPrice * guestCount).toFixed(2))
}

export function assertAdvanceActivityDate(slotDate: Date, now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (slotDate < tomorrow) throw Object.assign(new Error("Same-day or past activity slots cannot be booked online"), { statusCode: 409 })
}
