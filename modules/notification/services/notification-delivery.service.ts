import { prisma } from "@/lib/prisma"
import { sendNotificationEmail } from "@/lib/mail"
import type { Prisma } from "@prisma/client"
import {
  NOTIFICATION_LOCK_TIMEOUT_MS,
  NOTIFICATION_MAX_ATTEMPTS,
  notificationBackoffMs,
  notificationFailureStatus,
  sanitizeDeliveryError,
} from "@/modules/notification/services/notification-delivery-policy"

type ProcessNotificationDeliveriesInput = {
  limit?: number
  now?: Date
}

export async function processNotificationDeliveries(input: ProcessNotificationDeliveriesInput = {}) {
  const now = input.now ?? new Date()
  const limit = Math.max(1, Math.min(100, Math.trunc(input.limit ?? 25)))
  const staleBefore = new Date(now.getTime() - NOTIFICATION_LOCK_TIMEOUT_MS)
  const claimable: Prisma.NotificationDeliveryWhereInput = {
    attempts: { lt: NOTIFICATION_MAX_ATTEMPTS },
    OR: [
      { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
      { status: "PROCESSING", lockedAt: { lt: staleBefore } },
    ],
  }

  const candidates = await prisma.notificationDelivery.findMany({
    where: claimable,
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  })

  let claimed = 0
  let delivered = 0
  let failed = 0
  let deadLettered = 0

  for (const candidate of candidates) {
    const claim = await prisma.notificationDelivery.updateMany({
      where: { id: candidate.id, ...claimable },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lockedAt: now,
        lastError: null,
      },
    })
    if (claim.count !== 1) continue
    claimed += 1

    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: candidate.id },
      include: {
        Notification: { select: { title: true } },
        User: { select: { email: true, name: true } },
      },
    })
    if (!delivery) continue

    try {
      await sendNotificationEmail({
        deliveryId: delivery.id,
        to: delivery.User.email,
        name: delivery.User.name,
        title: delivery.Notification.title,
      })
      const result = await prisma.notificationDelivery.updateMany({
        where: { id: delivery.id, status: "PROCESSING", attempts: delivery.attempts },
        data: { status: "DELIVERED", deliveredAt: new Date(), lockedAt: null, lastError: null },
      })
      delivered += result.count
    } catch (error) {
      const status = notificationFailureStatus(delivery.attempts)
      const result = await prisma.notificationDelivery.updateMany({
        where: { id: delivery.id, status: "PROCESSING", attempts: delivery.attempts },
        data: {
          status,
          availableAt: new Date(now.getTime() + notificationBackoffMs(delivery.attempts)),
          lockedAt: null,
          lastError: sanitizeDeliveryError(error),
        },
      })
      if (status === "DEAD_LETTER") deadLettered += result.count
      else failed += result.count
    }
  }

  return { scanned: candidates.length, claimed, delivered, failed, deadLettered }
}
