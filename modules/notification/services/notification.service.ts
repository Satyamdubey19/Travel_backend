import { prisma } from "@/lib/prisma"
import { queueNotification } from "@/modules/notification/services/notification-outbox.service"

export type NotificationType =
  | "SYSTEM"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "HOST_APPROVED"
  | "HOST_REJECTED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "PAYOUT_PROCESSED"
  | "PAYOUT_FAILED"

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: unknown,
) {
  return prisma.$transaction((tx) =>
    queueNotification(tx, {
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      },
    }),
  )
}

export async function listNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isRead: true, readAt: new Date() } })
  if (result.count !== 1) throw Object.assign(new Error("Notification not found"), { statusCode: 404 })
  return { id: notificationId, isRead: true }
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } })
  return { updated: result.count }
}
