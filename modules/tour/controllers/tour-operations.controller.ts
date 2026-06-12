import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserFromSessionToken } from "@/modules/auth/services/auth.service"
import { getHostByUserId } from "@/modules/host/services/host.service"
import {
  createTourAnnouncement,
  createTourBatch,
  createTourDocument,
  joinTourWaitlist,
  listTourAnnouncements,
  listTourBatches,
  listTourDocuments,
} from "@/modules/tour/services/tour-operations.service"

async function getAuthenticatedUserId() {
  const token = (await cookies()).get("token")?.value
  if (token) {
    const user = await getUserFromSessionToken(token)
    if (user?.id) return String(user.id)
  }

  const session = await getServerSession(authOptions)
  return session?.user?.id ? String(session.user.id) : null
}

async function getCurrentHost() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return getHostByUserId(session.user.id)
}

function statusFor(error: unknown) {
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
    const userId = await getAuthenticatedUserId()
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
    const data = await listTourAnnouncements(tourId)
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
    const data = await createTourAnnouncement(host.id, tourId, await req.json().catch(() => ({})))
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create announcement"
    return NextResponse.json({ error: message }, { status: statusFor(error) })
  }
}

export async function listDocumentsController(req: NextRequest, tourId: string) {
  try {
    const participantOnly = new URL(req.url).searchParams.get("scope") === "participant"
    const data = await listTourDocuments(tourId, participantOnly)
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
