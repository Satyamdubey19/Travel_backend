import { Coupon, Prisma } from "@prisma/client"

export type CouponResult = {
  valid: true
  coupon: Coupon
  discountAmount: number
} | {
  valid: false
  reason: string
}

export async function validateCoupon(
  db: Prisma.TransactionClient,
  couponCode: string,
  userId: string,
  subtotal: number,
): Promise<CouponResult> {
  const now = new Date()
  const coupon = await db.coupon.findFirst({
    where: {
      code: couponCode.trim().toUpperCase(),
      isActive: true,
      OR: [
        { startsAt: null },
        { startsAt: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      ],
    },
  })

  if (!coupon) {
    return { valid: false, reason: "Invalid or expired coupon code" }
  }

  if (coupon.usageLimit !== null) {
    const totalUses = await db.couponRedemption.count({
      where: { couponId: coupon.id },
    })
    if (totalUses >= coupon.usageLimit) {
      return { valid: false, reason: "Coupon usage limit has been reached" }
    }
  }

  const userUses = await db.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  })
  const perUserLimit = coupon.perUserLimit ?? 1
  if (userUses >= perUserLimit) {
    return { valid: false, reason: "You have already used this coupon" }
  }

  if (subtotal < Number(coupon.minOrderAmount)) {
    return {
      valid: false,
      reason: `Minimum booking value of INR ${coupon.minOrderAmount} required`,
    }
  }

  let discountAmount = 0
  if (coupon.type === "PERCENTAGE") {
    discountAmount = (subtotal * Number(coupon.value)) / 100
    if (coupon.maxDiscount !== null) {
      discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount))
    }
  } else {
    discountAmount = Math.min(Number(coupon.value), subtotal)
  }

  discountAmount = Math.round(discountAmount * 100) / 100

  return { valid: true, coupon, discountAmount }
}
