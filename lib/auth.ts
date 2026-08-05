import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Adapter only backs OAuth account linking here — sessions still use JWTs
  // (required for the Credentials provider, which can't use database sessions).
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
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
