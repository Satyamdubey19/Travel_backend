import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type DbClient = any

type CalendarRow = {
  date: Date
  availableInventory: number
  availableCount: number
  priceOverride: { toString(): string } | number | null
  basePrice: { toString(): string } | number
  isClosed: boolean
  closedToCheckIn: boolean
  closedToCheckOut: boolean
  minStay: number | null
  maxStay: number | null
}

type BlackoutRow = {
  date: Date
  reason: string | null
}

export type AvailabilityInput = {
  roomId: string
  checkIn: Date
  checkOut: Date
  quantity: number
}

export type AvailabilityQuote = {
  available: boolean
  nights: number
  minAvailable: number
  subtotal: number
  reason?: string
}

export function parseStayDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error("Invalid stay date")
  return date
}

export function getTodayStayDate() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) return parseStayDate(new Date().toISOString().slice(0, 10))
  return parseStayDate(`${year}-${month}-${day}`)
}

export function enumerateStayDates(checkIn: Date, checkOut: Date) {
  const dates: Date[] = []
  const cursor = new Date(checkIn)

  while (cursor < checkOut) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addStayDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export type RoomAvailabilityCalendarInput = {
  roomId: string
  totalInventory: number
  availableInventory?: number
  basePrice: number
  startDate?: Date
  endDate?: Date
  days?: number
  isClosed?: boolean
}

export async function createRoomAvailabilityCalendar(
  input: RoomAvailabilityCalendarInput,
  db: DbClient = prisma,
) {
  const startDate = input.startDate ?? getTodayStayDate()
  const endDate = input.endDate ?? addStayDays(startDate, input.days ?? 365)
  const totalInventory = Math.max(Math.trunc(input.totalInventory), 0)
  const availableInventory = Math.min(
    Math.max(Math.trunc(input.availableInventory ?? totalInventory), 0),
    totalInventory,
  )
  const basePrice = Math.max(input.basePrice, 0)
  const dates = enumerateStayDates(startDate, endDate)

  if (dates.length === 0) return { count: 0 }

  return db.roomAvailability.createMany({
    data: dates.map((date) => ({
      roomId: input.roomId,
      date,
      totalInventory,
      soldInventory: 0,
      reservedInventory: 0,
      availableInventory,
      availableCount: availableInventory,
      basePrice,
      isClosed: input.isClosed ?? false,
      closedToCheckIn: false,
      closedToCheckOut: false,
    })),
    skipDuplicates: true,
  })
}

export async function checkRoomAvailability(
  input: AvailabilityInput,
  db: DbClient = prisma,
): Promise<AvailabilityQuote> {
  const stayDates = enumerateStayDates(input.checkIn, input.checkOut)
  if (stayDates.length === 0) {
    return { available: false, nights: 0, minAvailable: 0, subtotal: 0, reason: "Check-out must be after check-in" }
  }

  const today = getTodayStayDate()
  if (input.checkIn < today) {
    return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: "Check-in date cannot be in the past" }
  }

  const room = await db.room.findFirst({
    where: { id: input.roomId, isActive: true },
    select: {
      id: true,
      totalRooms: true,
      pricePerNight: true,
      minAdvanceDays: true,
      maxAdvanceDays: true,
    },
  })

  if (!room) {
    return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: "Room not found" }
  }

  const daysUntilCheckIn = Math.floor((input.checkIn.getTime() - today.getTime()) / 86400000)
  if (daysUntilCheckIn < room.minAdvanceDays) {
    return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: "Booking is too close to check-in" }
  }
  if (room.maxAdvanceDays != null && daysUntilCheckIn > room.maxAdvanceDays) {
    return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: "Booking is too far in advance" }
  }

  const [calendarRows, blackoutRows] = await Promise.all([
    db.roomAvailability.findMany({
      where: {
        roomId: input.roomId,
        date: { gte: input.checkIn, lt: input.checkOut },
      },
      select: {
        date: true,
        availableInventory: true,
        availableCount: true,
        priceOverride: true,
        basePrice: true,
        isClosed: true,
        closedToCheckIn: true,
        closedToCheckOut: true,
        minStay: true,
        maxStay: true,
      },
      orderBy: { date: "asc" },
    }),
    db.blackoutDate.findMany({
      where: {
        roomId: input.roomId,
        date: { gte: input.checkIn, lt: input.checkOut },
      },
      select: { date: true, reason: true },
    }),
  ]) as [CalendarRow[], BlackoutRow[]]

  if (blackoutRows.length > 0) {
    return {
      available: false,
      nights: stayDates.length,
      minAvailable: 0,
      subtotal: 0,
      reason: blackoutRows[0].reason ?? `Room is blocked on ${dateKey(blackoutRows[0].date)}`,
    }
  }

  const calendarByDate = new Map(calendarRows.map((row) => [dateKey(row.date), row]))
  let minAvailable = room.totalRooms
  let subtotal = 0

  for (let index = 0; index < stayDates.length; index++) {
    const date = stayDates[index]
    const row = calendarByDate.get(dateKey(date))
    if (!row) {
      return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: `Missing inventory for ${dateKey(date)}` }
    }

    if (row.isClosed) {
      return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: `Room is closed on ${dateKey(date)}` }
    }

    if (index === 0 && row.closedToCheckIn) {
      return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: "Check-in is closed for this date" }
    }

    if (index === stayDates.length - 1 && row.closedToCheckOut) {
      return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: "Check-out is closed for this stay" }
    }

    if (row.minStay != null && stayDates.length < row.minStay) {
      return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: `Minimum stay is ${row.minStay} night(s)` }
    }

    if (row.maxStay != null && stayDates.length > row.maxStay) {
      return { available: false, nights: stayDates.length, minAvailable: 0, subtotal: 0, reason: `Maximum stay is ${row.maxStay} night(s)` }
    }

    const availableInventory = row.availableInventory ?? row.availableCount
    minAvailable = Math.min(minAvailable, availableInventory)
    subtotal += Number(row.priceOverride ?? row.basePrice) * input.quantity
  }

  if (minAvailable < input.quantity) {
    return {
      available: false,
      nights: stayDates.length,
      minAvailable,
      subtotal,
      reason: `Only ${minAvailable} room(s) available for the selected dates`,
    }
  }

  return { available: true, nights: stayDates.length, minAvailable, subtotal }
}

export async function reserveRoomInventory(
  input: AvailabilityInput,
  db: DbClient,
) {
  const stayDates = enumerateStayDates(input.checkIn, input.checkOut)

  for (const date of stayDates) {
    const result = await db.roomAvailability.updateMany({
      where: {
        roomId: input.roomId,
        date,
        isClosed: false,
        availableInventory: { gte: input.quantity },
      },
      data: {
        availableInventory: { decrement: input.quantity },
        availableCount: { decrement: input.quantity },
        reservedInventory: { increment: input.quantity },
      },
    })

    if (result.count !== 1) {
      throw new Error(`Room is not available on ${dateKey(date)}`)
    }
  }
}

export async function releaseReservedRoomInventory(
  input: AvailabilityInput,
  db: DbClient,
) {
  const stayDates = enumerateStayDates(input.checkIn, input.checkOut)

  for (const date of stayDates) {
    await db.roomAvailability.updateMany({
      where: {
        roomId: input.roomId,
        date,
        reservedInventory: { gte: input.quantity },
      },
      data: {
        availableInventory: { increment: input.quantity },
        availableCount: { increment: input.quantity },
        reservedInventory: { decrement: input.quantity },
      },
    })
  }
}
