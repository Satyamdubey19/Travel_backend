import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";

const resolvedAuthSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
if (!resolvedAuthSecret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET or JWT_SECRET is required in production");
}

export const authOptions: NextAuthOptions = {
  secret: resolvedAuthSecret || "travels_dev_auth_secret_placeholder",
  // Google uses this only while handing off to the first-party session route.
  // It is never accepted by protected app routes and is cleared after handoff.
  session: { strategy: "jwt", maxAge: 60 * 5 },
  pages: {
    signIn: "/login",
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = profile?.email;
      if (!email) {
        return false;
      }

      const prof = profile as Record<string, unknown> | undefined;
      const isVerified =
        prof?.email_verified === true ||
        prof?.email_verified === "true" ||
        prof?.verified_email === true ||
        prof?.verified_email === "true" ||
        Boolean(prof?.email);

      if (!isVerified) {
        return false;
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        const parsed = new URL(url);
        const base = new URL(baseUrl);
        // Allows callback URLs on the same origin
        if (parsed.origin === base.origin) {
          return url;
        }
        // Allow cross-port localhost redirection (e.g. frontend on 3000, backend on 4000)
        if (
          (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
          (base.hostname === "localhost" || base.hostname === "127.0.0.1")
        ) {
          return url;
        }
      } catch {}
      return baseUrl;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // This JWT is a short-lived Google identity handoff only. The database
        // user and first-party session are created exactly once in
        // /api/auth/google-login after Google's callback succeeds.
        token.id = String(user.id);
        token.email = user.email;
        token.name = user.name;
        token.role = "OAUTH_HANDOFF";
        token.provider = account?.provider ?? "google";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = "OAUTH_HANDOFF";
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.provider = "google";
      }

      return session;
    },
  },
};
