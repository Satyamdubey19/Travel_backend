import { createServer } from "http"
import dotenv from "dotenv"
import { Server } from "socket.io"
import { readCookie, requireChatMessage, requireTourKey, SocketRateLimiter } from "./socket-security"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const httpServer = createServer()
const port = Number(process.env.SOCKET_PORT ?? 3001)

const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },
})

const limiter = new SocketRateLimiter()

type EventPayload = Record<string, unknown> | null | undefined

function publicSocketError(error: unknown) {
  const statusCode = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode)
    : 500
  if (statusCode >= 400 && statusCode < 500 && error instanceof Error) return error.message
  return "The live connection could not complete this request"
}

async function startSocketServer() {
  const [{ getUserFromSessionToken }, { requireTourCircleAccess }, { sendTourChatMessage }, { blockedUserIdsFor }] = await Promise.all([
    import("../modules/auth/services/auth.service"),
    import("../modules/tour/services/tour-circle-access.service"),
    import("../modules/tour/services/tour.service"),
    import("../modules/community/services/community-safety.service"),
  ])

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, "token")
      if (!token) return next(new Error("Authentication required"))

      const user = await getUserFromSessionToken(token)
      if (!user) return next(new Error("Authentication required"))

      socket.data.sessionToken = token
      socket.data.user = { id: user.id, name: user.name, role: user.role }
      next()
    } catch {
      next(new Error("Authentication required"))
    }
  })

  io.on("connection", (socket) => {
    const rateKey = `${socket.data.user.id}:${socket.id}:`

    const currentUser = async () => {
      const user = await getUserFromSessionToken(socket.data.sessionToken)
      if (!user || user.id !== socket.data.user.id) {
        socket.disconnect(true)
        throw Object.assign(new Error("Your session has expired"), { statusCode: 401 })
      }
      return user
    }

    const authorizeTour = async (value: unknown) => {
      const tourKey = requireTourKey(value)
      const user = await currentUser()
      const access = await requireTourCircleAccess(user.id, tourKey)
      return { user, access, room: `tour:${access.tour.id}` }
    }

    const emitError = (error: unknown) => {
      socket.emit("tour:message:error", { error: publicSocketError(error) })
    }

    const emitToUnblockedRoom = async (room: string, senderId: string, event: string, payload: unknown, includeSender: boolean) => {
      const blocked = await blockedUserIdsFor(senderId)
      const members = await io.in(room).fetchSockets()
      for (const member of members) {
        if (!includeSender && member.id === socket.id) continue
        const memberUserId = typeof member.data.user?.id === "string" ? member.data.user.id : ""
        if (!memberUserId || blocked.has(memberUserId)) continue
        member.emit(event, payload)
      }
    }

    socket.on("tour:join", async (payload: EventPayload) => {
      try {
        if (!limiter.consume(`${rateKey}join`, 15, 60_000)) {
          throw Object.assign(new Error("Too many room requests. Please wait a moment."), { statusCode: 429 })
        }
        const { access, room } = await authorizeTour(payload?.tourId)
        await socket.join(room)
        socket.emit("tour:joined", { tourId: access.tour.id })
      } catch (error) {
        emitError(error)
      }
    })

    const relayTyping = (event: "tour:typing:start" | "tour:typing:stop") => async (payload: EventPayload) => {
      try {
        if (!limiter.consume(`${rateKey}typing`, 30, 10_000)) return
        const { user, access, room } = await authorizeTour(payload?.tourId)
        if (!socket.rooms.has(room)) throw Object.assign(new Error("Join the Trip Circle before posting"), { statusCode: 403 })
        await emitToUnblockedRoom(room, user.id, event, { tourId: access.tour.id, userId: user.id, name: user.name }, false)
      } catch (error) {
        emitError(error)
      }
    }

    socket.on("tour:typing:start", relayTyping("tour:typing:start"))
    socket.on("tour:typing:stop", relayTyping("tour:typing:stop"))

    socket.on("tour:message:send", async (payload: EventPayload) => {
      try {
        if (!limiter.consume(`${rateKey}message`, 12, 10_000)) {
          throw Object.assign(new Error("You are sending messages too quickly"), { statusCode: 429 })
        }
        const message = requireChatMessage(payload?.message)
        const { user, access, room } = await authorizeTour(payload?.tourId)
        if (!socket.rooms.has(room)) throw Object.assign(new Error("Join the Trip Circle before posting"), { statusCode: 403 })
        const savedMessage = await sendTourChatMessage(user.id, access.tour.id, message)
        await emitToUnblockedRoom(room, user.id, "tour:message:new", savedMessage, true)
      } catch (error) {
        emitError(error)
      }
    })

    socket.on("disconnect", () => {
      limiter.clear(rateKey)
    })
  })

  httpServer.listen(port, () => {
    console.log(`Socket.IO server is running on port ${port}`)
  })
}

void startSocketServer()
