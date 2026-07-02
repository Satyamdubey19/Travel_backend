import { swaggerHtml } from "@/src/docs/api-docs"

export const dynamic = "force-static"

export async function GET() {
  return new Response(swaggerHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  })
}
