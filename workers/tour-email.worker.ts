import dotenv from "dotenv"
import { Worker } from "bullmq"
import IORedis from "ioredis"
import { sendTourEmailNow } from "@/services/email/tour-email.service"
import type { EmailJobName, EmailJobPayload } from "@/services/email/email.types"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  console.warn("REDIS_URL is not configured. Tour email worker is idle.")
} else {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })
  new Worker<EmailJobPayload, void, EmailJobName>(
    "tour-email",
    async (job) => {
      await sendTourEmailNow(job.name, job.data)
    },
    { connection, concurrency: 5 },
  )
  console.log("Tour email worker started")
}
