import type { NextRequest } from "next/server"
import { getAdminRefundsController } from "@/modules/admin/controllers/admin-refunds.controller"
export async function GET(request: NextRequest) { return getAdminRefundsController(request) }
