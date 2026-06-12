import type { NextAuthOptions, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  authorizeCredentials,
  handleGoogleAuth,
} from "@/modules/auth/services/auth.service";

type AuthUserForToken = {
  id: number | string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  businessName?: string | null;
  isHost?: boolean;
  isHostApproved?: boolean;
  provider?: string;
};

function applyUserToToken(token: JWT, user: AuthUserForToken) {
  token.id = String(user.id);
  token.role = user.role;
  token.email = user.email;
  token.name = user.name;
  token.phone = user.phone ?? null;
  token.businessName = user.businessName ?? null;
  token.isHost = Boolean(user.isHost);
  token.isHostApproved = Boolean(user.isHostApproved);
  token.provider = user.provider ?? "credentials";
  return token;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        type: { label: "Account type", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await authorizeCredentials({
          email: credentials.email,
          password: credentials.password,
          type: credentials.type,
        });

        return {
          ...user,
          id: String(user.id),
        } satisfies User;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = user.email ?? profile?.email;
      if (!email) {
        return false;
      }

      const dbUser = await handleGoogleAuth({
        email,
        name: user.name ?? profile?.name,
        providerId: account.providerAccountId,
      });

      Object.assign(user, {
        ...dbUser,
        id: String(dbUser.id),
      });

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        return applyUserToToken(token, user as AuthUserForToken);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = token.role as string;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.phone = token.phone as string | null;
        session.user.businessName = token.businessName as string | null;
        session.user.isHost = Boolean(token.isHost);
        session.user.isHostApproved = Boolean(token.isHostApproved);
        session.user.provider = token.provider as string | undefined;
      }

      return session;
    },
  },
};
