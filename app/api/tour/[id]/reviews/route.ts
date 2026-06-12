import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserFromSessionToken } from "@/modules/auth/services/auth.service"
import type { IdRouteParams as Params } from "@/types/routes"

async function getAuthenticatedUserId() {
  const token = (await cookies()).get("token")?.value
  if (token) {
    const user = await getUserFromSessionToken(token)
    if (user?.id) return String(user.id)
  }
  const session = await getServerSession(authOptions)
  return session?.user?.id ? String(session.user.id) : null
}

async function findTour(id: string) {
  return prisma.tour.findFirst({ where: { OR: [{ id }, { slug: id }], deletedAt: null }, select: { id: true, hostId: true } })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const tour = await findTour((await params).id)
  if (!tour) return NextResponse.json({ error: "Tour not found" }, { status: 404 })

  const reviews = await prisma.$queryRaw`
    SELECT r."id", r."rating", r."title", r."comment", r."createdAt",
           json_build_object(
             'name', u."name",
             'UserProfile', json_build_object('avatarUrl', up."avatarUrl")
           ) AS "User"
    FROM "Review" r
    JOIN "User" u ON u."id" = r."userId"
    LEFT JOIN "UserProfile" up ON up."userId" = u."id"
    WHERE r."tourId" = ${tour.id}
      AND COALESCE(r."isPublished", true) = true
    ORDER BY r."createdAt" DESC
    LIMIT 25
  `

  return NextResponse.json({ data: reviews })
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tour = await findTour((await params).id)
  if (!tour) return NextResponse.json({ error: "Tour not found" }, { status: 404 })

  const completedBooking = await prisma.booking.findFirst({
    where: { userId, tourId: tour.id, status: "COMPLETED" },
    select: { id: true },
  })
  if (!completedBooking) return NextResponse.json({ error: "Only completed travelers can review this tour" }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { rating?: number; title?: string; comment?: string }
  const rating = Math.max(1, Math.min(5, Math.trunc(Number(body.rating ?? 5))))
  if (!body.comment?.trim()) return NextResponse.json({ error: "Review comment is required" }, { status: 400 })

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    INSERT INTO "Review" ("id", "userId", "hostId", "tourId", "bookingId", "target", "rating", "title", "comment", "isPublished", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${userId}, ${tour.hostId}, ${tour.id}, ${completedBooking.id}, 'TOUR', ${rating}, ${body.title?.trim() || null}, ${body.comment.trim()}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("bookingId") DO UPDATE SET
      "rating" = EXCLUDED."rating",
      "title" = EXCLUDED."title",
      "comment" = EXCLUDED."comment",
      "isPublished" = true,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "rating", "title", "comment", "createdAt"
  `

  await prisma.tour.update({
    where: { id: tour.id },
    data: {
      totalReviews: { increment: 1 },
    },
  }).catch(() => null)

  return NextResponse.json({ data: rows[0] }, { status: 201 })
}
