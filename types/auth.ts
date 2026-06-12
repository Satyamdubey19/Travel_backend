export type Role = "USER" | "ADMIN" | "HOST"
export type AuthRole = Role | "HOST"

export type RegisterRole = "user" | "host"
export type LoginRole = AuthRole

export interface RegisterInput{
  name: string
  email: string
  password: string
  phone?: string
  role?: RegisterRole
  businessName?: string
}

export interface LoginInput{
  email: string
  password: string
}

export interface UserPayload {
  id: string;
  role: Role;
  isHost: boolean;
  isHostApproved: boolean;
}

export interface JwtPayload extends UserPayload {
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
 user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    businessName?: string | null;
    role: AuthRole;
    isHost: boolean;
    isHostApproved: boolean;
    provider?: string;
  };
}
