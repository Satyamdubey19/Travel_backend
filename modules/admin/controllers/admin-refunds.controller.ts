import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/utils/admin-auth"
import { decideRefund, listAdminRefunds } from "@/modules/admin/services/refund.service"

const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "execute", "reconcile"]),
  approvedAmount: z.coerce.number().positive().max(10_000_000).optional(),
  reason: z.string().trim().max(500).optional(),
})

function failure(error: unknown) {
  const status = error instanceof z.ZodError ? 400 : typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
  return NextResponse.json({ error: error instanceof Error ? error.message : "Refund operation failed" }, { status })
}

export async function getAdminRefundsController(request: NextRequest) {
  try {
    await requireAdmin(request)
    const product = request.nextUrl.searchParams.get("product") ?? undefined
    const status = request.nextUrl.searchParams.get("status") ?? undefined
    return NextResponse.json({ data: await listAdminRefunds(product, status) })
  } catch (error) { return failure(error) }
}

export async function updateAdminRefundController(request: NextRequest, product: string, id: string) {
  try {
    const admin = await requireAdmin(request)
    if (product !== "activity" && product !== "rental") return NextResponse.json({ error: "Invalid refund product" }, { status: 400 })
    const input = decisionSchema.parse(await request.json())
    return NextResponse.json({ data: await decideRefund(product, id, admin, input.action, input.approvedAmount, input.reason) })
  } catch (error) { return failure(error) }
}
