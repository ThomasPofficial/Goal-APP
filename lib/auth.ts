import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
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
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      // Always re-fetch if onboarding not yet complete (heals stale JWTs)
      if (user || !token.onboardingComplete) {
        const uid = (user?.id ?? token.id) as string;
        if (uid) {
          const profile = await prisma.profile.findUnique({
            where: { userId: uid },
            select: { geniusType: true, onboardingComplete: true },
          });
          token.geniusType = profile?.geniusType ?? null;
          token.onboardingComplete = profile?.onboardingComplete ?? false;
        }
      }
      if (trigger === "update" && session) {
        if (session.geniusType !== undefined) token.geniusType = session.geniusType;
        if (session.onboardingComplete !== undefined) token.onboardingComplete = session.onboardingComplete;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.geniusType = (token.geniusType as string | null) ?? null;
      session.user.onboardingComplete = (token.onboardingComplete as boolean) ?? false;
      return session;
    },
  },
});
