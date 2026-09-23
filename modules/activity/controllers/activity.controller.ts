import { NextRequest, NextResponse } from "next/server"
import { requireHost } from "@/utils/host-auth"
import {
  listActivities,
  listPublicActivities,
  getActivityById,
  getPublicActivityBySlug,
  normalizeActivityForForm,
  createActivity,
  updateActivity,
  deleteActivity,
} from "@/modules/activity/services/activity.service"

async function getCurrentHost() {
  try { return { host: (await requireHost()).host } }
  catch (error) { return { error: NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 401 }) } }
}

export const getActivities = async (req: NextRequest) => {
  try {
    const scope = new URL(req.url).searchParams.get("scope")

    if (scope === "mine") {
      const { host, error } = await getCurrentHost()
      if (error) return error

      const activities = await listActivities(host.id)
      return NextResponse.json({ data: activities })
    }

    const activities = await listPublicActivities()
    return NextResponse.json({ data: activities })
  } catch (error) {
    console.error("GET /api/activity:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const getActivity = async (req: NextRequest, id: string) => {
  try {
    const scope = new URL(req.url).searchParams.get("scope")

    if (scope === "mine") {
      const { host, error } = await getCurrentHost()
      if (error) return error

      const activity = await getActivityById(id, host.id)
      if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 })

      return NextResponse.json({ data: normalizeActivityForForm(activity) })
    }

    const activity = await getPublicActivityBySlug(id)
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 })

    return NextResponse.json({ data: activity })
  } catch (error) {
    console.error("GET /api/activity/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const createActivityController = async (req: NextRequest) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const activity = await createActivity(host.id, await req.json())
    return NextResponse.json({ data: activity }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/activity:", error)
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json({ error: "An activity with this slug already exists." }, { status: 409 })
    const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
    return NextResponse.json({ error: error instanceof Error && status < 500 ? error.message : "Internal server error" }, { status })
  }
}

export const updateActivityController = async (req: NextRequest, id: string) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const existing = await getActivityById(id, host.id)
    if (!existing) return NextResponse.json({ error: "Activity not found" }, { status: 404 })

    await updateActivity(id, await req.json())
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("PUT /api/activity/[id]:", error)
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json({ error: "An activity with this slug already exists." }, { status: 409 })
    const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) || 500 : 500
    return NextResponse.json({ error: error instanceof Error && status < 500 ? error.message : "Internal server error" }, { status })
  }
}

export const deleteActivityController = async (_req: NextRequest, id: string) => {
  try {
    const { host, error } = await getCurrentHost()
    if (error) return error

    const existing = await getActivityById(id, host.id)
    if (!existing) return NextResponse.json({ error: "Activity not found" }, { status: 404 })

    await deleteActivity(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/activity/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const getActivitiesController = getActivities
