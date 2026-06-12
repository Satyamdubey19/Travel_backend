import type { NextRequest } from "next/server"

export type PaginationInput = {
  page: number
  limit: number
  skip: number
}

export type ListQuery = PaginationInput & {
  search: string
  status: string
  role: string
  type: string
  sortBy: string
  sortOrder: "asc" | "desc"
}

export function getListQuery(request: NextRequest): ListQuery {
  const params = request.nextUrl.searchParams
  const page = Math.max(Number(params.get("page") ?? 1), 1)
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 10), 1), 100)
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc"

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    search: params.get("search")?.trim() ?? "",
    status: params.get("status")?.trim() ?? "",
    role: params.get("role")?.trim() ?? "",
    type: params.get("type")?.trim() ?? "",
    sortBy: params.get("sortBy")?.trim() || "createdAt",
    sortOrder,
  }
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  }
}

