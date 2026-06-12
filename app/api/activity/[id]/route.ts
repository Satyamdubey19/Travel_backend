import { NextRequest } from "next/server"
import {
  deleteActivityController,
  getActivity,
  updateActivityController,
} from "@/modules/activity/controllers/activity.controller"
import type { IdRouteParams as Params } from "@/types/routes"

export async function GET(req: NextRequest, { params }: Params) {
  return getActivity(req, (await params).id)
}

export async function PUT(req: NextRequest, { params }: Params) {
  return updateActivityController(req, (await params).id)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return deleteActivityController(req, (await params).id)
}
