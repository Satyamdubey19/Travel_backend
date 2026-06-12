import { prisma } from "@/lib/prisma"

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
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
    },
  })
}

export async function listNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}
