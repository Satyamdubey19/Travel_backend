import jwt from "jsonwebtoken";
import { JwtPayload, UserPayload } from "@/types/auth";

function getJwtSecret() {
  const jwtSecret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT secret is not configured");
  }

  return jwtSecret;
}

export const signJwt = (payload: UserPayload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d", algorithm: "HS256" });
};

export const verifyJwt = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
  } catch {
    return null;
  }
};