import type { NextRequest } from "next/server"
import { requireAdmin } from "@/utils/admin-auth"
import { fail, ok } from "@/utils/api-response"
import { getListQuery, paginationMeta } from "@/utils/admin-query"
import {
  decideAdminKyc,
  getAdminDashboard,
  listAdminBookings,
  listAdminHosts,
  listAdminKyc,
  listAdminListings,
  listAdminPayouts,
  listAdminPosts,
  listAdminUsers,
  updateAdminBooking,
  updateAdminHost,
  updateAdminListing,
  updateAdminPayout,
  updateAdminUser,
} from "@/services/admin.service"
import {
  parseAccountUpdate,
  parseBookingUpdate,
  parseKycDecision,
  parseListingUpdate,
  parsePayoutUpdate,
} from "@/validators/admin.validators"

type RouteParams = {
  params: Promise<Record<string, string>>
}

function statusFromError(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode) || 500
    : 500
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

async function withAdmin<T>(request: NextRequest, handler: (admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<T>) {
  try {
    const admin = await requireAdmin(request)
    return await handler(admin)
  } catch (error) {
    return fail(messageFromError(error), statusFromError(error))
  }
}

export async function adminDashboard(request: NextRequest) {
  return withAdmin(request, async () => ok(await getAdminDashboard()))
}

export async function adminBookings(request: NextRequest) {
  return withAdmin(request, async () => {
    const query = getListQuery(request)
    const result = await listAdminBookings(query)
    return ok(result.rows, paginationMeta(result.total, query.page, query.limit))
  })
}

export async function adminUpdateBooking(request: NextRequest, context: RouteParams) {
  return withAdmin(request, async (admin) => {
    const { id } = await context.params
    const input = await parseBookingUpdate(request)
    return ok(await updateAdminBooking(id, admin, input))
  })
}

export async function adminUsers(request: NextRequest) {
  return withAdmin(request, async () => {
    const query = getListQuery(request)
    const result = await listAdminUsers(query)
    return ok(result.rows, paginationMeta(result.total, query.page, query.limit))
  })
}

export async function adminUpdateUser(request: NextRequest, context: RouteParams) {
  return withAdmin(request, async (admin) => {
    const { id } = await context.params
    const input = await parseAccountUpdate(request)
    return ok(await updateAdminUser(id, admin, input))
  })
}

export async function adminHosts(request: NextRequest) {
  return withAdmin(request, async () => {
    const query = getListQuery(request)
    const result = await listAdminHosts(query)
    return ok(result.rows, paginationMeta(result.total, query.page, query.limit))
  })
}

export async function adminUpdateHost(request: NextRequest, context: RouteParams) {
  return withAdmin(request, async (admin) => {
    const { id } = await context.params
    const input = await parseAccountUpdate(request)
    return ok(await updateAdminHost(id, admin, input))
  })
}

export async function adminPayouts(request: NextRequest) {
  return withAdmin(request, async () => {
    const query = getListQuery(request)
    const result = await listAdminPayouts(query)
    return ok(result.rows, paginationMeta(result.total, query.page, query.limit))
  })
}

export async function adminUpdatePayout(request: NextRequest, context: RouteParams) {
  return withAdmin(request, async (admin) => {
    const { id } = await context.params
    const input = await parsePayoutUpdate(request)
    return ok(await updateAdminPayout(id, admin, input))
  })
}

export async function adminKyc(request: NextRequest) {
  return withAdmin(request, async () => {
    const query = getListQuery(request)
    if (!query.status) {
      query.status = request.nextUrl.searchParams.get("status") ?? "PENDING"
    }
    const result = await listAdminKyc(query)
    return ok(result.rows, paginationMeta(result.total, query.page, query.limit))
  })
}

export async function adminUpdateKyc(request: NextRequest, context: RouteParams) {
  return withAdmin(request, async (admin) => {
    const { id } = await context.params
    const input = await parseKycDecision(request)
    return ok(await decideAdminKyc(id, admin, input))
  })
}

export async function adminListings(request: NextRequest) {
  return withAdmin(request, async () => {
    const query = getListQuery(request)
    const result = await listAdminListings(query)
    return ok(result.rows, paginationMeta(result.total, query.page, query.limit))
  })
}

export async function adminPosts(request: NextRequest) {
  return withAdmin(request, async () => {
    const query = getListQuery(request)
    const result = await listAdminPosts(query)
    return ok(result.rows, paginationMeta(result.total, query.page, query.limit))
  })
}

export async function adminUpdateListing(request: NextRequest, context: RouteParams) {
  return withAdmin(request, async (admin) => {
    const { type, id } = await context.params
    if (!["hotel", "tour", "rental", "activity"].includes(type)) {
      return fail("Invalid listing type", 400)
    }
    const input = await parseListingUpdate(request)
    return ok(await updateAdminListing(type as "hotel" | "tour" | "rental" | "activity", id, admin, input))
  })
}
