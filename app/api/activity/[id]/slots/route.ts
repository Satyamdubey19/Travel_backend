import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"
import { requireHost } from "@/utils/host-auth"

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  totalSpots: z.coerce.number().int().min(1).max(100),
})

async function ownedActivity(id: string) {
  const { host } = await requireHost()
  const activity = await prisma.activity.findFirst({ where: { id, hostId: host.id }, select: { id: true } })
  if (!activity) throw Object.assign(new Error("Activity not found"), { statusCode: 404 })
  return activity
}

function slotDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  const tomorrow = new Date(); tomorrow.setUTCHours(0,0,0,0); tomorrow.setUTCDate(tomorrow.getUTCDate()+1)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==value || date < tomorrow) throw Object.assign(new Error("Activity slots must be valid future dates"), { statusCode: 400 })
  return date
}

function failure(error: unknown) {
  const status = error instanceof z.ZodError ? 400 : typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
  return NextResponse.json({ error: error instanceof Error ? error.message : "Slot operation failed" }, { status })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const activity=await ownedActivity((await params).id); return NextResponse.json({ data: await prisma.activitySlot.findMany({ where: { activityId: activity.id }, orderBy: [{date:"asc"},{startTime:"asc"}] }) }) } catch(error){ return failure(error) }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const activityId=(await params).id; await assertRateLimit(`activity-slot-write:${activityId}:${clientIp(request)}`,30,60)
    const activity=await ownedActivity(activityId); const input=slotSchema.parse(await request.json()); const date=slotDate(input.date)
    const slot=await prisma.activitySlot.create({data:{activityId:activity.id,date,startTime:input.startTime,totalSpots:input.totalSpots,bookedSpots:0,isActive:true}})
    return NextResponse.json({data:slot},{status:201})
  } catch(error) { if(typeof error==="object"&&error&&"code" in error&&(error as {code?:string}).code==="P2002")return NextResponse.json({error:"That dated time slot already exists"},{status:409}); return failure(error) }
}
