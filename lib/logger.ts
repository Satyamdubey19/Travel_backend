import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: {
    service: "travels-backend",
    environment: process.env.NODE_ENV ?? "development",
  },
  redact: {
    paths: [
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "cookie",
      "otp",
      "idNumber",
      "aadhaarNumber",
      "contactPhone",
      "contactEmail",
      "req.headers.authorization",
      "req.headers.cookie",
      "request.headers.authorization",
      "request.headers.cookie",
      "*.password",
      "*.token",
      "*.otp",
      "*.idNumber",
      "*.aadhaarNumber",
    ],
    censor: "[REDACTED]",
  },
})
