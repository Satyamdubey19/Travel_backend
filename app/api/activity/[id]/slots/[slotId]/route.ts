import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { assertRateLimit, clientIp } from "@/lib/rate-limit"
import { requireHost } from "@/utils/host-auth"

const updateSchema=z.object({totalSpots:z.coerce.number().int().min(1).max(100),isActive:z.boolean().optional()})
async function ownedSlot(activityId:string,slotId:string){const {host}=await requireHost();const slot=await prisma.activitySlot.findFirst({where:{id:slotId,activityId,Activity:{hostId:host.id}}});if(!slot)throw Object.assign(new Error("Activity slot not found"),{statusCode:404});return slot}
function failure(error:unknown){const status=error instanceof z.ZodError?400:typeof error==="object"&&error&&"statusCode" in error?Number((error as {statusCode?:number}).statusCode)||500:500;return NextResponse.json({error:error instanceof Error?error.message:"Slot operation failed"},{status})}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string;slotId:string}>}){try{const {id,slotId}=await params;await assertRateLimit(`activity-slot-write:${id}:${clientIp(request)}`,30,60);const slot=await ownedSlot(id,slotId);const input=updateSchema.parse(await request.json());if(input.totalSpots<slot.bookedSpots)return NextResponse.json({error:"Capacity cannot be lower than already booked spots"},{status:409});return NextResponse.json({data:await prisma.activitySlot.update({where:{id:slot.id},data:input})})}catch(error){return failure(error)}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string;slotId:string}>}){try{const {id,slotId}=await params;await assertRateLimit(`activity-slot-write:${id}:${clientIp(request)}`,30,60);const slot=await ownedSlot(id,slotId);if(slot.bookedSpots>0)return NextResponse.json({error:"A slot with bookings cannot be deleted; deactivate it instead"},{status:409});await prisma.activitySlot.delete({where:{id:slot.id}});return NextResponse.json({success:true})}catch(error){return failure(error)}}
