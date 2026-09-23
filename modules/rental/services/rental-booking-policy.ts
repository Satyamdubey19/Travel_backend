const DAY_MS = 86_400_000

export function rentalBookingKey(userId: string, rentalId: string, clientKey: string) {
  return `${userId}:${rentalId}:${clientKey}`
}

export function parseRentalDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error("Invalid rental date"), { statusCode: 400 })
  }
  return date
}

export function calculateRentalDays(pickup: Date, returns: Date, now = new Date()) {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (pickup.getTime() < todayUtc) throw Object.assign(new Error("Pickup date cannot be in the past"), { statusCode: 409 })
  const days = Math.round((returns.getTime() - pickup.getTime()) / DAY_MS)
  if (days < 1) throw Object.assign(new Error("Return date must be after pickup date"), { statusCode: 400 })
  if (days > 60) throw Object.assign(new Error("Online rentals are limited to 60 days"), { statusCode: 400 })
  return days
}

export function calculateRentalTotal(pricePerDay: number, days: number) {
  if (!Number.isFinite(pricePerDay) || pricePerDay < 0) throw new Error("Invalid rental price")
  if (!Number.isInteger(days) || days < 1) throw new Error("Invalid rental duration")
  return Number((pricePerDay * days).toFixed(2))
}
