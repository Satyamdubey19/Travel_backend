import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AdminSession } from "@/utils/admin-auth"
import { queueNotification } from "@/modules/notification/services/notification-outbox.service"
import { requireTourCircleAccess } from "@/modules/tour/services/tour-circle-access.service"
import { validateBlock, validateMessageReport, validateReportDecision } from "./community-safety-policy"

export async function blockedUserIdsFor(userId: string) {
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  return new Set(blocks.map((block) => block.blockerId === userId ? block.blockedId : block.blockerId))
}

export async function listMyBlocks(userId: string) {
  return prisma.userBlock.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, blockedId: true, createdAt: true, Blocked: { select: { id: true, name: true } } },
  })
}

export async function blockCircleMember(userId: string, tourKey: string, blockedId: unknown) {
  const targetId = validateBlock(userId, blockedId)
  const actorAccess = await requireTourCircleAccess(userId, tourKey, { allowCompletedTour: true })
  const targetAccess = await requireTourCircleAccess(targetId, actorAccess.tour.id, { allowCompletedTour: true })
  if (!targetAccess.isHost && !targetAccess.participant) {
    throw Object.assign(new Error("That person is not in this Trip Circle"), { statusCode: 404 })
  }

  return prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
    create: { blockerId: userId, blockedId: targetId },
    update: {},
    select: { id: true, blockedId: true, createdAt: true },
  })
}

export async function unblockUser(userId: string, blockedId: unknown) {
  const targetId = validateBlock(userId, blockedId)
  await prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId: targetId } })
  return { blockedId: targetId }
}

export async function reportTourMessage(
  userId: string,
  tourKey: string,
  messageId: string,
  input: { reason?: unknown; details?: unknown },
) {
  const report = validateMessageReport(input)
  const { tour } = await requireTourCircleAccess(userId, tourKey, { allowCompletedTour: true })
  const message = await prisma.tourMessage.findFirst({
    where: { id: messageId, deletedAt: null, TourChatRoom: { tourId: tour.id } },
    select: { id: true, senderId: true },
  })
  if (!message) throw Object.assign(new Error("Message not found"), { statusCode: 404 })
  if (message.senderId === userId) throw Object.assign(new Error("You cannot report your own message"), { statusCode: 400 })

  try {
    return await prisma.tourMessageReport.create({
      data: {
        reporterId: userId,
        messageId: message.id,
        tourId: tour.id,
        reportedUserId: message.senderId,
        reason: report.reason,
        details: report.details,
      },
      select: { id: true, reason: true, status: true, createdAt: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Object.assign(new Error("You already reported this message"), { statusCode: 409 })
    }
    throw error
  }
}

export async function listMessageReports(status?: string) {
  const normalized = status?.trim().toUpperCase()
  const statuses = ["OPEN", "IN_REVIEW", "ACTIONED", "DISMISSED"] as const
  const statusFilter = statuses.includes(normalized as typeof statuses[number]) ? normalized as typeof statuses[number] : undefined
  return prisma.tourMessageReport.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      resolutionNotes: true,
      reviewedAt: true,
      createdAt: true,
      Tour: { select: { id: true, title: true } },
      Reporter: { select: { id: true, name: true } },
      ReportedUser: { select: { id: true, name: true } },
      Message: { select: { id: true, message: true, messageType: true, createdAt: true, deletedAt: true } },
      Reviewer: { select: { id: true, name: true } },
    },
  })
}

export async function reviewMessageReport(
  admin: AdminSession,
  reportId: string,
  input: { status?: unknown; resolutionNotes?: unknown },
) {
  const existing = await prisma.tourMessageReport.findUnique({ where: { id: reportId } })
  if (!existing) throw Object.assign(new Error("Message report not found"), { statusCode: 404 })
  const decision = validateReportDecision(existing.status, input)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.tourMessageReport.updateMany({
      where: { id: reportId, status: existing.status, reviewedAt: existing.reviewedAt },
      data: {
        status: decision.status,
        resolutionNotes: decision.resolutionNotes,
        reviewedById: admin.id,
        reviewedAt: now,
      },
    })
    if (claimed.count !== 1) throw Object.assign(new Error("This report was already updated"), { statusCode: 409 })

    if (decision.status === "ACTIONED") {
      await tx.tourMessage.update({ where: { id: existing.messageId }, data: { deletedAt: now } })
    }
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        userId: admin.id,
        action: `MESSAGE_REPORT_${decision.status}`,
        entity: "TOUR_MESSAGE_REPORT",
        entityId: reportId,
        oldData: { status: existing.status },
        newData: decision,
        severity: decision.status === "ACTIONED" ? "WARN" : "INFO",
        module: "COMMUNITY",
      },
    })
    await queueNotification(tx, {
      data: {
        userId: existing.reporterId,
        type: "SYSTEM",
        title: "Message report reviewed",
        message: "Your private Trip Circle report has been reviewed. Thank you for helping keep the community safer.",
        data: { reportId, status: decision.status },
      },
    })
    return tx.tourMessageReport.findUnique({ where: { id: reportId } })
  })
}
