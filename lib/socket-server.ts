import { createServer } from "http"
import dotenv from "dotenv"
import { Server } from "socket.io"

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

async function startSocketServer() {
  const { sendTourChatMessage } = await import("../services/tour.service")

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    socket.on("tour:join", ({ tourId }: { tourId?: string }) => {
      if (!tourId) return
      socket.join(`tour:${tourId}`)
      console.log(`Socket ${socket.id} joined tour:${tourId}`)
    })

    socket.on("tour:typing:start", ({ tourId, userId, name }: { tourId?: string; userId?: string; name?: string }) => {
      if (!tourId || !userId) return
      socket.to(`tour:${tourId}`).emit("tour:typing:start", { tourId, userId, name })
    })

    socket.on("tour:typing:stop", ({ tourId, userId }: { tourId?: string; userId?: string }) => {
      if (!tourId || !userId) return
      socket.to(`tour:${tourId}`).emit("tour:typing:stop", { tourId, userId })
    })

    socket.on("tour:message:reaction", ({ tourId, messageId, userId, emoji }: { tourId?: string; messageId?: string; userId?: string; emoji?: string }) => {
      if (!tourId || !messageId || !userId || !emoji) return
      io.to(`tour:${tourId}`).emit("tour:message:reaction", { tourId, messageId, userId, emoji, createdAt: new Date().toISOString() })
    })

    socket.on("tour:announcement:new", ({ tourId, announcement }: { tourId?: string; announcement?: unknown }) => {
      if (!tourId || !announcement) return
      io.to(`tour:${tourId}`).emit("tour:announcement:new", announcement)
      io.to(`tour:${tourId}`).emit("tour:message:new", {
        id: `announcement:${Date.now()}`,
        message: typeof announcement === "object" && announcement && "message" in announcement ? (announcement as { message?: string }).message : "New trip announcement",
        messageType: "SYSTEM",
        createdAt: new Date().toISOString(),
      })
    })

    socket.on("tour:message:send", async ({ tourId, userId, message, scope }: { tourId?: string; userId?: string; message?: string; scope?: string }) => {
      try {
        if (!tourId || !userId || !message) throw new Error("tourId, userId, and message are required")
        const accessScope = scope === "participant" ? "participant" : "host-or-participant"
        const savedMessage = await sendTourChatMessage(userId, tourId, message, accessScope)
        io.to(`tour:${tourId}`).emit("tour:message:new", savedMessage)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Message failed"
        socket.emit("tour:message:error", { error: message })
        console.error("Error sending message:", error)
      }
    })

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`Socket.IO server is running on port ${port}`)
  })
}

void startSocketServer()
