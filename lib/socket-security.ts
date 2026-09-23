const tourKeyPattern = /^[a-zA-Z0-9_-]{1,160}$/

export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=")
    if (separator < 1) continue
    if (pair.slice(0, separator).trim() !== name) continue

    const value = pair.slice(separator + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return null
}

export function requireTourKey(value: unknown) {
  const tourKey = typeof value === "string" ? value.trim() : ""
  if (!tourKeyPattern.test(tourKey)) {
    throw Object.assign(new Error("A valid tour is required"), { statusCode: 400 })
  }
  return tourKey
}

export function requireChatMessage(value: unknown) {
  const message = typeof value === "string" ? value.trim() : ""
  if (!message) {
    throw Object.assign(new Error("Message is required"), { statusCode: 400 })
  }
  if (message.length > 2000) {
    throw Object.assign(new Error("Message is too long"), { statusCode: 400 })
  }
  return message
}

export class SocketRateLimiter {
  private readonly events = new Map<string, number[]>()

  consume(key: string, limit: number, windowMs: number, now = Date.now()) {
    const cutoff = now - windowMs
    const recent = (this.events.get(key) ?? []).filter((timestamp) => timestamp > cutoff)
    if (recent.length >= limit) return false
    recent.push(now)
    this.events.set(key, recent)
    return true
  }

  clear(keyPrefix: string) {
    for (const key of this.events.keys()) {
      if (key.startsWith(keyPrefix)) this.events.delete(key)
    }
  }
}
