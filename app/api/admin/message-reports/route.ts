import type { NextRequest } from "next/server"
import { listMessageReportsController } from "@/modules/community/controllers/community-safety.controller"

export const dynamic = "force-dynamic"
export const GET = (req: NextRequest) => listMessageReportsController(req)
