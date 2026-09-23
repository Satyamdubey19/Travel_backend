import type { NextRequest } from "next/server"
import { updateAdminRefundController } from "@/modules/admin/controllers/admin-refunds.controller"
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ product: string; id: string }> }) { const { product, id } = await params; return updateAdminRefundController(request, product, id) }
