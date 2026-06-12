import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getHostByUserId } from "@/modules/host/services/host.service"
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const host = await getHostByUserId(session.user.id)
  if (!host) return { error: NextResponse.json({ error: "Not a host" }, { status: 403 }) }

  return { host }
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
