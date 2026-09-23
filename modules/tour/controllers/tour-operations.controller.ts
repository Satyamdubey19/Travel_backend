import { NextRequest, NextResponse } from "next/server"
import { requireHost } from "@/utils/host-auth"
import { currentUserId } from "@/utils/user-auth"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"
import {
  createTourAnnouncement,
  createTourBatch,
  createTourDocument,
  joinTourWaitlist,
  listTourAnnouncements,
  listTourBatches,
  listTourDocuments,
} from "@/modules/tour/services/tour-operations.service"

async function getCurrentHost() {
  try { return (await requireHost()).host }
  catch { return null }
}

function statusFor(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) return Number((error as { statusCode?: number }).statusCode) || 500
  const message = error instanceof Error ? error.message : "Request failed"
  if (message.toLowerCase().includes("not found")) return 404
  if (message.toLowerCase().includes("required")) return 400
  return 500
}

export async function listBatchesController(_req: NextRequest, tourId: string) {
  try {
    const data = await listTourBatches(tourId)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load departures"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}

export async function createBatchController(req: NextRequest, tourId: string) {
  try {
    const host = await getCurrentHost()
    if (!host) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const data = await createTourBatch(host.id, tourId, await req.json().catch(() => ({})))
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create departure"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}

export async function joinWaitlistController(req: NextRequest, tourId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const data = await joinTourWaitlist(userId, tourId, await req.json().catch(() => ({})))
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not join waitlist"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}

export async function listAnnouncementsController(_req: NextRequest, tourId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const data = await listTourAnnouncements(userId, tourId)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load announcements"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}

export async function createAnnouncementController(req: NextRequest, tourId: string) {
  try {
    const host = await getCurrentHost()
    if (!host) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await assertRateLimit(`tour:announcement:${host.id}:${clientIp(req)}`, 12, 60 * 60)
    const data = await createTourAnnouncement(host.id, tourId, await req.json().catch(() => ({})))
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create announcement"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}

export async function listDocumentsController(req: NextRequest, tourId: string) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const data = await listTourDocuments(userId, tourId)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load documents"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}

export async function createDocumentController(req: NextRequest, tourId: string) {
  try {
    const host = await getCurrentHost()
    if (!host) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const data = await createTourDocument(host.id, tourId, await req.json().catch(() => ({})))
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create document"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}
