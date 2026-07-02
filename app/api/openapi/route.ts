import { NextResponse } from "next/server"
import { openApiDocument } from "@/src/docs/swagger"

export const dynamic = "force-static"

export async function GET() {
  return NextResponse.json(openApiDocument, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  })
}
