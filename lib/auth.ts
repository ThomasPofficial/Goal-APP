import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // No adapter: Account/Session rows aren't persisted. Google sign-in is
  // linked/created by email directly in the signIn callback below instead —
  // pairing an adapter with the JWT strategy (required by Credentials) was
  // suspected but ruled out as the logout-bug cause.
  session: {
    strategy: "jwt",
    // Explicit maxAge/updateAge: without these pinned, this beta version of
    // next-auth was re-issuing the JWT's `exp` claim on every single hit to
    // /api/auth/session instead of once per 24h updateAge window. That rapid
    // rotation reliably corrupted the session cookie within ~90s of login —
    // a pure-idle session with zero requests never hit the issue.
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Google verifies email ownership, so linking a Google sign-in to an
      // existing password account with the same email is an accepted risk.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const { email, password } = parsed.data;

          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              passwordHash: true,
              role: true,
            },
          });

          if (!user || !user.passwordHash) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true },
        });
        if (existing) {
          user.id = existing.id;
          (user as { role?: string }).role = existing.role;
        } else {
          const created = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
              role: "STUDENT",
              emailVerified: new Date(),
            },
            select: { id: true, role: true },
          });
          user.id = created.id;
          (user as { role?: string }).role = created.role;
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // AUTH_URL/NEXT_PUBLIC_AUTH_URL can drift out of sync with the domain
      // actually serving the request (e.g. still pointing at the raw
      // *.onrender.com host after a custom domain was added) — trusting
      // NODE_ENV to gate that fallback is itself fragile, so key off baseUrl
      // instead: only local dev's baseUrl points at localhost.
      const canonicalBase = baseUrl.includes("localhost")
        ? baseUrl.replace(/\/$/, "")
        : "https://app.nivarro.co";
      if (url.startsWith("/")) return `${canonicalBase}${url}`;
      try {
        if (new URL(url).origin === canonicalBase) return url;
      } catch {}
      return `${canonicalBase}/dashboard`;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as { role?: string }).role ?? "STUDENT";
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (token?.email) {
        session.user.email = token.email as string;
      }
      if (token?.role) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
