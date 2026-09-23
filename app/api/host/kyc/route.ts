import type { NextRequest } from "next/server"
import { getHostKycController, submitHostKycController } from "@/modules/host/controllers/host-kyc.controller"

export async function GET() { return getHostKycController() }
export async function POST(request: NextRequest) { return submitHostKycController(request) }
