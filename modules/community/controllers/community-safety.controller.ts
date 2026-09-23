import { NextRequest, NextResponse } from "next/server"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"
import { requireAdmin } from "@/utils/admin-auth"
import { requireUser } from "@/utils/user-auth"
import {
  blockCircleMember,
  listMessageReports,
  listMyBlocks,
  reportTourMessage,
  reviewMessageReport,
  unblockUser,
} from "../services/community-safety.service"

function responseError(error: unknown, fallback: string) {
  const status = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode) || 400
    : 500
  return NextResponse.json({ error: status < 500 && error instanceof Error ? error.message : fallback }, { status })
}

export async function getMyBlocksController() {
  try {
    const user = await requireUser()
    return NextResponse.json({ data: await listMyBlocks(String(user.id)) })
  } catch (error) {
    return responseError(error, "Could not load blocked people")
  }
}

export async function blockCircleMemberController(req: NextRequest, tourId: string, blockedId: string) {
  try {
    const user = await requireUser()
    await assertRateLimit(`community:block:${user.id}:${clientIp(req)}`, 20, 60 * 60)
    return NextResponse.json({ data: await blockCircleMember(String(user.id), tourId, blockedId) }, { status: 201 })
  } catch (error) {
    return responseError(error, "Could not block this person")
  }
}

export async function unblockUserController(_req: NextRequest, blockedId: string) {
  try {
    const user = await requireUser()
    return NextResponse.json({ data: await unblockUser(String(user.id), blockedId) })
  } catch (error) {
    return responseError(error, "Could not unblock this person")
  }
}

export async function reportTourMessageController(req: NextRequest, tourId: string, messageId: string) {
  try {
    const user = await requireUser()
    await assertRateLimit(`community:report:${user.id}:${clientIp(req)}`, 10, 60 * 60)
    const body = await req.json().catch(() => ({}))
    return NextResponse.json({ data: await reportTourMessage(String(user.id), tourId, messageId, body) }, { status: 201 })
  } catch (error) {
    return responseError(error, "Could not submit this message report")
  }
}

export async function listMessageReportsController(req: NextRequest) {
  try {
    await requireAdmin(req)
    return NextResponse.json({ data: await listMessageReports(req.nextUrl.searchParams.get("status") ?? undefined) })
  } catch (error) {
    return responseError(error, "Could not load message reports")
  }
}

export async function reviewMessageReportController(req: NextRequest, reportId: string) {
  try {
    const admin = await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    return NextResponse.json({ data: await reviewMessageReport(admin, reportId, body) })
  } catch (error) {
    return responseError(error, "Could not review this message report")
  }
}
