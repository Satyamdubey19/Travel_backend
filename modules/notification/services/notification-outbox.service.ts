import { Prisma } from "@prisma/client"

export type QueueNotificationInput = {
  userId: string
  type: Prisma.NotificationUncheckedCreateInput["type"]
  title: string
  message: string
  data?: Prisma.InputJsonValue
}

/**
 * Writes the user-visible notification and its delivery intent atomically.
 * Callers must pass their current transaction so domain state and notification
 * state cannot diverge.
 */
export async function queueNotification(
  tx: Prisma.TransactionClient,
  args: { data: QueueNotificationInput },
) {
  const notification = await tx.notification.create(args)

  await tx.notificationDelivery.create({
    data: {
      notificationId: notification.id,
      userId: args.data.userId,
      channel: "EMAIL",
    },
  })

  return notification
}
