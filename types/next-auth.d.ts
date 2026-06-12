import type { DefaultSession } from "next-auth";

export {};

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      phone?: string | null;
      businessName?: string | null;
      isHost?: boolean;
      isHostApproved?: boolean;
      provider?: string;
    };
  }

  interface User {
    role?: string;
    phone?: string | null;
    businessName?: string | null;
    isHost?: boolean;
    isHostApproved?: boolean;
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    phone?: string | null;
    businessName?: string | null;
    isHost?: boolean;
    isHostApproved?: boolean;
    provider?: string;
  }
}
