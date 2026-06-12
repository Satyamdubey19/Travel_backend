import { NextRequest } from "next/server"
import { createActivityController, getActivitiesController } from "@/modules/activity/controllers/activity.controller"

export async function GET(req: NextRequest) {
  return getActivitiesController(req)
}

export async function POST(req: NextRequest) {
  return createActivityController(req)
}

