import { render } from "@react-email/render"
import { Queue } from "bullmq"
import IORedis from "ioredis"
import { resend } from "@/lib/resend"
import TourTransactionalEmail from "@/emails/TourTransactionalEmail"
import type { EmailJobName, EmailJobPayload } from "./email.types"

const redisUrl = process.env.REDIS_URL
const connection = redisUrl ? new IORedis(redisUrl, { maxRetriesPerRequest: null }) : null

export const tourEmailQueue = connection ? new Queue<EmailJobPayload, void, EmailJobName>("tour-email", { connection }) : null

export async function sendTourEmailNow(name: EmailJobName, payload: EmailJobPayload) {
  const html = await render(TourTransactionalEmail({
    title: payload.subject,
    preview: payload.preview,
    lines: payload.lines,
    ctaUrl: payload.ctaUrl,
    ctaLabel: payload.ctaLabel,
  }))

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "GetHotels <onboarding@resend.dev>",
    to: payload.to,
    subject: payload.subject,
    html,
    tags: [{ name: "tour_event", value: name }],
  })
}

export async function enqueueTourEmail(name: EmailJobName, payload: EmailJobPayload) {
  if (!tourEmailQueue) return sendTourEmailNow(name, payload)
  return tourEmailQueue.add(name, payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  })
}
