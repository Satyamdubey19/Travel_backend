import { Prisma, type NotificationDeliveryStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AdminSession } from "@/utils/admin-auth"
import { canReplayNotificationDelivery } from "@/modules/notification/services/notification-delivery-policy"

const deliveryStatuses: NotificationDeliveryStatus[] = [
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED",
  "DEAD_LETTER",
]

function emailHint(email: string) {
  const [local = "", domain = ""] = email.split("@")
  return `${local.slice(0, 1)}${local.length > 1 ? "***" : ""}@${domain}`
}

export async function listNotificationDeliveries(status = "ALL") {
  const normalized = status.toUpperCase()
  if (normalized !== "ALL" && !deliveryStatuses.includes(normalized as NotificationDeliveryStatus)) {
    throw Object.assign(new Error("Invalid delivery status"), { statusCode: 400 })
  }
  const where: Prisma.NotificationDeliveryWhereInput = normalized === "ALL"
    ? {}
    : { status: normalized as NotificationDeliveryStatus }

  const [rows, grouped, oldestActionable] = await Promise.all([
    prisma.notificationDelivery.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        channel: true,
        status: true,
        attempts: true,
        availableAt: true,
        lockedAt: true,
        deliveredAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        Notification: { select: { type: true, title: true } },
        User: { select: { name: true, email: true } },
      },
    }),
    prisma.notificationDelivery.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.notificationDelivery.findFirst({
      where: { status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ])

  const counts = Object.fromEntries(deliveryStatuses.map((key) => [key, 0])) as Record<NotificationDeliveryStatus, number>
  for (const item of grouped) counts[item.status] = item._count._all

  return {
    summary: {
      counts,
      oldestActionableAt: oldestActionable?.createdAt ?? null,
    },
    deliveries: rows.map(({ User, ...row }) => ({
      ...row,
      user: { name: User.name, emailHint: emailHint(User.email) },
    })),
  }
}

export async function replayNotificationDelivery(id: string, admin: AdminSession, reason: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.notificationDelivery.findUnique({
      where: { id },
      select: { id: true, status: true, attempts: true, lastError: true },
    })
    if (!before) throw Object.assign(new Error("Delivery not found"), { statusCode: 404 })
    if (!canReplayNotificationDelivery(before.status)) {
      throw Object.assign(new Error("Only failed or dead-letter deliveries can be replayed"), { statusCode: 409 })
    }

    const claimed = await tx.notificationDelivery.updateMany({
      where: { id, status: before.status, attempts: before.attempts },
      data: {
        status: "PENDING",
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        deliveredAt: null,
        lastError: null,
      },
    })
    if (claimed.count !== 1) {
      throw Object.assign(new Error("Delivery state changed; refresh and try again"), { statusCode: 409 })
    }

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "NOTIFICATION_DELIVERY_REPLAYED",
        entity: "NOTIFICATION_DELIVERY",
        entityId: id,
        oldData: before,
        newData: { status: "PENDING", attempts: 0, reason },
        module: "notifications",
        severity: "WARN",
      },
    })

    return { id, status: "PENDING" as const, attempts: 0 }
  })
}
