import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { handleRazorpayWebhook } from "@/modules/booking/services/razorpay-webhook.service"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const result = await handleRazorpayWebhook(rawBody, request.headers.get("x-razorpay-signature") ?? "", request.headers.get("x-razorpay-event-id") ?? "")
    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
    return NextResponse.json({ error: status < 500 && error instanceof Error ? error.message : "Webhook processing failed" }, { status })
  }
}
