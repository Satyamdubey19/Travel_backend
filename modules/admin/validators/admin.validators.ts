const listingStatuses = new Set(["DRAFT", "PENDING_REVIEW", "ACTIVE", "PAUSED", "REJECTED", "ARCHIVED"])
const payoutStatuses = new Set(["PENDING", "PROCESSING", "COMPLETED", "FAILED"])
const accountStatuses = new Set(["ACTIVE", "SUSPENDED", "DELETED"])
const bookingStatuses = new Set(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW", "REFUND_PENDING"])

function validationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

function readObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError("Request body must be an object")
  }
  return value as Record<string, unknown>
}

function readString(body: Record<string, unknown>, key: string) {
  const value = body[key]
  return typeof value === "string" ? value.trim() : undefined
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export async function parseListingUpdate(request: Request) {
  const body = readObject(await request.json())
  const status = readString(body, "status")?.toUpperCase()
  if (status && !listingStatuses.has(status)) {
    throw validationError("Invalid listing status")
  }
  const reason = readString(body, "reason")
  if (status && status !== "DRAFT" && (!reason || reason.length < 5)) {
    throw validationError("A clear moderation reason of at least 5 characters is required")
  }

  return {
    status,
    reason,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    title: readString(body, "title"),
    rooms: Array.isArray(body.rooms)
      ? body.rooms
          .filter((room): room is Record<string, unknown> => !!room && typeof room === "object" && !Array.isArray(room))
          .map((room) => ({
            id: readString(room, "id"),
            pricePerNight: readNumber(room.pricePerNight),
            originalPrice: readNumber(room.originalPrice),
            totalRooms: readNumber(room.totalRooms),
            availableRooms: readNumber(room.availableRooms),
            isActive: typeof room.isActive === "boolean" ? room.isActive : undefined,
          }))
          .filter((room) => room.id)
      : undefined,
  }
}

export async function parseKycDecision(request: Request) {
  const body = readObject(await request.json())
  const action = readString(body, "action")?.toLowerCase()
  if (action && !["approve", "reject", "request_changes", "resubmission_required"].includes(action)) {
    throw validationError("Invalid KYC action")
  }
  if (!action || body.status !== undefined) {
    throw validationError("Use an explicit KYC action")
  }

  return {
    action,
    rejectionReason: readString(body, "rejectionReason") || readString(body, "reason"),
  }
}

export async function parsePayoutUpdate(request: Request) {
  const body = readObject(await request.json())
  const status = readString(body, "status")?.toUpperCase()
  if (!status || !payoutStatuses.has(status)) {
    throw validationError("Invalid payout status")
  }

  return {
    status,
    transactionId: readString(body, "transactionId"),
    failureReason: readString(body, "failureReason"),
    notes: readString(body, "notes"),
  }
}

export async function parseAccountUpdate(request: Request) {
  const body = readObject(await request.json())
  const status = readString(body, "status")?.toUpperCase()
  if (!status || !accountStatuses.has(status)) {
    throw validationError("Invalid account status")
  }

  return {
    status,
    reason: readString(body, "reason"),
  }
}

export async function parseBookingUpdate(request: Request) {
  const body = readObject(await request.json())
  const status = readString(body, "status")?.toUpperCase()
  if (!status || !bookingStatuses.has(status)) {
    throw validationError("Invalid booking status")
  }

  return {
    status,
    reason: readString(body, "overrideReason") || readString(body, "reason"),
  }
}
