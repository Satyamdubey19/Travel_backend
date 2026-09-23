import { NextResponse } from "next/server"
import { getReadiness } from "@/modules/health/health.service"

export const dynamic = "force-dynamic"

export async function GET() {
  const result = await getReadiness()
  return NextResponse.json(result, {
    status: result.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  })
}
