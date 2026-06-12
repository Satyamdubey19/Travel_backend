import jwt from "jsonwebtoken";
import { JwtPayload, UserPayload } from "@/types/auth";

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwtSecret;
}

export const signJwt = (payload: UserPayload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
};

export const verifyJwt = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    return null;
  }
};