import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserFromSessionToken } from "@/modules/auth/services/auth.service"
import { getHostByUserId } from "@/modules/host/services/host.service"
import {
  approveTourJoinRequest,
  createTourBooking,
  createTourJoinRequest,
  createTourPaymentOrder,
  listTours,
  listPublicTours,
  listTourParticipants,
  getTourChatPreview,
  sendTourChatMessage,
  getPublicTourBySlug,
  getTourById,
  normalizeTourForForm,
  rejectTourJoinRequest,
  createTour,
  updateTour,
  deleteTour,
  verifyTourPayment,
} from "@/modules/tour/services/tour.service"

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
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const host = await getHostByUserId(session.user.id)
  if (!host) return { error: NextResponse.json({ error: "Not a host" }, { status: 403 }) }

  return { host }
}

export const getTours = async (req?: Request) => {
  try {
    const url = req ? new URL(req.url) : null
    const scope = url?.searchParams.get("scope")

    if (scope === "mine") {
      const { host, error } = await getCurrentHost()
      if (error) return error

      const tours = await listTours(host.id)
      return NextResponse.json({ data: tours })
    }

    const tours = await listPublicTours()
    console.log("Fetched public tours:", tours)
    return NextResponse.json({ data: tours })
  } catch (error) {
    console.error("GET /api/tour:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const getTour = async (req: NextRequest, id: string) => {
  try {
    const url = new URL(req.url)
    const scope = url.searchParams.get("scope")

    if (scope === "mine") {
      const { host, error } = await getCurrentHost()
      if (error) return error

      const tour = await getTourById(id, host.id)
      if (!tour) return NextResponse.json({ error: "Tour not found" }, { status: 404 })

      return NextResponse.json({ data: normalizeTourForForm(tour) })
    }

    const tour = await getPublicTourBySlug(id)
    if (!tour) return NextResponse.json({ error: "Tour not found" }, { status: 404 })

    return NextResponse.json({ data: tour })
  } catch (error) {
    console.error("GET /api/tour/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const createTourController = async (req: NextRequest) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const body = await req.json()
    const { itinerary = [], ...tourData } = body
    console.log("Creating tour with data:", tourData, "and itinerary:", itinerary)
    console.log("body:", body)

    const tour = await createTour(host.id, tourData, itinerary)
    return NextResponse.json({ data: tour }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/tour:", error)
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json({ error: "A tour with this slug already exists." }, { status: 409 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const updateTourController = async (req: NextRequest, id: string) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const existing = await getTourById(id, host.id)
    if (!existing) return NextResponse.json({ error: "Tour not found" }, { status: 404 })

    const body = await req.json()
    const { itinerary = [], ...tourData } = body

    await updateTour(id, tourData, itinerary)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("PUT /api/tour/[id]:", error)
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json({ error: "A tour with this slug already exists." }, { status: 409 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const deleteTourController = async (_req: NextRequest, id: string) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const existing = await getTourById(id, host.id)
    if (!existing) return NextResponse.json({ error: "Tour not found" }, { status: 404 })

    await deleteTour(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/tour/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const getToursController = getTours

function errorStatus(message: string) {
  if (message.includes("not found")) return 404
  if (message.includes("Unauthorized")) return 401
  if (message.includes("host") || message.includes("Forbidden")) return 403
  if (message.includes("unlock group chat")) return 403
  if (
    message.includes("already") ||
    message.includes("slots") ||
    message.includes("deadline") ||
    message.includes("started") ||
    message.includes("required") ||
    message.includes("available")
  ) return 409
  return 400
}

export const createJoinRequestController = async (req: NextRequest, tourId: string) => {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { introduction?: string }
    const joinRequest = await createTourJoinRequest(userId, tourId, body.introduction)
    return NextResponse.json({ success: true, data: joinRequest }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create join request"
    console.error("POST /api/tour/[id]/join-request:", error)
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}

export const reviewJoinRequestController = async (req: NextRequest, requestId: string) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const body = await req.json().catch(() => ({})) as { action?: string }
    const action = String(body.action ?? "").toLowerCase()
    if (action === "approve") {
      const data = await approveTourJoinRequest(host.id, requestId)
      return NextResponse.json({ success: true, data })
    }
    if (action === "reject") {
      const data = await rejectTourJoinRequest(host.id, requestId)
      return NextResponse.json({ success: true, data })
    }
    return NextResponse.json({ error: "Action must be approve or reject" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review join request"
    console.error("PATCH /api/tour/join-request/[requestId]:", error)
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}

export const createTourBookingController = async (req: NextRequest, tourId: string) => {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const data = await createTourBooking(userId, tourId, body)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create tour booking"
    console.error("POST /api/tour/[id]/booking:", error)
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}

export const createTourPaymentOrderController = async (req: NextRequest, _tourId: string) => {
  void _tourId
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { bookingId?: string }
    if (!body.bookingId) return NextResponse.json({ error: "bookingId is required" }, { status: 400 })

    const data = await createTourPaymentOrder(userId, body.bookingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment order"
    console.error("POST /api/tour/[id]/payment/order:", error)
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}

export const verifyTourPaymentController = async (req: NextRequest, _tourId: string) => {
  void _tourId
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const data = await verifyTourPayment(userId, body)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment"
    console.error("POST /api/tour/[id]/payment/verify:", error)
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}

export const listTourParticipantsController = async (_req: NextRequest, tourId: string) => {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await listTourParticipants(userId, tourId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch participants"
    console.error("GET /api/tour/[id]/participants:", error)
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}

export const getTourChatController = async (_req: NextRequest, tourId: string) => {
  const scope = new URL(_req.url).searchParams.get("scope") === "participant" ? "participant" : "host-or-participant"
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await getTourChatPreview(userId, tourId, scope)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch tour chat"
    const isExpectedAccessLock = scope === "participant" && message.includes("unlock group chat")
    if (!isExpectedAccessLock) {
      console.error("GET /api/tour/[id]/chat:", error)
    }
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}

export const sendTourChatMessageController = async (req: NextRequest, tourId: string) => {
  const scope = new URL(req.url).searchParams.get("scope") === "participant" ? "participant" : "host-or-participant"
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { message?: string }
    const data = await sendTourChatMessage(userId, tourId, String(body.message ?? ""), scope)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send tour message"
    const isExpectedAccessLock = scope === "participant" && message.includes("unlock group chat")
    if (!isExpectedAccessLock) {
      console.error("POST /api/tour/[id]/chat:", error)
    }
    return NextResponse.json({ error: message }, { status: errorStatus(message) })
  }
}
