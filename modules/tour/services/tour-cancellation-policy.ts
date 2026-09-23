export function calculateRefundPercent(startDate: Date, now = new Date()) {
  const hoursUntilStart = (startDate.getTime() - now.getTime()) / 36e5
  const daysUntilStart = hoursUntilStart / 24

  if (hoursUntilStart < 24) return 0
  if (daysUntilStart > 30) return 100
  if (daysUntilStart >= 15) return 75
  if (daysUntilStart >= 7) return 50
  return 0
}

export function calculateRefundAmount(totalAmount: number, travelersCount: number, refundPercent: number, singleTraveler: boolean) {
  if (!Number.isFinite(totalAmount) || totalAmount < 0) throw new Error("Invalid booking amount")
  if (!Number.isInteger(travelersCount) || travelersCount < 1) throw new Error("Invalid traveler count")
  if (!Number.isFinite(refundPercent) || refundPercent < 0 || refundPercent > 100) throw new Error("Invalid refund percentage")

  const refundableBase = singleTraveler ? totalAmount / travelersCount : totalAmount
  return Number((refundableBase * (refundPercent / 100)).toFixed(2))
}
